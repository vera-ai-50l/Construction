import { NextResponse } from 'next/server'
import { MODEL } from '@/lib/answer'

export const dynamic = 'force-dynamic'

// Tells the page whether AI wording is on, without exposing the key.
export function GET() {
  return NextResponse.json({ ai: Boolean(process.env.ANTHROPIC_API_KEY), model: MODEL })
}
