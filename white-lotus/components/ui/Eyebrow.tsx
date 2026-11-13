import type { ReactNode } from 'react'

export function Eyebrow({ children, dark = false }: { children: ReactNode; dark?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-[10px] font-medium uppercase tracking-[0.22em] ring-1 ${dark ? 'bg-white/[0.06] text-white/70 ring-white/10' : 'bg-card text-ink-2 ring-ink/[0.07]'}`}>
      <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-teal" />
      {children}
    </span>
  )
}
