import type { ReactNode } from 'react'

// Section label in the house style: a small red dot, then wide-tracked capitals. No pill.
export function Eyebrow({ children, tone = 'light', className = '' }: { children: ReactNode; tone?: 'light' | 'dark' | 'rust' | 'onred'; className?: string }) {
  const t = tone === 'dark' ? 'text-paper/70' : tone === 'onred' ? 'text-white' : tone === 'rust' ? 'text-rust' : 'text-ink-2'
  const dot = tone === 'onred' ? 'bg-white' : 'bg-rust'
  return (
    <span className={`inline-flex items-center gap-2.5 text-[11px] font-medium uppercase tracking-[0.28em] ${t} ${className}`}>
      <span aria-hidden className={`h-2 w-2 shrink-0 rounded-full ${dot}`} />
      {children}
    </span>
  )
}
