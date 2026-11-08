import type { Metadata } from 'next'
import { DayDemo } from '@/components/day/DayDemo'

// Desk 05: the one-day mobilisation, step by step, with the messages the workflows produce.
export const metadata: Metadata = { title: 'Vera · one-day mobilisation', robots: { index: false, follow: false } }

export default function Page() {
  return <DayDemo />
}
