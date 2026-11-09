'use client'

import { useEffect, useRef, useState, type ElementType, type ReactNode } from 'react'

// Heavy fade-up when the element enters the viewport (IntersectionObserver, no scroll listeners).
export function Reveal({
  children,
  as: Tag = 'div',
  delay = 0,
  className = '',
  once = true,
}: {
  children: ReactNode
  as?: ElementType
  delay?: number
  className?: string
  once?: boolean
}) {
  const ref = useRef<HTMLElement>(null)
  const [shown, setShown] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setShown(true)
          if (once) io.disconnect()
        } else if (!once) setShown(false)
      },
      { rootMargin: '0px 0px -12% 0px', threshold: 0.08 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [once])
  return (
    <Tag ref={ref} data-shown={shown} className={`reveal ${className}`} style={{ ['--delay' as string]: `${delay}ms` }}>
      {children}
    </Tag>
  )
}

// Same observer, exposed as a hook for components that animate their own parts.
export function useInView<T extends HTMLElement>(margin = '0px 0px -20% 0px', threshold = 0.15) {
  const ref = useRef<T>(null)
  const [inView, setInView] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { rootMargin: margin, threshold })
    io.observe(el)
    return () => io.disconnect()
  }, [margin, threshold])
  return [ref, inView] as const
}
