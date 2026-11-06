import { ArrowUpRight } from '@phosphor-icons/react/dist/ssr'
import type { ReactNode } from 'react'

// Pill CTA with the arrow nested in its own island; it nudges up-right on hover.
export function PillButton({
  href,
  children,
  variant = 'dark',
  external = false,
}: {
  href: string
  children: ReactNode
  variant?: 'dark' | 'light'
  external?: boolean
}) {
  const v =
    variant === 'dark'
      ? 'bg-ink-2 text-white hover:bg-ink'
      : 'bg-card text-ink ring-1 ring-ink/10 hover:ring-ink/20'
  const dot = variant === 'dark' ? 'bg-white/15' : 'bg-ink/[0.08]'
  return (
    <a
      href={href}
      {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
      className={`group inline-flex items-center gap-3 rounded-full py-2 pl-6 pr-2 text-sm font-medium transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-[0.98] ${v}`}
    >
      <span>{children}</span>
      <span
        className={`flex h-8 w-8 items-center justify-center rounded-full transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:-translate-y-[1px] group-hover:translate-x-1 group-hover:scale-105 ${dot}`}
      >
        <ArrowUpRight size={14} weight="light" />
      </span>
    </a>
  )
}
