'use client'

// Desk 05 walk page: the site map sheet. Shows the areas drawn for this site, where the phone
// is (with its own ± circle) and the trail so far, and lets the engineer mark an area:
//   - stand in it: 10 s of fixes averaged into a circle (radius chosen by him), or
//   - walk its corners: one fix per corner (each must be ±30 m or better), saved as an outline.
// No map tiles: a plain drawing in metres, north up, so it works with no signal and leaks nothing.

import { useMemo, useState } from 'react'

export type Fix = { lat: number; lng: number; accuracy: number; ts: string }
export type Zone = { area: string; name: string; polygon?: number[][]; circle?: { lat: number; lng: number; radius_m: number } }
export type Shape = { circle: { lat: number; lng: number; radius_m: number; accuracy_m: number } } | { polygon: number[][]; accuracy_m: number }

const W = 320
const H = 240
const MAX_M = 30

export function SiteMap({ zones, fix, trail, area, areaName, getFix, onSave, onClose }: {
  zones: Zone[]; fix: Fix | null; trail: Fix[]; area: string; areaName: string
  getFix: () => Fix | null
  onSave: (shape: Shape) => Promise<{ ok: boolean; note?: string }>
  onClose: () => void
}) {
  const [mode, setMode] = useState<'view' | 'circle' | 'corners'>('view')
  const [radius, setRadius] = useState(35)
  const [corners, setCorners] = useState<Fix[]>([])
  const [busy, setBusy] = useState('')
  const [msg, setMsg] = useState('')

  // project everything around one origin, in metres
  const view = useMemo(() => {
    const pts: [number, number][] = []
    for (const z of zones) {
      if (z.circle) pts.push([z.circle.lat, z.circle.lng])
      for (const p of z.polygon || []) pts.push([p[0], p[1]])
    }
    for (const t of trail) pts.push([t.lat, t.lng])
    for (const c of corners) pts.push([c.lat, c.lng])
    if (fix) pts.push([fix.lat, fix.lng])
    if (!pts.length) return null
    const lat0 = pts.reduce((a, p) => a + p[0], 0) / pts.length
    const lng0 = pts.reduce((a, p) => a + p[1], 0) / pts.length
    const R = 6371000
    const xy = (lat: number, lng: number): [number, number] => [((lng - lng0) * Math.PI / 180) * R * Math.cos(lat0 * Math.PI / 180), ((lat - lat0) * Math.PI / 180) * R]
    const m = pts.map((p) => xy(p[0], p[1]))
    const ext = [...zones.flatMap((z) => (z.circle ? [z.circle.radius_m] : [])), fix ? Math.min(fix.accuracy, 80) : 0]
    const pad = Math.max(20, ...ext)
    const minX = Math.min(...m.map((p) => p[0])) - pad, maxX = Math.max(...m.map((p) => p[0])) + pad
    const minY = Math.min(...m.map((p) => p[1])) - pad, maxY = Math.max(...m.map((p) => p[1])) + pad
    const k = Math.min(W / (maxX - minX), H / (maxY - minY))
    const ox = (W - (maxX - minX) * k) / 2, oy = (H - (maxY - minY) * k) / 2
    const to = (lat: number, lng: number): [number, number] => { const [x, y] = xy(lat, lng); return [ox + (x - minX) * k, H - (oy + (y - minY) * k)] }
    const scaleM = [10, 20, 50, 100, 200, 500].find((s) => s * k >= 50) || 500
    return { to, k, scaleM }
  }, [zones, trail, corners, fix])

  async function collect(ms: number) {
    const seen: Fix[] = []
    const t0 = Date.now()
    while (Date.now() - t0 < ms) {
      const f = getFix()
      if (f && (!seen.length || seen[seen.length - 1].ts !== f.ts)) seen.push(f)
      await new Promise((r) => setTimeout(r, 500))
    }
    return seen
  }

  async function markCircle() {
    setBusy('Standing still for 10 s to average the GPS…')
    setMsg('')
    const seen = (await collect(10000)).filter((f) => f.accuracy <= MAX_M)
    if (!seen.length) { setBusy(''); setMsg('GPS is weaker than ±' + MAX_M + ' m here. Step into the open and try again.'); return }
    const w = seen.map((f) => 1 / (f.accuracy * f.accuracy))
    const sw = w.reduce((a, b) => a + b, 0)
    const lat = seen.reduce((a, f, i) => a + f.lat * w[i], 0) / sw
    const lng = seen.reduce((a, f, i) => a + f.lng * w[i], 0) / sw
    const best = Math.min(...seen.map((f) => f.accuracy))
    setBusy('Saving…')
    const r = await onSave({ circle: { lat, lng, radius_m: radius, accuracy_m: Math.round(best) } })
    setBusy('')
    setMsg(r.note || areaName + ' saved as a ' + radius + ' m circle (GPS ±' + Math.round(best) + ' m).')
    if (r.ok) setMode('view')
  }

  async function addCorner() {
    setBusy('Getting this corner (5 s)…')
    setMsg('')
    const seen = (await collect(5000)).sort((a, b) => a.accuracy - b.accuracy)
    setBusy('')
    if (!seen.length || seen[0].accuracy > MAX_M) { setMsg('GPS is weaker than ±' + MAX_M + ' m at this corner. Wait a moment and try again.'); return }
    setCorners((c) => [...c, seen[0]])
  }

  async function saveCorners() {
    setBusy('Saving…')
    const r = await onSave({ polygon: corners.map((c) => [c.lat, c.lng]), accuracy_m: Math.round(Math.max(...corners.map((c) => c.accuracy))) })
    setBusy('')
    setMsg(r.note || areaName + ' saved with ' + corners.length + ' corners.')
    if (r.ok) { setCorners([]); setMode('view') }
  }

  const path = (pts: number[][]) => pts.map((p, i) => (i ? 'L' : 'M') + view!.to(p[0], p[1]).map((v) => v.toFixed(1)).join(' ')).join(' ') + ' Z'

  return (
    <div className="fixed inset-0 z-20 flex items-end bg-ink/40" onClick={onClose} role="dialog" aria-modal="true" aria-label="Site map">
      <div className="max-h-[92dvh] w-full overflow-y-auto rounded-t-2xl bg-card p-4" onClick={(e) => e.stopPropagation()} style={{ paddingBottom: 'calc(16px + env(safe-area-inset-bottom, 0px))' }}>
        <div className="mx-auto max-w-xl">
          <div className="flex items-start justify-between gap-3">
            <h2 className="text-lg font-medium">Site map</h2>
            <button onClick={onClose} className="text-sm text-ink-3">Close</button>
          </div>
          <p className="mt-1 text-sm text-ink-2">Areas drawn for this site, where you are, and your walk so far. North is up.</p>

          <div className="mt-3 overflow-hidden rounded-lg bg-paper ring-1 ring-line">
            {view ? (
              <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label="Map of the drawn areas and your position">
                {zones.map((z, i) => {
                  const mine = z.area === area
                  const cls = mine ? 'fill-sage/20 stroke-sage' : 'fill-ink/5 stroke-ink-3'
                  const c = z.circle ? view.to(z.circle.lat, z.circle.lng) : z.polygon && z.polygon.length ? view.to(z.polygon[0][0], z.polygon[0][1]) : null
                  return (
                    <g key={i}>
                      {z.circle && c && <circle cx={c[0]} cy={c[1]} r={z.circle.radius_m * view.k} className={cls} strokeWidth={1.5} />}
                      {z.polygon && <path d={path(z.polygon)} className={cls} strokeWidth={1.5} />}
                      {c && <text x={c[0]} y={c[1] - 4} textAnchor="middle" className="fill-ink-2 text-[9px]">{z.area}</text>}
                    </g>
                  )
                })}
                {trail.map((t, i) => { const p = view.to(t.lat, t.lng); return <circle key={i} cx={p[0]} cy={p[1]} r={1.6} className="fill-ink-3" /> })}
                {corners.length > 0 && <path d={path(corners.map((c) => [c.lat, c.lng]))} className="fill-ochre/15 stroke-ochre" strokeDasharray="4 3" strokeWidth={1.5} />}
                {corners.map((c, i) => { const p = view.to(c.lat, c.lng); return <circle key={'c' + i} cx={p[0]} cy={p[1]} r={3} className="fill-ochre" /> })}
                {fix && (() => { const p = view.to(fix.lat, fix.lng); return (
                  <g>
                    <circle cx={p[0]} cy={p[1]} r={Math.max(3, fix.accuracy * view.k)} className="fill-rust/10 stroke-rust/40" />
                    <circle cx={p[0]} cy={p[1]} r={4} className="fill-rust stroke-paper" strokeWidth={1.5} />
                  </g>
                ) })()}
                <g transform={`translate(10 ${H - 12})`}>
                  <line x1={0} x2={view.scaleM * view.k} y1={0} y2={0} className="stroke-ink-2" strokeWidth={2} />
                  <text x={0} y={-4} className="fill-ink-2 text-[9px]">{view.scaleM} m</text>
                </g>
              </svg>
            ) : (
              <p className="p-6 text-center text-sm text-ink-3">No GPS fix and no areas yet.</p>
            )}
          </div>
          <p className="mt-2 text-xs text-ink-3"><span className="text-rust">●</span> you (±{fix ? Math.round(fix.accuracy) : '–'} m) · dots: your trail · <span className="text-sage">green</span>: {areaName}</p>

          {mode === 'view' && (
            <div className="mt-4">
              <p className="text-sm font-medium">Mark {areaName}</p>
              <p className="mt-1 text-sm text-ink-2">Replaces the contractor&apos;s pin. Photos for {areaName} are then placed against it.</p>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <button onClick={() => setMode('circle')} className="rounded-lg bg-paper-2 py-2.5 text-sm ring-1 ring-line">Stand in it</button>
                <button onClick={() => { setCorners([]); setMode('corners') }} className="rounded-lg bg-paper-2 py-2.5 text-sm ring-1 ring-line">Walk its corners</button>
              </div>
            </div>
          )}

          {mode === 'circle' && (
            <div className="mt-4">
              <p className="text-sm text-ink-2">Stand in the middle of {areaName}. How far does it reach?</p>
              <div className="mt-2 grid grid-cols-3 gap-2" role="radiogroup" aria-label="Radius">
                {[20, 35, 50].map((r) => (
                  <button key={r} role="radio" aria-checked={radius === r} onClick={() => setRadius(r)} className={`rounded-lg py-2 text-sm ring-1 ring-line ${radius === r ? 'bg-espresso text-paper' : 'bg-card'}`}>{r} m</button>
                ))}
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <button disabled={!!busy} onClick={markCircle} className="rounded-lg bg-sage py-3 text-sm font-medium text-paper disabled:opacity-50">Mark here</button>
                <button disabled={!!busy} onClick={() => setMode('view')} className="rounded-lg bg-paper-2 py-3 text-sm ring-1 ring-line disabled:opacity-50">Cancel</button>
              </div>
            </div>
          )}

          {mode === 'corners' && (
            <div className="mt-4">
              <p className="text-sm text-ink-2">Walk to each corner of {areaName} and tap. At least 3. {corners.length ? corners.length + ' so far.' : ''}</p>
              <div className="mt-2 grid grid-cols-3 gap-2">
                <button disabled={!!busy} onClick={addCorner} className="rounded-lg bg-ochre py-3 text-sm font-medium text-paper disabled:opacity-50">Add corner</button>
                <button disabled={!!busy || corners.length < 3} onClick={saveCorners} className="rounded-lg bg-sage py-3 text-sm font-medium text-paper disabled:opacity-50">Save</button>
                <button disabled={!!busy} onClick={() => { setCorners([]); setMode('view') }} className="rounded-lg bg-paper-2 py-3 text-sm ring-1 ring-line disabled:opacity-50">Cancel</button>
              </div>
            </div>
          )}

          {busy && <p className="mt-3 text-sm text-ink-3" role="status">{busy}</p>}
          {msg && <p className="mt-3 text-sm text-ink-2" role="status">{msg}</p>}
        </div>
      </div>
    </div>
  )
}
