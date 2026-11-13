'use client'

import { useEffect, useRef, useState, type ElementType, type ReactNode } from 'react'

// Heavy fade-up when the element enters the viewport (IntersectionObserver, no scroll listeners).
export function Reveal({ children, as: Tag = 'div', delay = 0, className = '' }: { children: ReactNode; as?: ElementType; delay?: number; className?: string }) {
  const ref = useRef<HTMLElement>(null)
  const [shown, setShown] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setShown(true)
          io.disconnect()
        }
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])
  return (
    <Tag ref={ref} data-shown={shown} className={`reveal ${className}`} style={{ ['--delay' as string]: `${delay}ms` }}>
      {children}
    </Tag>
  )
}
