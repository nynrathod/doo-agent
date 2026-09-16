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

  private get sessionId(): string {
    return this.name
  }

  onStart() {
    this.env.DB.prepare('INSERT OR IGNORE INTO chat_sessions (id, started_at) VALUES (?, ?)')
      .bind(this.sessionId, new Date().toISOString())
      .run()
      .catch((e) => console.error('chat_sessions insert failed:', e))
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

  private async safeTool<T>(name: string, fn: () => Promise<T>): Promise<T | { error: string }> {
    try {
      return await fn()
    } catch (e) {
      return { error: `Tool ${name} failed: ${String(e)}` }
    }
  }

  private async embed(text: string): Promise<number[]> {
    const result = (await this.env.AI.run('@cf/baai/bge-base-en-v1.5', {
      text: [text],
    })) as { data: number[][] }
    return result.data[0]
  }

  async onChatMessage(_onFinish: unknown, options?: OnChatMessageOptions) {
    const enabled = await this.env.FLAGS.get('agent_enabled')
    if (enabled !== 'true') {
      return new Response(
        JSON.stringify({
          error: 'The Doo agent is temporarily disabled for maintenance.',
        }),
        { status: 503, headers: { 'content-type': 'application/json' } }
      ) as unknown as ReturnType<typeof streamText> extends never ? never : Response
    }

    const mcpTools = this.mcp.getAITools()
    const workersai = createWorkersAI({
      binding: this.env.AI,
      gateway: {
        id: 'doo-agent-gateway',
        cacheKey: 'doo-agent',
      },
    })

    const lastUser = [...this.messages].reverse().find((m) => m.role === 'user')
    const lastUserText =
      lastUser?.parts
        ?.filter((p) => p.type === 'text')
        .map((p) => (p as { text: string }).text)
        .join(' ') ?? ''

    await this.env.DB.prepare(
      'INSERT INTO chat_messages (session_id, role, content, created_at) VALUES (?, ?, ?, ?)'
    )
      .bind(this.sessionId, 'user', lastUserText, new Date().toISOString())
      .run()

    const count = await this.env.DB.prepare(
      'SELECT COUNT(*) as c FROM chat_messages WHERE session_id = ?'
    )
      .bind(this.sessionId)
      .first<{ c: number }>()

    if (count && count.c === 10) {
      await this.env.DB.prepare(
        'UPDATE chat_sessions SET ended_at = ? WHERE id = ? AND ended_at IS NULL'
      )
        .bind(new Date().toISOString(), this.sessionId)
        .run()
      await this.env.SUMMARY_QUEUE.send({ sessionId: this.sessionId })
    }

    const lastUserEmbedding = await this.embed(lastUserText)
    const seedResults = await this.env.VECTORIZE.query(lastUserEmbedding, {
      topK: 5,
      returnMetadata: true,
    })
    const seedContext = (seedResults.matches ?? [])
      .map((m) => `--- [${m.metadata?.source ?? 'unknown'}] ---\n${m.metadata?.text ?? ''}`)
      .join('\n\n')

    const result = streamText({
      model: workersai('@cf/zai-org/glm-4.7-flash'),
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
        toolCalls: 'before-last-2-messages',
        reasoning: 'before-last-message',
      }),
      tools: {
        ...mcpTools,

        search_doo_docs: tool({
          description:
            'Search the Doo programming language documentation semantically. Use this when the initial context seems insufficient or the user asks about a different topic. Pass query as a plain string, NOT nested JSON.',
          inputSchema: z.object({
            query: z.string().describe('What to search the Doo docs for, as plain text'),
          }),
          execute: async ({ query }) => {
            return this.safeTool('search_doo_docs', async () => {
              const cleaned = query.replace(/[{}"]/g, ' ').replace(/\s+/g, ' ').trim()
              const embedding = await this.embed(cleaned)
              const results = await this.env.VECTORIZE.query(embedding, {
                topK: 5,
                returnMetadata: true,
              })
              const matches = results.matches ?? []
              if (matches.length === 0) {
                return {
                  results: [],
                  note: 'No matching documentation found.',
                }
              }
              return {
                results: matches.map((m) => ({
                  source: m.metadata?.source ?? 'unknown',
                  score: m.score ?? 0,
                  text: m.metadata?.text ?? '',
                })),
              }
            })
          },
        }),

        list_doc_sources: tool({
          description: 'List every documentation file available in the Doo docs corpus.',
          inputSchema: z.object({}),
          execute: async () => {
            // Embed a neutral probe and read distinct sources from metadata.
            const probe = await this.embed('doo language documentation')
            const results = await this.env.VECTORIZE.query(probe, {
              topK: 29,
              returnMetadata: true,
            })
            const sources = new Set<string>()
            for (const m of results.matches ?? []) {
              sources.add(String(m.metadata?.source ?? 'unknown'))
            }
            return { sources: [...sources].sort() }
          },
        }),

        report_doc_issue: tool({
          description:
            'Report a problem with the Doo documentation (inaccuracy, missing topic, broken example). Requires user approval before submitting.',
          inputSchema: z.object({
            source: z.string().describe('Documentation file the issue is in'),
            description: z.string().describe('What is wrong or missing'),
          }),
          needsApproval: async () => true,
          execute: async ({ source, description }) => {
            console.log(`Doc issue reported: [${source}] ${description}`)
            return {
              submitted: true,
              source,
              description,
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
      stopWhen: stepCountIs(8),
      maxRetries: 2,
      experimental_repairToolCall: async ({ toolCall }) => {
        const raw =
          typeof toolCall.input === 'string' ? toolCall.input : JSON.stringify(toolCall.input ?? {})

        if (toolCall.toolName === 'search_doo_docs') {
          // unwrap nested/duplicated JSON, pull out plain text
          let cleaned = raw
          // try unwrapping one level of nested JSON first
          try {
            const parsed = JSON.parse(raw)
            if (typeof parsed?.query === 'string') cleaned = parsed.query
          } catch {
            // fall through to regex strip
          }
          cleaned = cleaned
            .replace(/[{}"[\]]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
          return {
            type: 'tool-call' as const,
            toolCallId: toolCall.toolCallId,
            toolName: toolCall.toolName,
            input: JSON.stringify({ query: cleaned || 'doo language' }),
          }
        }
        return null
      },
      abortSignal: options?.abortSignal,
    })

    return result.toUIMessageStreamResponse()
  }

  async executeTask(description: string, _task: Schedule<string>) {
    this.broadcast(
      JSON.stringify({
        type: 'scheduled-task',
        description,
        timestamp: new Date().toISOString(),
      })
    )
  }
}

async function embedForQuery(env: Env, text: string): Promise<number[]> {
  const result = (await env.AI.run('@cf/baai/bge-base-en-v1.5', {
    text: [text],
  })) as { data: number[][] }
  return result.data[0]
}

export default {
  async fetch(request: Request, env: Env) {
    const url = new URL(request.url)

    if (url.pathname === '/agents/summarize-test' && request.method === 'POST') {
      const { sessionId } = (await request.json()) as { sessionId: string }
      await env.SUMMARY_QUEUE.send({ sessionId })
      return new Response('queued')
    }

    if (url.pathname === '/agents/run-evals' && request.method === 'POST') {
      const auth = request.headers.get('x-eval-token')
      if (auth !== env.EVAL_TOKEN) {
        return new Response('Unauthorized', { status: 401 })
      }

      const CASES = [
        {
          id: 'loop-syntax',
          query: 'how to write a loop in doo',
          mustInclude: ['for', 'in'],
        },
        {
          id: 'variable',
          query: 'how to declare a variable in doo',
          mustInclude: ['let'],
        },
        {
          id: 'function',
          query: 'how to declare a function in doo',
          mustInclude: ['fn'],
        },
        {
          id: 'main',
          query: 'entry point of a doo program',
          mustInclude: ['main'],
        },
        { id: 'types-int', query: 'integer type in doo', mustInclude: ['Int'] },
        {
          id: 'types-string',
          query: 'string type in doo',
          mustInclude: ['Str'],
        },
        {
          id: 'array',
          query: 'how to create an array in doo',
          mustInclude: ['['],
        },
        {
          id: 'struct',
          query: 'define a struct in doo',
          mustInclude: ['struct'],
        },
        { id: 'enum', query: 'enums in doo', mustInclude: ['enum'] },
        {
          id: 'match',
          query: 'pattern matching in doo',
          mustInclude: ['match'],
        },
        {
          id: 'import',
          query: 'import modules in doo',
          mustInclude: ['import'],
        },
        {
          id: 'async',
          query: 'async functions in doo',
          mustInclude: ['async'],
        },
        {
          id: 'concurrency',
          query: 'run tasks concurrently in doo',
          mustInclude: ['go'],
        },
        { id: 'ffi', query: 'call C code from doo', mustInclude: ['@extern'] },
        {
          id: 'http',
          query: 'create an http server in doo',
          mustInclude: ['Server'],
        },
        {
          id: 'database',
          query: 'connect to postgres in doo',
          mustInclude: ['Database'],
        },
        {
          id: 'cli-run',
          query: 'how to run a doo program',
          mustInclude: ['doo run'],
        },
        {
          id: 'negative-mongodb',
          query: 'connect to mongodb in doo',
          mustNotInclude: ['Database::Mongo'],
        },
      ]

      const results = []
      let passed = 0
      for (const testCase of CASES) {
        const seed = await embedForQuery(env, testCase.query)
        const matches = await env.VECTORIZE.query(seed, {
          topK: 3,
          returnMetadata: true,
        })
        const context = (matches.matches ?? [])
          .map((m) => String(m.metadata?.text ?? ''))
          .join('\n\n')

        const answer = (await env.AI.run('@cf/zai-org/glm-4.7-flash', {
          messages: [
            {
              role: 'system',
              content: `You are the assistant for the Doo programming language. Answer from the documentation below. If not covered, say so. Never invent syntax.\n\n${context}`,
            },
            { role: 'user', content: testCase.query },
          ],
        })) as {
          response?: string
          choices?: { message?: { content?: string } }[]
        }

        const text = answer.response ?? answer.choices?.[0]?.message?.content ?? ''

        const includeOk = (testCase.mustInclude ?? []).every((k) =>
          text.toLowerCase().includes(k.toLowerCase())
        )
        const excludeOk = (testCase.mustNotInclude ?? []).every((k) => !text.includes(k))
        const ok = includeOk && excludeOk && text.length > 20
        console.log(`[eval] ${testCase.id}: ${ok ? 'PASS' : 'FAIL'}`)
        console.log(`[eval] ${testCase.id}: ${ok ? 'PASS' : 'FAIL'} (${text.length} chars)`)
        if (ok) passed++
        results.push({
          id: testCase.id,
          pass: ok,
          excerpt: text.slice(0, 120),
        })
      }

      return new Response(
        JSON.stringify(
          {
            total: CASES.length,
            passed,
            passRate: Math.round((passed / CASES.length) * 100),
            results,
          },
          null,
          2
        ),
        { headers: { 'content-type': 'application/json' } }
      )
    }

    return (await routeAgentRequest(request, env)) || new Response('Not found', { status: 404 })
  },

  async queue(batch: MessageBatch, env: Env) {
    for (const message of batch.messages) {
      const { sessionId } = message.body as { sessionId: string }
      try {
        const rows = await env.DB.prepare(
          'SELECT role, content FROM chat_messages WHERE session_id = ? ORDER BY id'
        )
          .bind(sessionId)
          .all<{ role: string; content: string }>()

        const transcript = (rows.results ?? [])
          .map((r) => `${r.role}: ${r.content}`)
          .join('\n')
          .slice(0, 8000)

        const summaryResult = (await env.AI.run('@cf/zai-org/glm-4.7-flash', {
          messages: [
            {
              role: 'system',
              content:
                'Summarize this documentation-assistant conversation in 2-3 sentences: topics asked, whether they were answered from the docs.',
            },
            { role: 'user', content: transcript },
          ],
        })) as {
          response?: string
          choices?: { message?: { content?: string } }[]
        }

        const summary = summaryResult.response ?? summaryResult.choices?.[0]?.message?.content ?? ''
        console.log('Summary raw output:', JSON.stringify(summaryResult).slice(0, 500))

        await env.DB.prepare('UPDATE chat_sessions SET summary = ? WHERE id = ?')
          .bind(summary || 'Summary generation returned empty', sessionId)
          .run()

        message.ack()
      } catch (e) {
        console.error('Summary job failed:', e)
        message.retry()
      }
    }
  },
} satisfies ExportedHandler<Env>
