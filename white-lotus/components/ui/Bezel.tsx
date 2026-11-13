import type { ReactNode } from 'react'

// Double-bezel: a hairline tray holding a raised inner plate with concentric radii.
export function Bezel({ children, className = '', inner = '', tone = 'light' }: { children: ReactNode; className?: string; inner?: string; tone?: 'light' | 'dark' | 'teal' }) {
  const shell = tone === 'dark' ? 'bg-white/[0.04] ring-1 ring-white/10' : tone === 'teal' ? 'bg-teal/[0.07] ring-1 ring-teal/15' : 'bg-ink/[0.03] ring-1 ring-ink/[0.06]'
  const core =
    tone === 'dark'
      ? 'bg-night text-white shadow-[inset_0_1px_1px_rgba(255,255,255,0.08)]'
      : 'bg-card shadow-[inset_0_1px_1px_rgba(255,255,255,0.9),0_30px_60px_-34px_rgba(16,40,40,0.22),0_8px_22px_-14px_rgba(16,40,40,0.1)]'
  return (
    <div className={`rounded-[1.75rem] p-1.5 ${shell} ${className}`}>
      <div className={`h-full rounded-[calc(1.75rem-0.375rem)] ${core} ${inner}`}>{children}</div>
    </div>
  )
}
