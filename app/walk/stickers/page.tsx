import type { Metadata } from 'next'
import { Stickers } from '@/components/walk/Stickers'

// Desk 05: printable QR stickers for one site. The engineer opens this from the walk page
// (the walk token is on his phone); each sticker carries a signed code for one area.
export const metadata: Metadata = { title: 'Vera · site stickers', robots: { index: false, follow: false } }

export default function Page() {
  return <Stickers />
}
