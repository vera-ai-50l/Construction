'use client'

import { useEffect, useRef, useState } from 'react'

// A number that eases to its new value instead of jumping. Only the text changes, so no layout work.
export function Count({ value, decimals = 0, prefix = '', suffix = '', ms = 900, className = '', mono = true }: { value: number; decimals?: number; prefix?: string; suffix?: string; ms?: number; className?: string; mono?: boolean }) {
  const [shown, setShown] = useState(value)
  const from = useRef(value)
  const raf = useRef(0)
  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const start = performance.now()
    const a = from.current
    const tick = (t: number) => {
      const k = reduce ? 1 : Math.min(1, (t - start) / ms)
      const e = 1 - Math.pow(1 - k, 4)
      const v = a + (value - a) * e
      setShown(v)
      from.current = v
      if (k < 1) raf.current = requestAnimationFrame(tick)
    }
    cancelAnimationFrame(raf.current)
    raf.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf.current)
  }, [value, ms])
  const text = shown.toLocaleString('en-GB', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
  return (
    <span className={`${mono ? 'num' : 'tabular-nums'} ${className}`}>
      {prefix}
      {text}
      {suffix}
    </span>
  )
}

