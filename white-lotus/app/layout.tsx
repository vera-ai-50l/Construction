import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono, Instrument_Serif } from 'next/font/google'
import './globals.css'

const geist = Geist({ subsets: ['latin'], variable: '--font-geist', display: 'swap' })
const geistMono = Geist_Mono({ subsets: ['latin'], variable: '--font-geist-mono', display: 'swap' })
const instrument = Instrument_Serif({ subsets: ['latin'], weight: '400', style: 'italic', variable: '--font-instrument', display: 'swap' })

export const metadata: Metadata = {
  title: 'White Lotus × Vera: staffing, HR assistant, recruitment and weekly report',
  description: 'Working demos for White Lotus International Hospital: a daily ward staffing summary, an HR assistant that answers from approved policy, a recruitment assistant, and a weekly report.',
  robots: { index: false, follow: false },
}

export const viewport: Viewport = { themeColor: '#f6f7f7', width: 'device-width', initialScale: 1 }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-IN" className={`${geist.variable} ${geistMono.variable} ${instrument.variable}`}>
      <body>{children}</body>
    </html>
  )
}
