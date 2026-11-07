'use client'

// Desk 05: QR stickers for rooms and areas GPS cannot place (indoors, under slabs, upper floors).
// Each code is signed by the walk API, so it cannot be made up and only counts on its own site.
// Scanning one with the phone camera opens the walk page, which records the scan with the time
// and GPS, and places photos in that area for the next few minutes.

import { useEffect, useState } from 'react'
import QRCode from 'qrcode'

type Sticker = { area: string; n: number; code: string; svg?: string }
const API = process.env.NEXT_PUBLIC_VERA_N8N_URL ? process.env.NEXT_PUBLIC_VERA_N8N_URL.replace(/\/$/, '') + '/webhook/vera/mob/walk' : ''
const AREA_NAMES: Record<string, string> = { DR: 'Drawings', LC: 'Labour camp', SY: 'Stores yard', BP: 'Batching plant', FW: 'Formwork', SF: 'Safety' }

export function Stickers() {
  const [project, setProject] = useState('')
  const [stickers, setStickers] = useState<Sticker[]>([])
  const [per, setPer] = useState(4)
  const [error, setError] = useState('')
  const [demo, setDemo] = useState(false)

  useEffect(() => {
    let token = ''
    try { token = new URLSearchParams(location.hash.slice(1)).get('t') || localStorage.getItem('vera-walk-token') || '' } catch {}
    const draw = async (p: string, list: Sticker[]) => {
      const base = location.origin + '/walk#s='
      const withSvg = await Promise.all(list.map(async (s) => ({ ...s, svg: await QRCode.toString(base + s.code, { type: 'svg', margin: 1, errorCorrectionLevel: 'M' }) })))
      setProject(p)
      setStickers(withSvg)
    }
    if (!token || !API) {
      setDemo(true)
      const areas = ['LC', 'SY', 'BP', 'FW', 'SF']
      draw('Sample Tower B, Thane', areas.flatMap((a) => Array.from({ length: per }, (_, i) => ({ area: a, n: i + 1, code: '0.' + a + '.' + (i + 1) + '.demo' }))))
      return
    }
    fetch(API, { method: 'POST', headers: { 'content-type': 'application/json', 'x-vera-walk': token }, body: JSON.stringify({ action: 'stickers', per_area: per }) })
      .then(async (r) => {
        if (r.status === 401) throw new Error('The walk link on this phone has expired. Ask Vera on WhatsApp for a new one.')
        if (!r.ok) throw new Error('Could not make the stickers (' + r.status + ').')
        const j = await r.json()
        await draw(j.project, j.stickers || [])
      })
      .catch((e) => setError(e.message))
  }, [per])

  return (
    <main className="mx-auto min-h-dvh max-w-4xl bg-paper px-4 py-6 text-ink print:bg-white print:p-0">
      <div className="print:hidden">
        <h1 className="font-display text-2xl">QR stickers{project ? ': ' + project : ''}</h1>
        <p className="mt-2 max-w-prose text-sm text-ink-2">
          Stick one at the door of each room or area that GPS cannot place: rooms in the labour camp, the site lab, the cement shed, upper floors.
          On the visit, scan it with the phone camera. Photos taken in the next 15 minutes are placed in that area. The scan is recorded with its time and GPS.
        </p>
        <p className="mt-2 max-w-prose text-sm text-ink-3">A sticker proves someone with the walk link scanned it; a photo of the sticker could be scanned elsewhere. GPS and time are kept with every scan so a mismatch shows up in the report.</p>
        {demo && <p className="mt-3 rounded-md bg-ochre-2 px-3 py-2 text-xs text-ink-2">Sample stickers. The real ones are signed for your site when you open this from your walk link.</p>}
        {error && <p className="mt-3 rounded-md bg-rust/10 px-3 py-2 text-sm text-rust">{error}</p>}
        <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
          <label htmlFor="per">Stickers per area</label>
          <select id="per" value={per} onChange={(e) => setPer(Number(e.target.value))} className="rounded-md bg-card px-2 py-1 ring-1 ring-line">
            {[2, 4, 6, 8, 12].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
          <button onClick={() => window.print()} className="rounded-lg bg-espresso px-4 py-2 text-paper">Print (A4)</button>
        </div>
      </div>
      <ul className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 print:mt-0 print:grid-cols-3 print:gap-0">
        {stickers.map((s) => (
          <li key={s.code} className="flex break-inside-avoid flex-col items-center rounded-lg bg-white p-3 text-center text-black ring-1 ring-line print:rounded-none print:ring-black/30">
            <div className="w-full max-w-[180px]" dangerouslySetInnerHTML={{ __html: s.svg || '' }} />
            <p className="mt-1 text-sm font-semibold">{AREA_NAMES[s.area] || s.area} · {s.n}</p>
            <p className="text-[10px] text-black/60">{project} · Vera</p>
          </li>
        ))}
      </ul>
    </main>
  )
}
