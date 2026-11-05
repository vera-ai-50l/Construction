import type { ReactNode } from 'react'

export function Eyebrow({ children, tone = 'light', className = '' }: { children: ReactNode; tone?: 'light' | 'dark' | 'rust'; className?: string }) {
  const t =
    tone === 'dark'
      ? 'bg-white/[0.06] text-paper/70 ring-white/10'
      : tone === 'rust'
        ? 'bg-rust/10 text-rust ring-rust/15'
        : 'bg-ink/[0.04] text-ink-2 ring-ink/[0.07]'
  return (
    <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-[10px] font-medium uppercase tracking-[0.2em] ring-1 ${t} ${className}`}>
      {children}
    </span>
  )
}
