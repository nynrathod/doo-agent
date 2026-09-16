import { createWorkersAI } from "workers-ai-provider";
import { callable, routeAgentRequest, type Schedule } from "agents";
import { getSchedulePrompt, scheduleSchema } from "agents/schedule";
import { AIChatAgent, type OnChatMessageOptions } from "@cloudflare/ai-chat";
import {
  convertToModelMessages,
  pruneMessages,
  stepCountIs,
  streamText,
  tool
} from "ai";
import { z } from "zod";

export class DooAgent extends AIChatAgent<Env> {
  maxPersistedMessages = 100;
  chatRecovery = true;
  // Wait for MCP connections to be re-established after hibernation before
  // processing a message, so MCP tools aren't intermittently missing.
  waitForMcpConnections = true;

  onStart() {
    // Configure OAuth popup behavior for MCP servers that require authentication
    this.mcp.configureOAuthCallback({
      customHandler: (result) => {
        if (result.authSuccess) {
          return new Response("<script>window.close();</script>", {
            headers: { "content-type": "text/html" },
            status: 200
          });
        }
        return new Response(
          `Authentication Failed: ${result.authError || "Unknown error"}`,
          {
            headers: { "content-type": "text/plain" },
            status: 400
          }
        );
      }
    });
  }

  @callable()
  async addServer(name: string, url: string) {
    return await this.addMcpServer(name, url);
  }

  @callable()
  async removeServer(serverId: string) {
    await this.removeMcpServer(serverId);
  }

  private async safeTool<T>(
    name: string,
    fn: () => Promise<T>
  ): Promise<T | { error: string }> {
    try {
      return await fn();
    } catch (e) {
      return { error: `Tool ${name} failed: ${String(e)}` };
    }
  }

  private async embed(text: string): Promise<number[]> {
    const result = (await this.env.AI.run("@cf/baai/bge-base-en-v1.5", {
      text: [text]
    })) as { data: number[][] };
    return result.data[0];
  }

