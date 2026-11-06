import type { ReactNode } from 'react'

// Double-bezel: a hairline tray holding a raised inner plate with concentric radii.
export function Bezel({
  children,
  className = '',
  inner = '',
  tone = 'light',
}: {
  children: ReactNode
  className?: string
  inner?: string
  tone?: 'light' | 'dark' | 'tint' | 'onred'
}) {
  const shell =
    tone === 'dark'
      ? 'bg-white/[0.04] ring-1 ring-white/10'
      : tone === 'onred'
        ? 'bg-white/[0.08] ring-1 ring-white/25'
        : tone === 'tint'
        ? 'bg-ochre-2/50 ring-1 ring-ink/[0.06]'
        : 'bg-ink/[0.035] ring-1 ring-ink/[0.06]'
  const core =
    tone === 'dark'
      ? 'bg-espresso text-paper shadow-[inset_0_1px_1px_rgba(255,255,255,0.08)]'
      : tone === 'onred'
        ? 'bg-white/[0.07] text-white shadow-[inset_0_1px_1px_rgba(255,255,255,0.2)]'
        : 'bg-card shadow-[inset_0_1px_1px_rgba(255,255,255,0.9),0_30px_60px_-30px_rgba(0,0,0,0.18),0_8px_24px_-12px_rgba(0,0,0,0.08)]'
  return (
    <div className={`rounded-[2rem] p-1.5 ${shell} ${className}`}>
      <div className={`h-full rounded-[calc(2rem-0.375rem)] ${core} ${inner}`}>{children}</div>
    </div>
  )
}
