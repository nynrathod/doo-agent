// One-time corpus indexer: docs/*.md → embeddings → Vectorize doo-docs.
// Usage: ACCOUNT_ID=... API_TOKEN=... node scripts/embed.mjs
import { readdir, readFile } from 'node:fs/promises'
import { readFileSync } from 'node:fs'

if (process.env.ACCOUNT_ID === undefined || process.env.API_TOKEN === undefined) {
  try {
    for (const line of readFileSync('.env', 'utf8').split('\n')) {
      const match = line.match(/^\s*([A-Z_]+)\s*=\s*(.+)\s*$/)
      if (match) process.env[match[1]] ??= match[2]
    }
  } catch {}
}

const ACCOUNT_ID = process.env.ACCOUNT_ID
const API_TOKEN = process.env.API_TOKEN
const INDEX_NAME = 'doo-docs'
const EMBED_MODEL = '@cf/baai/bge-base-en-v1.5'

const AI_URL = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/ai/run/${EMBED_MODEL}`
const VS_URL = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/vectorize/v2/indexes/${INDEX_NAME}`

const CHUNK_SIZE = 2000

function chunkText(text, size) {
  const paragraphs = text.split(/\n\s*\n/)
  const chunks = []
  let current = ''
  for (const p of paragraphs) {
    if ((current + '\n\n' + p).length > size && current) {
      chunks.push(current.trim())
      current = p
    } else {
      current = current ? `${current}\n\n${p}` : p
    }
  }
  if (current.trim()) chunks.push(current.trim())
  return chunks
}

const files = (await readdir('docs')).filter((f) => f.endsWith('.md'))
const vectors = []

for (const file of files) {
  const content = await readFile(`docs/${file}`, 'utf8')
  const chunks = chunkText(content, CHUNK_SIZE)
  console.log(`${file}: ${chunks.length} chunks`)

  for (let i = 0; i < chunks.length; i += 100) {
    const batch = chunks.slice(i, i + 100)
    const res = await fetch(AI_URL, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${API_TOKEN}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ text: batch }),
    })
    const json = await res.json()
    if (!json.success)
      throw new Error(`Embedding failed for ${file}: ${JSON.stringify(json.errors)}`)
    const embeddings = json.result.data

    batch.forEach((chunk, j) => {
      vectors.push({
        id: `${file}:chunk-${i + j}`,
        values: embeddings[j],
        metadata: { source: file, text: chunk },
      })
    })
  }
}

for (let i = 0; i < vectors.length; i += 500) {
  const res = await fetch(`${VS_URL}/upsert`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${API_TOKEN}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ vectors: vectors.slice(i, i + 500) }),
  })
  const json = await res.json()
  if (!json.success) throw new Error(`Upsert failed: ${JSON.stringify(json.errors)}`)
  console.log(`Upserted ${Math.min(i + 500, vectors.length)}/${vectors.length}`)
}

console.log(`Done: ${files.length} files, ${vectors.length} vectors`)