  async onChatMessage(_onFinish: unknown, options?: OnChatMessageOptions) {
    const mcpTools = this.mcp.getAITools();
    const workersai = createWorkersAI({ binding: this.env.AI });

    const lastUser = [...this.messages]
      .reverse()
      .find((m) => m.role === "user");
    const lastUserText =
      lastUser?.parts
        ?.filter((p) => p.type === "text")
        .map((p) => (p as { text: string }).text)
        .join(" ") ?? "";

    const lastUserEmbedding = await this.embed(lastUserText);
    const seedResults = await this.env.VECTORIZE.query(lastUserEmbedding, {
      topK: 5,
      returnMetadata: true
    });
    const seedContext = (seedResults.matches ?? [])
      .map(
        (m) =>
          `--- [${m.metadata?.source ?? "unknown"}] ---\n${m.metadata?.text ?? ""}`
      )
      .join("\n\n");

    const result = streamText({
      model: workersai("@cf/zai-org/glm-4.7-flash"),
      system: `You are the assistant for the Doo programming language — a statically typed language with a Rust/LLVM compiler toolchain.

Answer questions about Doo's syntax, type system, standard library, FFI, web framework, and tooling.

Rules:
- Ground answers in the retrieved documentation provided below, or in results from the search_doo_docs tool.
- If neither covers the question, say so. Never invent Doo syntax.
- Use fenced code blocks tagged "doo" for code examples.

 ${getSchedulePrompt({ date: new Date() })}

Initial retrieved documentation for the user's latest message:
 ${seedContext}`,
      messages: pruneMessages({
        messages: await convertToModelMessages(this.messages),
        toolCalls: "before-last-2-messages",
        reasoning: "before-last-message"
      }),
      tools: {
        ...mcpTools,

        search_doo_docs: tool({
          description:
            "Search the Doo programming language documentation semantically. Use this when the initial context seems insufficient or the user asks about a different topic. Pass query as a plain string, NOT nested JSON.",
          inputSchema: z.object({
            query: z
              .string()
              .describe("What to search the Doo docs for, as plain text")
          }),
          execute: async ({ query }) => {
            return this.safeTool("search_doo_docs", async () => {
              const cleaned = query
                .replace(/[{}"]/g, " ")
                .replace(/\s+/g, " ")
                .trim();
              const embedding = await this.embed(cleaned);
              const results = await this.env.VECTORIZE.query(embedding, {
                topK: 5,
                returnMetadata: true
              });
              const matches = results.matches ?? [];
              if (matches.length === 0) {
                return {
                  results: [],
                  note: "No matching documentation found."
                };
              }
              return {
                results: matches.map((m) => ({
                  source: m.metadata?.source ?? "unknown",
                  score: m.score ?? 0,
                  text: m.metadata?.text ?? ""
                }))
              };
            });
          }
        }),

        list_doc_sources: tool({
          description:
            "List every documentation file available in the Doo docs corpus.",
          inputSchema: z.object({}),
          execute: async () => {
            // Embed a neutral probe and read distinct sources from metadata.
            const probe = await this.embed("doo language documentation");
            const results = await this.env.VECTORIZE.query(probe, {
              topK: 29,
              returnMetadata: true
            });
            const sources = new Set<string>();
            for (const m of results.matches ?? []) {
              sources.add(String(m.metadata?.source ?? "unknown"));
            }
            return { sources: [...sources].sort() };
          }
        }),

        report_doc_issue: tool({
          description:
            "Report a problem with the Doo documentation (inaccuracy, missing topic, broken example). Requires user approval before submitting.",
          inputSchema: z.object({
            source: z.string().describe("Documentation file the issue is in"),
            description: z.string().describe("What is wrong or missing")
          }),
          needsApproval: async () => true,
          execute: async ({ source, description }) => {
            console.log(`Doc issue reported: [${source}] ${description}`);
            return {
              submitted: true,
              source,
              description
            };
          }
        }),

        scheduleTask: tool({
          description: "Schedule a task to be executed at a later time.",
          inputSchema: scheduleSchema,
          execute: async ({ when, description }) => {
            if (when.type === "no-schedule")
              return "Not a valid schedule input";
            const input =
              when.type === "scheduled"
                ? when.date
                : when.type === "delayed"
                  ? when.delayInSeconds
                  : when.type === "cron"
                    ? when.cron
                    : null;
            if (!input) return "Invalid schedule type";
            try {
              this.schedule(input, "executeTask", description, {
                idempotent: true
              });
              return `Task scheduled: "${description}" (${when.type}: ${input})`;
            } catch (error) {
              return `Error scheduling task: ${error}`;
            }
          }
        }),

        getScheduledTasks: tool({
          description: "List all tasks that have been scheduled",
          inputSchema: z.object({}),
          execute: async () => {
            const tasks = this.getSchedules();
            return tasks.length > 0 ? tasks : "No scheduled tasks found.";
          }
        }),

        cancelScheduledTask: tool({
          description: "Cancel a scheduled task by its ID",
          inputSchema: z.object({
            taskId: z.string().describe("The ID of the task to cancel")
          }),
          execute: async ({ taskId }) => {
            try {
              this.cancelSchedule(taskId);
              return `Task ${taskId} cancelled.`;
            } catch (error) {
              return `Error cancelling task: ${error}`;
            }
          }
        })
      },
      stopWhen: stepCountIs(8),
      maxRetries: 2,
      experimental_repairToolCall: async ({ toolCall }) => {
        const raw =
          typeof toolCall.input === "string"
            ? toolCall.input
            : JSON.stringify(toolCall.input ?? {});

        if (toolCall.toolName === "search_doo_docs") {
          // unwrap nested/duplicated JSON, pull out plain text
          let cleaned = raw;
          // try unwrapping one level of nested JSON first
          try {
            const parsed = JSON.parse(raw);
            if (typeof parsed?.query === "string") cleaned = parsed.query;
          } catch {
            // fall through to regex strip
          }
          cleaned = cleaned
            .replace(/[{}"[\]]/g, " ")
            .replace(/\s+/g, " ")
            .trim();
          return {
            type: "tool-call" as const,
            toolCallId: toolCall.toolCallId,
            toolName: toolCall.toolName,
            input: JSON.stringify({ query: cleaned || "doo language" })
          };
        }
        return null;
      },
      abortSignal: options?.abortSignal
    });

    return result.toUIMessageStreamResponse();
  }

  async executeTask(description: string, _task: Schedule<string>) {
    this.broadcast(
      JSON.stringify({
        type: "scheduled-task",
        description,
        timestamp: new Date().toISOString()
      })
    );
  }
}

export default {
  async fetch(request: Request, env: Env) {
    return (
      (await routeAgentRequest(request, env)) ||
      new Response("Not found", { status: 404 })
    );
  }
} satisfies ExportedHandler<Env>;
