// The employee assistant's answer step. Retrieval picks the approved sections; Claude writes a
// short answer from those sections only, with citations; anything not covered goes to HR.

import Anthropic from '@anthropic-ai/sdk'
import { HR_CONTACT } from '@/content/policies'
import { MIN_SCORE, search, tokenize, type Hit } from '@/lib/rag'

export const MODEL = 'claude-opus-5-5'

export type Cite = { chunkId: string; policy: string; heading: string; quote: string }
export type Retrieved = Pick<Hit, 'id' | 'policyId' | 'policy' | 'heading' | 'version' | 'score' | 'matched' | 'text'>
export type Segment = { text: string; cites: Cite[] }
export type AskResult = {
  mode: 'ai' | 'passages' | 'handover'
  segments: Segment[]
  retrieved: Retrieved[]
  handover?: { to: string; ext: string; reason: string }
  note?: string
  model?: string
  ms: number
}

const SYSTEM = `You are the employee questions assistant for White Lotus International Hospital. Staff ask you about HR policy: leave, shifts, holidays, pay dates, uniforms, safety and similar.

Answer only from the policy documents provided with the question. They are the only documents HR has approved. Do not use outside knowledge, and do not guess or fill gaps.

If the documents do not answer the question, or the question needs someone's personal records (their own leave balance, salary, payslip, appraisal, disciplinary matter), reply with exactly one line that starts with "HANDOVER:" followed by a short reason, and nothing else. Where a document says how staff can see their own record (for example on the HRMS app), you may answer with that instead.

Write for a busy nurse reading on a phone: two to five short sentences, or a few "- " bullets for steps. Plain words, no headings, no bold, no tables. Answer in the language the question is written in. Never give medical advice beyond what a document states.`

const handoverTo = `${HR_CONTACT.name}, ${HR_CONTACT.role}`

function strip(h: Hit): Retrieved {
  return { id: h.id, policyId: h.policyId, policy: h.policy, heading: h.heading, version: h.version, score: h.score, matched: h.matched, text: h.text }
}

export async function ask(question: string, previous?: string): Promise<AskResult> {
  const t0 = Date.now()
  // A short follow-up ("and for nurses?") is searched together with the question before it.
  const query = previous && tokenize(question).length < 4 ? `${question} ${previous}` : question
  const hits = search(query, 4)
  const retrieved = hits.map(strip)

  if (!hits.length || hits[0].score < MIN_SCORE) {
    return {
      mode: 'handover',
      segments: [{ text: 'I could not find this in the approved HR documents, so I have passed your question to HR. They will reply to you directly.', cites: [] }],
      retrieved,
      handover: { to: handoverTo, ext: HR_CONTACT.ext, reason: 'Not covered by any approved document' },
      ms: Date.now() - t0,
    }
  }

  // Without an API key the demo still works: it shows the approved passages it found.
  if (!process.env.ANTHROPIC_API_KEY) {
    const top = hits.filter((h) => h.score >= hits[0].score * 0.8).slice(0, 2)
    return {
      mode: 'passages',
      segments: top.map((h) => ({ text: h.text, cites: [{ chunkId: h.id, policy: h.policy, heading: h.heading, quote: h.text }] })),
      retrieved,
      note: 'AI wording is off on this copy (no API key), so these are the approved passages that match your question, word for word.',
      ms: Date.now() - t0,
    }
  }

  const client = new Anthropic()
  const documents: Anthropic.Beta.BetaRequestDocumentBlock[] = hits.map((h) => ({
    type: 'document',
    source: { type: 'text', media_type: 'text/plain', data: h.text },
    title: `${h.policy}: ${h.heading}`,
    context: `${h.version}. Section id ${h.id}.`,
    citations: { enabled: true },
  }))

  try {
    const msg = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      // Opus 5.5 always thinks; low effort is enough for short policy look-ups.
      output_config: { effort: 'low' },
      // If a safety classifier declines, the API retries on a fallback model in the same call.
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system: SYSTEM,
      messages: [{ role: 'user', content: [...documents, { type: 'text', text: question }] }],
    })

    const texts = msg.content.filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text')
    const whole = texts.map((b) => b.text).join('').trim()

    if (msg.stop_reason === 'refusal' || whole.startsWith('HANDOVER:') || !whole) {
      const reason = whole.startsWith('HANDOVER:') ? whole.slice('HANDOVER:'.length).trim() : 'The assistant could not answer from approved documents'
      return {
        mode: 'handover',
        segments: [{ text: `This is not something I can answer from the approved HR documents, so I have passed it to HR. ${reason}`, cites: [] }],
        retrieved,
        handover: { to: handoverTo, ext: HR_CONTACT.ext, reason },
        model: msg.model,
        ms: Date.now() - t0,
      }
    }

    const segments: Segment[] = texts.map((b) => ({
      text: b.text,
      cites: (b.citations ?? [])
        .filter((c): c is Anthropic.Beta.BetaCitationCharLocation => c.type === 'char_location')
        .map((c) => {
          const h = hits[c.document_index]
          return { chunkId: h?.id ?? '', policy: h?.policy ?? '', heading: h?.heading ?? '', quote: c.cited_text.trim() }
        }),
    }))
    return { mode: 'ai', segments, retrieved, model: msg.model, ms: Date.now() - t0 }
  } catch (err) {
    // Model unavailable: fall back to the approved passages rather than leave the person waiting.
    const why =
      err instanceof Anthropic.AuthenticationError
        ? 'The API key was rejected.'
        : err instanceof Anthropic.RateLimitError
          ? 'The AI service is busy.'
          : err instanceof Anthropic.APIError
            ? `The AI service returned an error (${err.status}).`
            : 'The AI service could not be reached.'
    console.error('ask: model call failed', err)
    const top = hits.slice(0, 2)
    return {
      mode: 'passages',
      segments: top.map((h) => ({ text: h.text, cites: [{ chunkId: h.id, policy: h.policy, heading: h.heading, quote: h.text }] })),
      retrieved,
      note: `${why} Showing the matching approved passages instead.`,
      ms: Date.now() - t0,
    }
  }
}
