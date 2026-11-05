import type { Metadata } from 'next'
import { DemoPage } from '@/components/DemoPage'

// Shared for feedback: built for contractors, no firm name, no prices or pilot offer.
export const metadata: Metadata = { title: 'Vera · back office for contractors' }

export default function Page() {
  return <DemoPage firm="" audience="review" />
}
