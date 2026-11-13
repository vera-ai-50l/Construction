import { NextResponse } from 'next/server'
import { ask } from '@/lib/answer'

export const runtime = 'nodejs'
export const maxDuration = 60

// Best-effort limit for a public demo: per server instance, per IP.
const hits = new Map<string, number[]>()
const LIMIT = 30
const WINDOW_MS = 60 * 60 * 1000

export async function POST(req: Request) {
  const ip = (req.headers.get('x-forwarded-for') ?? 'local').split(',')[0].trim()
  const now = Date.now()
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS)
  if (recent.length >= LIMIT) {
    return NextResponse.json({ error: 'Too many questions from this connection. Please try again in an hour.' }, { status: 429 })
  }
  hits.set(ip, [...recent, now])

  let body: { question?: unknown; previous?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Send JSON: { "question": "..." }' }, { status: 400 })
  }
  const question = typeof body.question === 'string' ? body.question.trim() : ''
  const previous = typeof body.previous === 'string' ? body.previous.trim().slice(0, 300) : undefined
  if (!question) return NextResponse.json({ error: 'Ask a question.' }, { status: 400 })
  if (question.length > 400) return NextResponse.json({ error: 'Please keep the question under 400 characters.' }, { status: 400 })

  const result = await ask(question, previous)
  if (result.mode === 'handover') console.log('handover', JSON.stringify({ question, reason: result.handover?.reason }))
  return NextResponse.json(result)
}
