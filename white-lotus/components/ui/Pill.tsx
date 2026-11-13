import Link from 'next/link'
import type { ReactNode } from 'react'
import { Icon } from './icons'

const EASE = 'ease-[cubic-bezier(0.32,0.72,0,1)]'

// Pill CTA; the arrow sits in its own island and nudges up-right on hover.
export function Pill({ href, children, variant = 'dark', icon = 'ArrowUpRight' }: { href: string; children: ReactNode; variant?: 'dark' | 'light' | 'teal'; icon?: string }) {
  const v = variant === 'dark' ? 'bg-ink text-white' : variant === 'teal' ? 'bg-teal text-white' : 'bg-card text-ink ring-1 ring-ink/10 hover:ring-ink/20'
  const dot = variant === 'light' ? 'bg-ink/[0.06]' : 'bg-white/15'
  return (
    <Link href={href} className={`group inline-flex items-center gap-3 rounded-full py-2 pl-6 pr-2 text-sm font-medium transition-all duration-500 ${EASE} active:scale-[0.98] ${v}`}>
      <span>{children}</span>
      <span className={`flex h-8 w-8 items-center justify-center rounded-full transition-transform duration-500 ${EASE} group-hover:-translate-y-[1px] group-hover:translate-x-0.5 group-hover:scale-105 ${dot}`}>
        <Icon name={icon} size={14} />
      </span>
    </Link>
  )
}
