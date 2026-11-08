'use client'

// Desk 05 walk page: the engineer's phone on the visit day.
// Line first, then the photo: the photo is born on the line, so nobody tags anything.
// GPS is read from the phone with its own error radius; captures queue on the phone
// (IndexedDB) and are sent to the n8n walk API (WF-03) whenever there is signal.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import sample from '@/content/walk-sample.json'
import { SiteMap, type Shape } from './SiteMap'

type Line = { code: string; area: string; text: string; evidence: string; when: string; severity: string; hint?: string; status: string }
type Area = { code: string; name: string }
type Zone = { area: string; name: string; polygon?: number[][]; circle?: { lat: number; lng: number; radius_m: number } }
type Fix = { lat: number; lng: number; accuracy: number; ts: string }
type Capture = {
  capture_id: string; line: string; status: 'ok' | 'not_ok' | 'na' | 'photo'; remark: string; gps: Fix | null; client_ts: string; spot?: string
  photo_b64?: string; photo_mime?: string; audio_b64?: string; audio_mime?: string
  state: 'queued' | 'sent' | 'rejected'; geo?: { result: string; note: string }; error?: string
}
type Checklist = { project: string; visit_date: string; lines: Line[]; areas?: Area[]; zones: Zone[]; demo?: boolean }

const API = process.env.NEXT_PUBLIC_VERA_N8N_URL ? process.env.NEXT_PUBLIC_VERA_N8N_URL.replace(/\/$/, '') + '/webhook/vera/mob/walk' : ''
const AREA_NAMES: Record<string, string> = { PAP: 'Papers', DR: 'Drawings', LC: 'Labour camp', SY: 'Stores yard', BP: 'Batching plant', FW: 'Formwork', SF: 'Safety' }
const GOOD_M = 15
const WEAK_M = 40
const SPOT_MIN = 15 // a sticker scan places photos in its area for this many minutes

// The walk token is kept on the phone, so a QR sticker (which carries no token) can open
// this page and still be recorded against the engineer's walk.
type Spot = { code: string; area: string; at: number }
const store = {
  get: (k: string) => { try { return localStorage.getItem(k) } catch { return null } },
  set: (k: string, v: string) => { try { localStorage.setItem(k, v) } catch {} },
}
const lastSpot = (): Spot | null => { try { return JSON.parse(store.get('vera-walk-spot') || 'null') } catch { return null } }
const freshSpot = (area: string) => { const s = lastSpot(); return s && s.area === area && Date.now() - s.at < SPOT_MIN * 60000 ? s : null }

// ---------------------------------------------------------------- small IndexedDB queue
const DB = 'vera-walk'
function idb(): Promise<IDBDatabase | null> {
  return new Promise((res) => {
    try {
      const r = indexedDB.open(DB, 1)
      r.onupgradeneeded = () => r.result.createObjectStore('captures', { keyPath: 'capture_id' })
      r.onsuccess = () => res(r.result)
      r.onerror = () => res(null)
    } catch {
      res(null)
    }
  })
}
async function putCapture(c: Capture) {
  const db = await idb()
  if (!db) return
  await new Promise((r) => { const t = db.transaction('captures', 'readwrite'); t.objectStore('captures').put(c); t.oncomplete = r; t.onerror = r })
}
async function allCaptures(): Promise<Capture[]> {
  const db = await idb()
  if (!db) return []
  return new Promise((r) => { const q = db.transaction('captures').objectStore('captures').getAll(); q.onsuccess = () => r(q.result as Capture[]); q.onerror = () => r([]) })
}

