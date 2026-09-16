# Doo Agent

![CI](https://github.com/nynrathod/doo-agent/actions/workflows/ci.yml/badge.svg)


An AI assistant for the [Doo programming language](https://github.com/nynrathod/doolang).
Ask it anything about Doo — syntax, types, FFI, the web framework — and it answers
from the official documentation.

> **Work in progress:** This agent currently targets **Doo 0.4.3**. It is an experimental, playful project and should **not be considered the final or authoritative source for Doo documentation**. The agent may make mistakes or provide incomplete answers.

**Try it live:** https://doo-agent.nayanrathod23.workers.dev

## What it can do

* **Answers from real docs** — searches the Doo documentation and grounds every answer in it. If the docs don't cover your question, it says so instead of guessing.
* **Explains with code** — every answer includes working Doo code examples.
* **Reports doc issues** — found something wrong in the docs? Ask it to report an issue; it shows you the report for approval before submitting.
* **Remembers your session** — your conversation survives page refreshes.
* **Self-checks quality** — every code push runs an automated test suite against the agent; the badge above shows it passing.

## How it works

```text
You ──► Chat UI (React)
          │
          ▼
      Cloudflare Worker
          │
          ├── Durable Object ── your session memory
          ├── Vectorize ─────── semantic search over Doo docs
          ├── AI Gateway ────── model calls (logged, cached)
          ├── KV ────────────── feature flag (on/off switch)
          ├── D1 ────────────── chat history
          └── Queues ────────── background session summaries
```

Everything runs on Cloudflare's edge. No external services.

## The docs corpus

The agent's knowledge comes from 20 documentation files generated from the
Doo compiler's source, tests, and README — covering syntax, types, functions,
concurrency, FFI, the HTTP server, database layer, and more.

## Quality

An 18-case eval suite runs on every push. Each case asks the agent a real
question and checks the answer contains the expected syntax — plus a negative
case proving it won't invent APIs that don't exist (ask it about MongoDB).
Below 85% pass rate, the build fails.

## Stack

TypeScript · Cloudflare Workers · Agent SDK · Durable Objects · Vectorize ·
KV · D1 · Queues · AI Gateway · Workers AI · GitHub Actions

## License

MIT
