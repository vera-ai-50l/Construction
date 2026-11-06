'use client'

import { useEffect, useState } from 'react'
import { ArrowUpRight } from '@phosphor-icons/react'

type Link = { href: string; label: string }

// Floating island nav. On small screens the hamburger morphs into an X and opens a full-screen sheet.
export function Nav({ links, cta }: { links: Link[]; cta: Link }) {
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
        <nav className="pointer-events-auto flex w-full max-w-max items-center gap-1 rounded-full bg-card/75 p-1.5 pl-5 shadow-[0_10px_40px_-16px_rgba(0,0,0,0.35)] ring-1 ring-ink/[0.07] backdrop-blur-xl">
          <a href="#top" className="mr-3 flex items-center gap-2 text-[15px] font-medium tracking-tight text-ink">
            <span className="display text-xl leading-none">Vera</span>
            <span className="hidden text-[10px] uppercase tracking-[0.2em] text-ink-3 sm:inline">back office</span>
          </a>
          <ul className="hidden items-center md:flex">
            {links.map((l) => (
              <li key={l.href}>
                <a href={l.href} className="rounded-full px-3.5 py-2 text-[13px] text-ink-2 transition-colors duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] hover:bg-ink/[0.05] hover:text-ink">
                  {l.label}
                </a>
              </li>
            ))}
          </ul>
          <a
            href={cta.href}
            className="group ml-1 hidden items-center gap-2 rounded-full bg-ink-2 py-1.5 pl-4 pr-1.5 text-[13px] font-medium text-paper transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-[0.98] md:flex"
          >
            {cta.label}
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10 transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:-translate-y-[1px] group-hover:translate-x-0.5">
              <ArrowUpRight size={13} weight="light" />
            </span>
          </a>
          <button
            type="button"
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
            onClick={() => setOpen((o) => !o)}
            className="relative ml-auto flex h-10 w-10 items-center justify-center rounded-full bg-ink/[0.05] md:hidden"
          >
            <span className={`absolute h-px w-4 bg-ink transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] ${open ? 'rotate-45' : '-translate-y-[4px]'}`} />
            <span className={`absolute h-px w-4 bg-ink transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] ${open ? '-rotate-45' : 'translate-y-[4px]'}`} />
          </button>
        </nav>
      </header>

      <div
        className={`fixed inset-0 z-30 bg-paper/85 backdrop-blur-3xl transition-opacity duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] md:hidden ${open ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
        aria-hidden={!open}
      >
        <ul className="flex h-full flex-col justify-center gap-2 px-8">
          {[...links, cta].map((l, i) => (
            <li key={l.href} className="overflow-hidden">
              <a
                href={l.href}
                onClick={() => setOpen(false)}
                tabIndex={open ? 0 : -1}
                className={`display block py-2 text-4xl text-ink transition-all duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] ${open ? 'translate-y-0 opacity-100' : 'translate-y-12 opacity-0'}`}
                style={{ transitionDelay: open ? `${100 + i * 60}ms` : '0ms' }}
              >
                {l.label}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </>
  )
}