// ---------------------------------------------------------------- geometry (same rule as logic.mjs geofence)
function place(fix: Fix | null, zones: Zone[], area: string) {
  const g = placeByGps(fix, zones, area)
  return freshSpot(area) ? { result: 'in', note: 'Sticker scanned here · ' + g.note } : g
}
function placeByGps(fix: Fix | null, zones: Zone[], area: string) {
  if (!fix) return { result: 'unknown', note: 'No GPS fix' }
  const z = zones.find((x) => x.area === area)
  if (!z) return { result: 'unknown', note: 'No area drawn for ' + (AREA_NAMES[area] || area) }
  const R = 6371000
  const xy = (lat: number, lng: number) => [((lng - fix.lng) * Math.PI / 180) * R * Math.cos(fix.lat * Math.PI / 180), ((lat - fix.lat) * Math.PI / 180) * R]
  let inside = false
  let edge = Infinity
  if (z.circle) {
    const c = xy(z.circle.lat, z.circle.lng)
    const d = Math.hypot(c[0], c[1]) - z.circle.radius_m
    inside = d <= 0
    edge = Math.abs(d)
  } else if (z.polygon) {
    const p = z.polygon.map(([a, b]) => xy(a, b))
    for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
      const [xi, yi] = p[i], [xj, yj] = p[j]
      if ((yi > 0) !== (yj > 0) && 0 < ((xj - xi) * -yi) / (yj - yi) + xi) inside = !inside
      const dx = xi - xj, dy = yi - yj
      const t = Math.max(0, Math.min(1, (-xj * dx - yj * dy) / (dx * dx + dy * dy || 1)))
      edge = Math.min(edge, Math.hypot(xj + t * dx, yj + t * dy))
    }
  }
  const slack = fix.accuracy + 10
  if (inside && (edge >= fix.accuracy || fix.accuracy <= GOOD_M)) return { result: 'in', note: 'Inside ' + z.name }
  if (inside || edge <= slack) return { result: 'edge', note: 'At the edge of ' + z.name + ' (±' + Math.round(fix.accuracy) + ' m)' }
  if (fix.accuracy > WEAK_M) return { result: 'unknown', note: 'GPS too weak (±' + Math.round(fix.accuracy) + ' m)' }
  return { result: 'out', note: Math.round(edge) + ' m outside ' + z.name }
}

// Shrink the photo before it is queued: 1600 px, JPEG 0.8 (a few hundred KB).
async function shrink(file: File): Promise<{ b64: string; mime: string }> {
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url })
    const k = Math.min(1, 1600 / Math.max(img.width, img.height))
    const c = document.createElement('canvas')
    c.width = Math.round(img.width * k)
    c.height = Math.round(img.height * k)
    c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height)
    const data = c.toDataURL('image/jpeg', 0.8)
    return { b64: data.split(',')[1], mime: 'image/jpeg' }
  } finally {
    URL.revokeObjectURL(url)
  }
}
const blobB64 = (b: Blob) => new Promise<string>((res) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1] || ''); r.readAsDataURL(b) })

const chip: Record<string, string> = {
  ok: 'bg-sage-2 text-sage', not_ok: 'bg-rust/10 text-rust', na: 'bg-paper-2 text-ink-3', open: 'bg-card text-ink-3 ring-1 ring-line',
  accepted: 'bg-sage-2 text-sage', filed: 'bg-ochre-2 text-ochre', review: 'bg-ochre-2 text-ochre', rejected: 'bg-rust/10 text-rust',
}
const label: Record<string, string> = { ok: 'OK', not_ok: 'Not OK', na: 'N/A', open: 'To check', accepted: 'Paper OK', filed: 'Photo in', review: 'Checking', rejected: 'Sent back' }
const geoTone: Record<string, string> = { in: 'text-sage', edge: 'text-ochre', out: 'text-rust', unknown: 'text-ink-3' }

// A sticker scan: remembered for SPOT_MIN minutes (photos of that area carry it) and queued
// for the walk API with the time; flush() sends it with the fix at that moment.
function takeSticker(code: string) {
  const a = code.split('.')[1] || ''
  store.set('vera-walk-spot', JSON.stringify({ code, area: a, at: Date.now() }))
  const pend = (() => { try { return JSON.parse(store.get('vera-walk-spots') || '[]') } catch { return [] } })()
  store.set('vera-walk-spots', JSON.stringify([...pend, { code, client_ts: new Date().toISOString() }].slice(-50)))
  return a
}

