import { createWorkersAI } from 'workers-ai-provider'
import { callable, routeAgentRequest, type Schedule } from 'agents'
import { getSchedulePrompt, scheduleSchema } from 'agents/schedule'
import { AIChatAgent, type OnChatMessageOptions } from '@cloudflare/ai-chat'
import { convertToModelMessages, pruneMessages, stepCountIs, streamText, tool } from 'ai'
import { z } from 'zod'

export class DooAgent extends AIChatAgent<Env> {
  maxPersistedMessages = 100
  chatRecovery = true
  // Wait for MCP connections to be re-established after hibernation before
  // processing a message, so MCP tools aren't intermittently missing.
  waitForMcpConnections = true

  onStart() {
    // Configure OAuth popup behavior for MCP servers that require authentication
    this.mcp.configureOAuthCallback({
      customHandler: (result) => {
        if (result.authSuccess) {
          return new Response('<script>window.close();</script>', {
            headers: { 'content-type': 'text/html' },
            status: 200,
          })
        }
        return new Response(`Authentication Failed: ${result.authError || 'Unknown error'}`, {
          headers: { 'content-type': 'text/plain' },
          status: 400,
        })
      },
    })
  }

  @callable()
  async addServer(name: string, url: string) {
    return await this.addMcpServer(name, url)
  }

  @callable()
  async removeServer(serverId: string) {
    await this.removeMcpServer(serverId)
  }

  private async retrieveContext(question: string): Promise<string> {
    const embedding = (await this.env.AI.run('@cf/baai/bge-base-en-v1.5', {
      text: [question],
    })) as { data: number[][] }

    const results = await this.env.VECTORIZE.query(embedding.data[0], {
      topK: 5,
      returnMetadata: true,
    })

    if (!results.matches || results.matches.length === 0) {
      return 'No relevant documentation found.'
    }

    return results.matches
      .map((m) => `--- [${m.metadata?.source ?? 'unknown'}] ---\n${m.metadata?.text ?? ''}`)
      .join('\n\n')
  }

  async onChatMessage(_onFinish: unknown, options?: OnChatMessageOptions) {
    const mcpTools = this.mcp.getAITools()
    const workersai = createWorkersAI({ binding: this.env.AI })

    const lastUser = [...this.messages].reverse().find((m) => m.role === 'user')
    const lastUserText =
      lastUser?.parts
        ?.filter((p) => p.type === 'text')
        .map((p) => (p as { text: string }).text)
        .join(' ') ?? ''

    const retrievedContext = await this.retrieveContext(lastUserText)

    const result = streamText({
      model: workersai('@cf/openai/gpt-oss-20b', {
        sessionAffinity: this.sessionAffinity,
      }),
      system: `You are the assistant for the Doo programming language — a statically typed language with a Rust/LLVM compiler toolchain.

Answer questions about Doo's syntax, type system, standard library, FFI, web framework, and tooling.

Rules:
- Ground every answer in the retrieved documentation below.
- If the retrieved documentation does not cover the question, say so. Never invent Doo syntax.
- Use fenced code blocks tagged "doo" for code examples.

 ${getSchedulePrompt({ date: new Date() })}

Retrieved documentation:
 ${retrievedContext}`,
      messages: pruneMessages({
        messages: await convertToModelMessages(this.messages),
        toolCalls: 'before-last-2-messages',
        reasoning: 'before-last-message',
      }),
      tools: {
        // MCP tools from connected servers
        ...mcpTools,

        // Server-side tool: runs automatically on the server
        getWeather: tool({
          description: 'Get the current weather for a city',
          inputSchema: z.object({ city: z.string() }),
          execute: async ({ city }) => {
            const conditions = ['sunny', 'cloudy', 'rainy', 'snowy']
            const temp = Math.floor(Math.random() * 30) + 5
            return {
              city,
              temperature: temp,
              condition: conditions[Math.floor(Math.random() * conditions.length)],
              unit: 'celsius',
            }
          },
        }),
        scheduleTask: tool({
          description: 'Schedule a task to be executed at a later time.',
          inputSchema: scheduleSchema,
          execute: async ({ when, description }) => {
            if (when.type === 'no-schedule') return 'Not a valid schedule input'
            const input =
              when.type === 'scheduled'
                ? when.date
                : when.type === 'delayed'
                  ? when.delayInSeconds
                  : when.type === 'cron'
                    ? when.cron
                    : null
            if (!input) return 'Invalid schedule type'
            try {
              this.schedule(input, 'executeTask', description, {
                idempotent: true,
              })
              return `Task scheduled: "${description}" (${when.type}: ${input})`
            } catch (error) {
              return `Error scheduling task: ${error}`
            }
          },
        }),

        getScheduledTasks: tool({
          description: 'List all tasks that have been scheduled',
          inputSchema: z.object({}),
          execute: async () => {
            const tasks = this.getSchedules()
            return tasks.length > 0 ? tasks : 'No scheduled tasks found.'
          },
        }),

        cancelScheduledTask: tool({
          description: 'Cancel a scheduled task by its ID',
          inputSchema: z.object({
            taskId: z.string().describe('The ID of the task to cancel'),
          }),
          execute: async ({ taskId }) => {
            try {
              this.cancelSchedule(taskId)
              return `Task ${taskId} cancelled.`
            } catch (error) {
              return `Error cancelling task: ${error}`
            }
          },
        }),
      },
      stopWhen: stepCountIs(20),
      abortSignal: options?.abortSignal,
    })

    return result.toUIMessageStreamResponse()
  }

  async executeTask(description: string, _task: Schedule<string>) {
    // Do the actual work here (send email, call API, etc.)
    console.log(`Executing scheduled task: ${description}`)

    // Notify connected clients via a broadcast event.
    // We use broadcast() instead of saveMessages() to avoid injecting
    // into chat history — that would cause the AI to see the notification
    // as new context and potentially loop.
    this.broadcast(
      JSON.stringify({
        type: 'scheduled-task',
        description,
        timestamp: new Date().toISOString(),
      })
    )
  }
}

export default {
  async fetch(request: Request, env: Env) {
    return (await routeAgentRequest(request, env)) || new Response('Not found', { status: 404 })
  },
} satisfies ExportedHandler<Env>
