import type { Metadata } from 'next'
import { IpcPage } from '@/components/ipc/IpcPage'
import { runAll, type Sample } from '@/lib/ipc-flow.mjs'
import sample from '@/lib/ipc-sample.json'

export const metadata: Metadata = {
  title: 'Vera · IPC Compliance Kit',
  description: "One month of care-home infection-control returns, scored, actioned and filed for CQC. Run the flow and see the hours and pounds it gives back.",
  robots: { index: false, follow: false },
}

// The page's figures come from running the flow on the sample month at build time,
// so the headline numbers always match what "Run the flow" produces.
export default function Page() {
  const trace = runAll(sample as Sample)
  return <IpcPage out={trace[trace.length - 1]} />
}