export function Walk() {
  const [token, setToken] = useState('')
  const [list, setList] = useState<Checklist | null>(null)
  const [loadError, setLoadError] = useState('')
  const [area, setArea] = useState('LC')
  const [open, setOpen] = useState<Line | null>(null)
  const [fix, setFix] = useState<Fix | null>(null)
  const [gpsError, setGpsError] = useState('')
  const [captures, setCaptures] = useState<Capture[]>([])
  const [online, setOnline] = useState(true)
  const [finished, setFinished] = useState('')
  const [mapOpen, setMapOpen] = useState(false)
  const [seen, setSeen] = useState<Fix[]>([])
  const [spotMsg, setSpotMsg] = useState('')
  const trail = useRef<Fix[]>([])
  const fixRef = useRef<Fix | null>(null)
  const demo = !token || !API

  // token from the link (#t=...) or from this phone; a sticker scan arrives as #s=<code>
  useEffect(() => {
    const h = new URLSearchParams(location.hash.slice(1))
    const t = h.get('t') || store.get('vera-walk-token') || ''
    if (h.get('t')) store.set('vera-walk-token', t)
    const s = h.get('s')
    if (s) {
      const a = takeSticker(s)
      if (a) setArea(a)
      setSpotMsg('Sticker scanned: photos here are placed in ' + (AREA_NAMES[a] || a) + ' for the next ' + SPOT_MIN + ' minutes.')
    }
    if (h.get('t') || s) history.replaceState(null, '', location.pathname)
    setToken(t)
    setOnline(navigator.onLine)
    if (!t || !API) { setList(sample as Checklist); return }
    const cached = (() => { try { return JSON.parse(localStorage.getItem('walk-list-' + t.split('.')[0]) || 'null') } catch { return null } })()
    if (cached) setList(cached)
    fetch(API, { headers: { 'x-vera-walk': t } })
      .then(async (r) => {
        if (r.status === 401) throw new Error('This walk link has expired. Ask Vera on WhatsApp for a new one.')
        if (!r.ok) throw new Error('Could not load the checklist (' + r.status + '). Showing the last saved copy.')
        const j = (await r.json()) as Checklist
        const zones = (j.zones || []).map((z: Zone & { shape?: Zone }) => ({ ...z, ...(z.shape || {}) }))
        const full = { ...j, zones }
        setList(full)
        try { localStorage.setItem('walk-list-' + t.split('.')[0], JSON.stringify(full)) } catch {}
      })
      .catch((e) => setLoadError(e.message))
    allCaptures().then(setCaptures)
  }, [])

  // GPS: keep watching while the page is open; every fix carries its own ± metres
  useEffect(() => {
    if (!('geolocation' in navigator)) { setGpsError('This phone browser gives no location.'); return }
    const id = navigator.geolocation.watchPosition(
      (p) => { const f = { lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy, ts: new Date(p.timestamp).toISOString() }; fixRef.current = f; setFix(f); setGpsError('') },
      (e) => setGpsError(e.code === 1 ? 'Location is blocked. Allow it for this page, or photos are saved without a place.' : 'Looking for GPS…'),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 },
    )
    const tick = setInterval(() => { const f = fixRef.current; if (f) { trail.current.push(f); setSeen((x) => [...x.slice(-299), f]) } }, 20000)
    let lock: { release: () => Promise<void> } | null = null
    const wl = (navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> } }).wakeLock
    wl?.request('screen').then((l) => { lock = l }).catch(() => {})
    return () => { navigator.geolocation.clearWatch(id); clearInterval(tick); lock?.release().catch(() => {}) }
  }, [])

  // send whatever is queued; a capture keeps its id, so a resend is never saved twice
  const flush = useCallback(async () => {
    if (demo || !navigator.onLine) return
    const all = await allCaptures()
    for (const c of all.filter((x) => x.state === 'queued')) {
      try {
        const { state, geo, error, ...body } = c
        void state; void geo; void error
        const r = await fetch(API, { method: 'POST', headers: { 'content-type': 'application/json', 'x-vera-walk': token }, body: JSON.stringify({ action: 'capture', ...body }) })
        const j = await r.json().catch(() => ({}))
        if (r.ok) await putCapture({ ...c, state: 'sent', geo: j.geo, photo_b64: undefined, audio_b64: undefined })
        else if (r.status === 400) await putCapture({ ...c, state: 'rejected', error: (j.details || []).join('; ') })
        else break // 401 / 5xx: keep it queued and try later
      } catch { break }
    }
    // areas marked with no signal
    const zones: { area: string }[] = (() => { try { return JSON.parse(store.get('vera-walk-zones') || '[]') } catch { return [] } })()
    while (zones.length) {
      const r = await fetch(API, { method: 'POST', headers: { 'content-type': 'application/json', 'x-vera-walk': token }, body: JSON.stringify(zones[0]) }).catch(() => null)
      if (!r || r.status >= 500 || r.status === 401) break
      if (r.status === 400) { const j = await r.json().catch(() => ({})); setSpotMsg('Area ' + zones[0].area + ' was not saved: ' + (j.details || []).join('; ')) }
      zones.shift()
      store.set('vera-walk-zones', JSON.stringify(zones))
    }
    // sticker scans, with the fix at the time they are sent
    const spots: { code: string; client_ts: string }[] = (() => { try { return JSON.parse(store.get('vera-walk-spots') || '[]') } catch { return [] } })()
    while (spots.length) {
      const sp = spots[0]
      const r = await fetch(API, { method: 'POST', headers: { 'content-type': 'application/json', 'x-vera-walk': token }, body: JSON.stringify({ action: 'spot', ...sp, gps: fixRef.current }) }).catch(() => null)
      if (!r || r.status >= 500 || r.status === 401) break
      const j = await r.json().catch(() => ({}))
      if (!j.ok) setSpotMsg(j.message || (j.details || []).join('; ') || 'This sticker was not accepted.')
      spots.shift()
      store.set('vera-walk-spots', JSON.stringify(spots))
    }
    if (trail.current.length) {
      const points = trail.current.splice(0)
      const r = await fetch(API, { method: 'POST', headers: { 'content-type': 'application/json', 'x-vera-walk': token }, body: JSON.stringify({ action: 'trail', points }) }).catch(() => null)
      if (!r || !r.ok) trail.current.unshift(...points)
    }
    setCaptures(await allCaptures())
  }, [demo, token])

  useEffect(() => {
    const on = () => { setOnline(true); flush() }
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    const t = setInterval(flush, 15000)
    flush() // at once too: a sticker scan or captures left from last time go out without waiting
    // the camera may open the sticker link in this same tab: only the #fragment changes
    const onHash = () => {
      const code = new URLSearchParams(location.hash.slice(1)).get('s')
      if (!code) return
      const a = takeSticker(code)
      if (a) setArea(a)
      setSpotMsg('Sticker scanned: photos here are placed in ' + (AREA_NAMES[a] || a) + ' for the next ' + SPOT_MIN + ' minutes.')
      history.replaceState(null, '', location.pathname)
      flush()
    }
    window.addEventListener('hashchange', onHash)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); window.removeEventListener('hashchange', onHash); clearInterval(t) }
  }, [flush])

  const lines = useMemo(() => (list ? list.lines : []), [list])
  const areas = useMemo(() => {
    const codes = [...new Set(lines.map((l) => l.area))]
    return codes.map((c) => ({ code: c, name: AREA_NAMES[c] || (list?.areas || []).find((a) => a.code === c)?.name || c }))
  }, [lines, list])
  const latest = useMemo(() => {
    const m: Record<string, Capture> = {}
    for (const c of [...captures].sort((a, b) => a.client_ts.localeCompare(b.client_ts))) m[c.line] = c
    return m
  }, [captures])
  const statusOf = (l: Line) => (latest[l.code] && latest[l.code].status !== 'photo' ? latest[l.code].status : latest[l.code] ? 'filed' : l.status)
  const walkLines = lines.filter((l) => l.when === 'walk')
  const checked = walkLines.filter((l) => ['ok', 'not_ok', 'na'].includes(statusOf(l))).length
  const queued = captures.filter((c) => c.state === 'queued').length

  async function save(line: Line, status: Capture['status'], remark: string, photo: File | null, audio: Blob | null) {
    // wait up to 20 s for a good fix, keep the best one seen
    let best = fixRef.current
    const t0 = Date.now()
    while ((!best || best.accuracy > GOOD_M) && Date.now() - t0 < 20000) {
      await new Promise((r) => setTimeout(r, 1000))
      const f = fixRef.current
      if (f && (!best || f.accuracy < best.accuracy)) best = f
    }
    const ph = photo ? await shrink(photo) : null
    const c: Capture = {
      capture_id: crypto.randomUUID(), line: line.code, status, remark, gps: best, client_ts: new Date().toISOString(),
      ...(freshSpot(line.area) ? { spot: freshSpot(line.area)!.code } : {}),
      ...(ph ? { photo_b64: ph.b64, photo_mime: ph.mime } : {}),
      ...(audio ? { audio_b64: await blobB64(audio), audio_mime: audio.type || 'audio/webm' } : {}),
      state: demo ? 'sent' : 'queued', geo: place(best, list?.zones || [], line.area),
    }
    await putCapture(c)
    setCaptures(await allCaptures().then((x) => (x.length ? x : [...captures, c])))
    flush()
  }

  // the engineer marks an area on the map. Drawn at once; sent now, or kept on the phone
  // and sent with the captures when there is signal.
  async function saveZone(shape: Shape): Promise<{ ok: boolean; note?: string }> {
    const name = areas.find((a) => a.code === area)?.name || area
    const draw = () => setList((l) => {
      if (!l) return l
      const z: Zone = 'circle' in shape
        ? { area, name, circle: { lat: shape.circle.lat, lng: shape.circle.lng, radius_m: shape.circle.radius_m } }
        : { area, name, polygon: shape.polygon }
      const n = { ...l, zones: [...(l.zones || []).filter((x) => x.area !== area), z] }
      store.set('walk-list-' + token.split('.')[0], JSON.stringify(n))
      return n
    })
    if (demo) { draw(); return { ok: true } }
    const body = { action: 'zone', area, name, shape }
    const r = navigator.onLine ? await fetch(API, { method: 'POST', headers: { 'content-type': 'application/json', 'x-vera-walk': token }, body: JSON.stringify(body) }).catch(() => null) : null
    if (r && r.status === 400) { const j = await r.json().catch(() => ({})); return { ok: false, note: 'Not saved: ' + (j.details || []).join('; ') } }
    draw()
    if (r && r.ok) return { ok: true }
    const pend = (() => { try { return JSON.parse(store.get('vera-walk-zones') || '[]') } catch { return [] } })()
    store.set('vera-walk-zones', JSON.stringify([...pend.filter((x: { area: string }) => x.area !== area), body]))
    return { ok: true, note: name + ' is drawn and saved on the phone. It will be sent when there is signal.' }
  }

  async function finish() {
    if (queued) { setFinished(queued + ' capture(s) are still waiting for signal. They will send on their own; finish again once they are sent.'); return }
    if (demo) { setFinished('Demo: on a real visit this drafts the NOC report and sends it to you on WhatsApp.'); return }
    const r = await fetch(API, { method: 'POST', headers: { 'content-type': 'application/json', 'x-vera-walk': token }, body: JSON.stringify({ action: 'finish' }) }).catch(() => null)
    setFinished(r && r.ok ? 'Done. The report is being drafted and will come on WhatsApp.' : 'Could not reach Vera. Try again when you have signal.')
  }

  const q = fix ? (fix.accuracy <= GOOD_M ? 'good' : fix.accuracy <= WEAK_M ? 'weak' : 'poor') : 'none'

  return (
    <main className="mx-auto min-h-dvh max-w-xl bg-paper pb-28 text-ink" style={{ paddingLeft: 'max(16px, env(safe-area-inset-left, 0px))', paddingRight: 'max(16px, env(safe-area-inset-right, 0px))' }}>
      <header className="sticky top-0 z-10 -mx-4 bg-paper/95 px-4 pb-3 pt-4 backdrop-blur">
        <div className="flex items-baseline justify-between gap-3">
          <h1 className="font-display text-xl leading-tight">{list ? list.project : 'Loading…'}</h1>
          <span className="shrink-0 font-mono text-xs text-ink-3">{list?.visit_date}</span>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
          <span className={q === 'good' ? 'text-sage' : q === 'weak' ? 'text-ochre' : 'text-rust'}>
            ● GPS {fix ? '±' + Math.round(fix.accuracy) + ' m' : gpsError || 'looking…'}
          </span>
          <span className="tabular-nums text-ink-2">{checked}/{walkLines.length} lines checked</span>
          <span className={online ? 'text-ink-3' : 'text-rust'}>{online ? (queued ? queued + ' waiting to send' : 'All sent') : 'No signal: saving on phone'}</span>
        </div>
        <div className="mt-2 flex gap-4 text-sm">
          <button onClick={() => setMapOpen(true)} className="text-ink-2 underline underline-offset-2">Site map · mark areas</button>
          <Link href="/walk/stickers" className="text-ink-2 underline underline-offset-2">Print QR stickers</Link>
        </div>
        {spotMsg && <p className="mt-2 rounded-md bg-sage-2 px-3 py-2 text-xs text-ink-2" role="status">{spotMsg}</p>}
        {demo && <p className="mt-2 rounded-md bg-ochre-2 px-3 py-2 text-xs text-ink-2">Demo with a sample site. Nothing leaves this phone. The real link comes on WhatsApp.</p>}
        {loadError && <p className="mt-2 rounded-md bg-rust/10 px-3 py-2 text-xs text-rust">{loadError}</p>}
        <nav className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1" aria-label="Areas">
          {areas.map((a) => {
            const ls = lines.filter((l) => l.area === a.code)
            const done = ls.filter((l) => ['ok', 'not_ok', 'na', 'accepted'].includes(statusOf(l))).length
            return (
              <button key={a.code} onClick={() => setArea(a.code)} className={`shrink-0 rounded-full px-3 py-1.5 text-sm ${area === a.code ? 'bg-espresso text-paper' : 'bg-card text-ink-2 ring-1 ring-line'}`}>
                {a.name} <span className="tabular-nums opacity-70">{done}/{ls.length}</span>
              </button>
            )
          })}
        </nav>
      </header>

      <ul className="mt-2 flex flex-col gap-2">
        {lines.filter((l) => l.area === area).map((l) => {
          const s = statusOf(l)
          const c = latest[l.code]
          return (
            <li key={l.code}>
              <button onClick={() => setOpen(l)} className="flex w-full items-start gap-3 rounded-lg bg-card p-3 text-left ring-1 ring-line">
                <span className="w-14 shrink-0 font-mono text-xs text-ink-3">{l.code}{l.severity === 'critical' && <span className="block text-rust">critical</span>}</span>
                <span className="min-w-0 flex-1 text-sm leading-snug">
                  {l.text}
                  {c?.geo && <span className={`mt-1 block text-xs ${geoTone[c.geo.result] || 'text-ink-3'}`}>{c.geo.note}{c.state === 'queued' ? ' · waiting to send' : c.state === 'rejected' ? ' · not accepted: ' + c.error : ''}</span>}
                </span>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${chip[s] || chip.open}`}>{label[s] || s}</span>
              </button>
            </li>
          )
        })}
      </ul>

      <div className="fixed inset-x-0 bottom-0 z-10 bg-paper/95 backdrop-blur" style={{ paddingBottom: 'calc(12px + env(safe-area-inset-bottom, 0px))', paddingLeft: 'max(16px, env(safe-area-inset-left, 0px))', paddingRight: 'max(16px, env(safe-area-inset-right, 0px))' }}>
        <div className="mx-auto max-w-xl pt-3">
          {finished && <p className="mb-2 text-sm text-ink-2">{finished}</p>}
          <button onClick={finish} className="w-full rounded-lg bg-rust py-3 font-medium text-paper">Finish the walk</button>
        </div>
      </div>

      {mapOpen && <SiteMap zones={list?.zones || []} fix={fix} trail={seen} area={area} areaName={areas.find((a) => a.code === area)?.name || area} getFix={() => fixRef.current} onSave={saveZone} onClose={() => setMapOpen(false)} />}
      {open && <LineSheet line={open} fix={fix} zones={list?.zones || []} onClose={() => setOpen(null)} onSave={async (st, remark, photo, audio) => { await save(open, st, remark, photo, audio); setOpen(null) }} />}
    </main>
  )
}

function LineSheet({ line, fix, zones, onClose, onSave }: {
  line: Line; fix: Fix | null; zones: Zone[]; onClose: () => void
  onSave: (s: Capture['status'], remark: string, photo: File | null, audio: Blob | null) => Promise<void>
}) {
  const [photo, setPhoto] = useState<File | null>(null)
  const [preview, setPreview] = useState('')
  const [remark, setRemark] = useState('')
  const [audio, setAudio] = useState<Blob | null>(null)
  const [rec, setRec] = useState<MediaRecorder | null>(null)
  const [busy, setBusy] = useState(false)
  const here = place(fix, zones, line.area)

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview) }, [preview])

  async function record() {
    if (rec) { rec.stop(); setRec(null); return }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const r = new MediaRecorder(stream)
      const parts: Blob[] = []
      r.ondataavailable = (e) => parts.push(e.data)
      r.onstop = () => { setAudio(new Blob(parts, { type: r.mimeType })); stream.getTracks().forEach((t) => t.stop()) }
      r.start()
      setRec(r)
    } catch {
      setRemark((x) => x || 'Microphone not available: type the remark instead.')
    }
  }

  const go = async (s: Capture['status']) => { setBusy(true); await onSave(s, remark, photo, audio); setBusy(false) }

  return (
    <div className="fixed inset-0 z-20 flex items-end bg-ink/40" onClick={onClose} role="dialog" aria-modal="true" aria-label={line.code}>
      <div className="max-h-[92dvh] w-full overflow-y-auto rounded-t-2xl bg-card p-4" onClick={(e) => e.stopPropagation()} style={{ paddingBottom: 'calc(16px + env(safe-area-inset-bottom, 0px))' }}>
        <div className="mx-auto max-w-xl">
          <div className="flex items-start justify-between gap-3">
            <p className="font-mono text-xs text-ink-3">{line.code} · {line.severity}</p>
            <button onClick={onClose} className="text-sm text-ink-3">Close</button>
          </div>
          <h2 className="mt-1 text-lg font-medium leading-snug">{line.text}</h2>
          {line.hint && <p className="mt-1 text-sm text-ink-2">Good evidence: {line.hint}</p>}
          <p className={`mt-2 text-sm ${geoTone[here.result]}`}>📍 {here.note}{fix ? ' · ±' + Math.round(fix.accuracy) + ' m' : ''}</p>

          <label className="mt-4 flex h-40 cursor-pointer items-center justify-center overflow-hidden rounded-lg bg-paper-2 text-sm text-ink-2 ring-1 ring-line">
            {preview ? <img src={preview} alt="Photo for this line" className="h-full w-full object-cover" /> : 'Take photo'}
            <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => { const f = e.target.files?.[0] || null; setPhoto(f); if (f) setPreview(URL.createObjectURL(f)) }} />
          </label>

          <div className="mt-3 flex gap-2">
            <button onClick={record} className={`flex-1 rounded-lg py-2.5 text-sm ring-1 ring-line ${rec ? 'bg-rust text-paper' : 'bg-card'}`}>{rec ? '■ Stop' : audio ? '🎙 Re-record remark' : '🎙 Speak remark'}</button>
          </div>
          <label htmlFor="remark" className="sr-only">Remark</label>
          <textarea id="remark" value={remark} onChange={(e) => setRemark(e.target.value)} rows={2} placeholder="Or type a remark (any language)" className="mt-2 w-full rounded-lg bg-paper p-2 text-sm ring-1 ring-line" />

          <div className="mt-3 grid grid-cols-3 gap-2">
            <button disabled={busy} onClick={() => go('ok')} className="rounded-lg bg-sage py-3 text-sm font-medium text-paper disabled:opacity-50">OK</button>
            <button disabled={busy} onClick={() => go('not_ok')} className="rounded-lg bg-rust py-3 text-sm font-medium text-paper disabled:opacity-50">Not OK</button>
            <button disabled={busy} onClick={() => go('na')} className="rounded-lg bg-paper-2 py-3 text-sm font-medium text-ink-2 disabled:opacity-50">N/A</button>
          </div>
          {photo && <button disabled={busy} onClick={() => go('photo')} className="mt-2 w-full text-sm text-ink-3 underline">Save photo only, decide later</button>}
          {busy && <p className="mt-2 text-center text-xs text-ink-3">Getting a good GPS fix (up to 20 s)…</p>}
        </div>
      </div>
    </div>
  )
}
