import type { Metadata, Viewport } from 'next'
import { Walk } from '@/components/walk/Walk'

// Desk 05: the engineer's walk page. Opened from the link Vera sends on WhatsApp (#t=<signed token>).
// Without a token it runs as a demo on the sample checklist and sends nothing.
export const metadata: Metadata = { title: 'Vera · site walk', robots: { index: false, follow: false } }
export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover', themeColor: '#f6f1e7' }

export default function Page() {
  return <Walk />
}
