'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'

const LINKS = [
  { href: '/', label: 'Overview' },
  { href: '/staffing', label: 'Staffing summary' },
  { href: '/ask', label: 'Ask HR' },
]
const EASE = 'ease-[cubic-bezier(0.32,0.72,0,1)]'

// Floating island nav. On phones the two-line icon morphs into an X and opens a full-screen sheet.
export function Nav() {
  const path = usePathname()
  const [open, setOpen] = useState(false)
  useEffect(() => {
    document.documentElement.style.overflow = open ? 'hidden' : ''
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])
  return (
    <>
      <header className="pointer-events-none fixed inset-x-0 top-0 z-40 flex justify-center px-4 pt-4 md:pt-6">
        <nav className="pointer-events-auto flex w-full max-w-max items-center gap-1 rounded-full bg-card/80 p-1.5 pl-5 shadow-[0_12px_40px_-18px_rgba(16,40,40,0.35)] ring-1 ring-ink/[0.07] backdrop-blur-xl">
          <Link href="/" className="mr-2 flex items-baseline gap-2 text-ink">
            <span className="text-[15px] font-semibold tracking-tight">White Lotus</span>
            <span className="serif text-[15px] text-teal">× Vera</span>
          </Link>
          <ul className="hidden items-center md:flex">
            {LINKS.map((l) => {
              const on = path === l.href
              return (
                <li key={l.href}>
                  <Link href={l.href} className={`rounded-full px-3.5 py-2 text-[13px] transition-colors duration-500 ${EASE} ${on ? 'bg-ink text-white' : 'text-ink-2 hover:bg-ink/[0.05] hover:text-ink'}`}>
                    {l.label}
                  </Link>
                </li>
              )
            })}
          </ul>
          <button
            type="button"
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
            onClick={() => setOpen((o) => !o)}
            className="relative ml-auto flex h-10 w-10 items-center justify-center rounded-full bg-ink/[0.05] md:hidden"
          >
            <span className={`absolute h-px w-4 bg-ink transition-transform duration-500 ${EASE} ${open ? 'rotate-45' : '-translate-y-[4px]'}`} />
            <span className={`absolute h-px w-4 bg-ink transition-transform duration-500 ${EASE} ${open ? '-rotate-45' : 'translate-y-[4px]'}`} />
          </button>
        </nav>
      </header>
      <div className={`fixed inset-0 z-30 bg-ground/85 backdrop-blur-3xl transition-opacity duration-700 ${EASE} md:hidden ${open ? 'opacity-100' : 'pointer-events-none opacity-0'}`} aria-hidden={!open}>
        <ul className="flex h-full flex-col justify-center gap-2 px-8">
          {LINKS.map((l, i) => (
            <li key={l.href} className="overflow-hidden">
              <Link
                href={l.href}
                onClick={() => setOpen(false)}
                tabIndex={open ? 0 : -1}
                className={`block py-2 text-4xl font-medium tracking-tight text-ink transition-all duration-700 ${EASE} ${open ? 'translate-y-0 opacity-100' : 'translate-y-12 opacity-0'}`}
                style={{ transitionDelay: open ? `${100 + i * 60}ms` : '0ms' }}
              >
                {l.label}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </>
  )
}
