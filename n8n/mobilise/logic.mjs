// Desk 05: every decision that is made by plain code.
//
// Each function below is pasted whole into one n8n Code node (see build.mjs), so each one
// must be self-contained: no imports, no references to anything outside its own body.
// Each takes the incoming item's JSON and returns the outgoing item (or a list of items).
//
// The rule for the whole desk: AI reads (voice, handwriting, papers, which line a photo
// belongs to). Code decides (is the paper valid, is the line open, is the site ready).
// A person signs. When code cannot decide from what AI read, the item goes to a person.

// ---------------------------------------------------------------------------
// WF-01 Inbound router
// ---------------------------------------------------------------------------

// Meta sends one POST with entry[].changes[].value.{messages[], statuses[]}.
// Turn it into one item per message and one per delivery status.
export function explodeEvents(input) {
  const body = input.body || {}
  const out = []
  for (const entry of Array.isArray(body.entry) ? body.entry : []) {
    for (const change of Array.isArray(entry.changes) ? entry.changes : []) {
      const v = change.value || {}
      const phoneNumberId = (v.metadata && v.metadata.phone_number_id) || ''
      const names = {}
      for (const c of Array.isArray(v.contacts) ? v.contacts : []) names[c.wa_id] = (c.profile && c.profile.name) || ''
      for (const m of Array.isArray(v.messages) ? v.messages : []) {
        const t = m.type || 'unknown'
        const media = m[t] && typeof m[t] === 'object' && m[t].id ? m[t] : null
        let interactive = null
        if (t === 'interactive' && m.interactive) {
          const i = m.interactive
          if (i.type === 'button_reply') interactive = { kind: 'button', id: i.button_reply.id, title: i.button_reply.title }
          else if (i.type === 'list_reply') interactive = { kind: 'list', id: i.list_reply.id, title: i.list_reply.title }
          else if (i.type === 'nfm_reply') interactive = { kind: 'flow', id: '', title: '', response: i.nfm_reply.response_json || '' }
        }
        if (t === 'button' && m.button) interactive = { kind: 'template_button', id: m.button.payload || '', title: m.button.text || '' }
        out.push({
          kind: 'message', inbox_id: input.inbox_id || null, phone_number_id: phoneNumberId,
          wamid: m.id, from: String(m.from || ''), profile_name: names[m.from] || '',
          ts: Number(m.timestamp || 0), type: t,
          text: t === 'text' && m.text ? String(m.text.body || '') : '',
          caption: media && media.caption ? String(media.caption) : '',
          media_id: media ? media.id : '', mime: media ? String(media.mime_type || '') : '',
          sha256_meta: media ? String(media.sha256 || '') : '',
          filename: media && media.filename ? String(media.filename) : '',
          voice: t === 'audio' && !!(m.audio && m.audio.voice),
          context_wamid: m.context && m.context.id ? m.context.id : '',
          forwarded: !!(m.context && (m.context.forwarded || m.context.frequently_forwarded)),
          location: t === 'location' && m.location ? { lat: m.location.latitude, lng: m.location.longitude, name: m.location.name || '', address: m.location.address || '' } : null,
          interactive,
          errors: Array.isArray(m.errors) ? m.errors.map((e) => ({ code: e.code, title: e.title })) : [],
        })
      }
      for (const s of Array.isArray(v.statuses) ? v.statuses : []) {
        out.push({
          kind: 'status', inbox_id: input.inbox_id || null, wamid: s.id, status: s.status, to: String(s.recipient_id || ''),
          ts: Number(s.timestamp || 0),
          errors: Array.isArray(s.errors) ? s.errors.map((e) => ({ code: e.code, title: e.title })) : [],
        })
      }
    }
  }
  if (!out.length) out.push({ kind: 'empty', inbox_id: input.inbox_id || null })
  return out
}

// ---------------------------------------------------------------------------
// WF-02 Process one message: which checklist line is this for?
// ---------------------------------------------------------------------------

// Deterministic binding, strongest signal first. AI is asked only when none of these hold,
// and then only to choose from a short list of open lines.
//   1. reply to a line prompt or an open-item message       (swipe-reply on our message)
//   2. a line code in the caption, text or file name         ("LC-03", "lc 3", "LC03")
//   3. reply to an area prompt + a bare number in the caption ("3" under the Labour camp prompt)
//   4. a line picked from our list in the last 10 minutes
//   5. none of the above -> AI picks from the open lines (of that area, if we know the area)
export function bindLine(input) {
  const m = input.message || {}
  const lines = Array.isArray(input.lines) ? input.lines : []
  const prompts = Array.isArray(input.prompts) ? input.prompts : []
  const now = Number(input.now || Date.now())
  const byCode = {}
  for (const l of lines) byCode[l.code] = l
  const areas = [...new Set(lines.map((l) => l.area))]
  const isMedia = ['image', 'document', 'audio', 'video'].includes(m.type)
  const done = (o) => ({ ...o, area: o.line ? byCode[o.line].area : o.area || '', needsAi: !!o.needsAi })

  const prompt = m.context_wamid ? prompts.find((p) => p.wamid === m.context_wamid) : null
  if (prompt && (prompt.kind === 'line' || prompt.kind === 'open_item' || prompt.kind === 'confirm') && byCode[prompt.line]) {
    return done({ line: prompt.line, method: prompt.kind === 'open_item' ? 'reply-to-open-item' : 'reply-to-line', confidence: 1, candidates: [] })
  }

  const text = [m.caption, m.text, m.filename].filter(Boolean).join(' ')
  const codeRe = new RegExp('(?<![A-Za-z0-9])(' + areas.join('|') + ')[\\s_\\-\\.]*0*(\\d{1,2})(?!\\d)', 'gi')
  const found = new Set()
  let hit
  while (areas.length && (hit = codeRe.exec(text))) {
    const code = hit[1].toUpperCase() + '-' + String(Number(hit[2])).padStart(2, '0')
    if (byCode[code]) found.add(code)
  }
  if (found.size === 1) return done({ line: [...found][0], method: 'caption-code', confidence: 1, candidates: [] })
  if (found.size > 1) return done({ line: '', method: 'ambiguous-caption', confidence: 0, candidates: [...found], needsAi: false, ask: true })

  const promptArea = prompt && prompt.kind === 'area' ? prompt.area : ''
  if (promptArea) {
    const n = (m.caption || m.text || '').trim().match(/^#?\s*(\d{1,2})\b/)
    const code = n ? promptArea + '-' + String(Number(n[1])).padStart(2, '0') : ''
    if (code && byCode[code]) return done({ line: code, method: 'area-reply-number', confidence: 1, candidates: [] })
  }

  const pick = input.pendingPick
  if (pick && pick.line && byCode[pick.line] && now - Number(pick.at) <= 10 * 60 * 1000 && isMedia) {
    return done({ line: pick.line, method: 'picked-from-list', confidence: 1, candidates: [] })
  }

  if (!isMedia) return done({ line: '', method: 'not-evidence', confidence: 0, candidates: [], needsAi: false })

  // Candidates for AI: open lines only, of the known area if any, that take this kind of evidence.
  const area = promptArea || input.gpsArea || ''
  const wants = (l) => (m.type === 'audio' ? true : m.type === 'document' ? l.evidence !== 'photo' : true)
  const open = (l) => !['accepted', 'ok', 'na'].includes(l.status)
  let candidates = lines.filter((l) => open(l) && wants(l) && (!area || l.area === area)).map((l) => l.code)
  if (!candidates.length) candidates = lines.filter((l) => open(l) && wants(l)).map((l) => l.code)
  return done({ line: '', area, method: 'ai', confidence: 0, candidates, needsAi: candidates.length > 0 })
}

// Build the Claude request that files one photo or PDF against the candidate lines.
// The answer is constrained by a JSON schema whose enum is the candidate list, so the
// model cannot invent a line. "NONE" is always allowed.
export function buildClassifyRequest(input) {
  const lines = (input.lines || []).filter((l) => (input.binding.candidates || []).includes(l.code))
  const codes = lines.map((l) => l.code).concat(['NONE'])
  const docTypes = [...new Set((input.lines || []).map((l) => l.docType).filter(Boolean))].concat(['other_paper', 'not_a_paper'])
  const media = input.__media || {}
  const isVoice = input.message.type === 'audio'
  const block = isVoice
    ? { type: 'text', text: 'Voice note transcript (' + (input.message.transcript_lang || 'unknown language') + '): ' + (input.message.text || '(empty)') }
    : media.mime === 'application/pdf'
      ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: media.b64 } }
      : { type: 'image', source: { type: 'base64', media_type: media.mime || 'image/jpeg', data: media.b64 } }
  const list = lines.map((l) => '- ' + l.code + ': ' + l.text + (l.hint ? ' (good evidence: ' + l.hint + ')' : '')).join('\n')
  const system = [
    'You file evidence for a construction site mobilisation checklist in India.',
    'You get one photo, document or voice-note transcript and a list of open checklist lines. Say which single line it is evidence for.',
    'Rules:',
    '- Choose only from the list. If it fits none, or you cannot tell, answer NONE.',
    '- Confidence is your honest probability (0 to 1) that the chosen line is right. Do not round up.',
    '- Do not judge whether the site is compliant. Only say which line the evidence is for.',
    '- If it is a paper (certificate, policy, licence), say what kind of paper it is.',
    '- Captions and file names may be in Hindi, Marathi, English or a mix. Use them.',
    '- Flag it if it looks like a screenshot, a forwarded old photo, or shows another project name.',
  ].join('\n')
  const user = [
    'Open checklist lines:', list, '',
    'Sender: ' + (input.sender_role || 'contractor') + '. Stage: ' + (input.stage || 'paper check') + '.',
    'Caption / file name: ' + ([input.message.caption, input.message.filename].filter(Boolean).join(' | ') || '(none)'),
  ].join('\n')
  const schema = {
    type: 'object', additionalProperties: false,
    required: ['line_code', 'confidence', 'alternatives', 'evidence_kind', 'doc_type', 'readable', 'suspicious', 'reason'],
    properties: {
      line_code: { type: 'string', enum: codes },
      confidence: { type: 'number' },
      alternatives: {
        type: 'array',
        items: { type: 'object', additionalProperties: false, required: ['line_code', 'confidence'], properties: { line_code: { type: 'string', enum: codes }, confidence: { type: 'number' } } },
      },
      evidence_kind: { type: 'string', enum: ['site_photo', 'photo_of_paper', 'pdf', 'screenshot', 'other'] },
      doc_type: { type: 'string', enum: docTypes },
      readable: { type: 'boolean' },
      suspicious: { type: 'boolean' },
      reason: { type: 'string' },
    },
  }
  return {
    ...input,
    __media: undefined,
    request: {
      model: input.model || 'claude-opus-5-5',
      max_tokens: 1024,
      fallbacks: 'default',
      output_config: { effort: 'low', format: { type: 'json_schema', schema } },
      system,
      messages: [{ role: 'user', content: [block, { type: 'text', text: user }] }],
    },
  }
}

// Decide what to do with the AI's answer. Three outcomes:
//   auto     file it on the line (only filing: a photo line still waits for the engineer's OK)
//   confirm  ask the sender with one-tap buttons (top 3 + "Other")
//   human    put it in the review queue (unreadable, suspicious, refused, malformed, or no idea)
export function gateMatch(input) {
  const t = Object.assign({ auto: 0.9, margin: 0.3, ask: 0.45 }, input.thresholds || {})
  const res = input.ai || {}
  const candidates = (input.binding && input.binding.candidates) || []
  const fail = (why) => ({ ...input, decision: 'human', reason: why, options: [] })
  if (res.stop_reason === 'refusal') return fail('AI declined to read this item')
  if (res.stop_reason === 'max_tokens') return fail('AI answer was cut off')
  const textBlock = (res.content || []).find((b) => b.type === 'text')
  let a
  try { a = JSON.parse(textBlock ? textBlock.text : '') } catch (e) { return fail('AI answer was not valid JSON') }
  const ok = (c) => c === 'NONE' || candidates.includes(c)
  const conf = (x) => (typeof x === 'number' && x >= 0 && x <= 1 ? x : -1)
  if (!a || !ok(a.line_code) || conf(a.confidence) < 0 || !Array.isArray(a.alternatives)) return fail('AI answer did not match the schema')
  const ranked = [{ line_code: a.line_code, confidence: a.confidence }]
    .concat(a.alternatives.filter((x) => ok(x.line_code) && conf(x.confidence) >= 0))
    .filter((x) => x.line_code !== 'NONE')
    .sort((p, q) => q.confidence - p.confidence)
    .filter((x, i, arr) => arr.findIndex((y) => y.line_code === x.line_code) === i)
  const top = ranked[0]
  const second = ranked[1] ? ranked[1].confidence : 0
  const base = { ...input, ai_answer: a }
  if (!a.readable) return { ...base, decision: 'human', reason: 'Not readable: ask for a clearer photo', options: [] }
  if (a.suspicious) return { ...base, decision: 'human', reason: 'Looks reused or from another project: ' + a.reason, options: ranked.slice(0, 3).map((x) => x.line_code) }
  if (!top) return { ...base, decision: 'confirm', reason: 'AI could not place it', options: [] }
  if (a.line_code !== 'NONE' && top.line_code === a.line_code && top.confidence >= t.auto && top.confidence - second >= t.margin) {
    return { ...base, decision: 'auto', line: top.line_code, confidence: top.confidence, reason: a.reason, options: [] }
  }
  if (top.confidence >= t.ask) return { ...base, decision: 'confirm', line: '', confidence: top.confidence, reason: a.reason, options: ranked.slice(0, 3).map((x) => x.line_code) }
  return { ...base, decision: 'confirm', reason: 'Low confidence', options: [] }
}

// Build the Claude request that reads the fields off one paper. Every field may be null:
// the prompt says "null if not printed", and checkPaper treats null as "ask a person".
export function buildExtractRequest(input) {
  const media = input.__media || {}
  const block = media.mime === 'application/pdf'
    ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: media.b64 } }
    : { type: 'image', source: { type: 'base64', media_type: media.mime || 'image/jpeg', data: media.b64 } }
  const str = { type: ['string', 'null'] }
  const num = { type: ['number', 'null'] }
  const schema = {
    type: 'object', additionalProperties: false,
    required: ['doc_type', 'holder_name', 'site_address', 'document_number', 'issuer', 'issue_date', 'valid_from', 'valid_to', 'next_due_date',
      'workers_covered', 'sum_insured_inr', 'principal_named', 'officers_count', 'serial_number', 'contains_unmasked_id', 'readable'],
    properties: {
      doc_type: { type: 'string' }, holder_name: str, site_address: str, document_number: str, issuer: str,
      issue_date: str, valid_from: str, valid_to: str, next_due_date: str,
      workers_covered: num, sum_insured_inr: num, principal_named: { type: ['boolean', 'null'] }, officers_count: num,
      serial_number: str, contains_unmasked_id: { type: 'boolean' }, readable: { type: 'boolean' },
    },
  }
  return {
    ...input,
    __media: undefined,
    request: {
      model: input.model || 'claude-opus-5-5',
      max_tokens: 2048,
      fallbacks: 'default',
      output_config: { effort: 'low', format: { type: 'json_schema', schema } },
      system: [
        'You read Indian construction compliance papers: registrations, labour licences, insurance policies, calibration and test certificates, consent orders.',
        'Copy fields exactly as printed. Dates as YYYY-MM-DD. Amounts in rupees as plain numbers (1.5 crore = 15000000).',
        'If a field is not printed or you cannot read it, return null. Never guess or infer a value.',
        'principal_named: true only if the developer / principal / employer is named as an insured party.',
        'contains_unmasked_id: true if a full 12-digit Aadhaar number is visible.',
      ].join('\n'),
      messages: [{ role: 'user', content: [block, { type: 'text', text: 'Paper expected for line ' + input.line.code + ': ' + input.line.text + '. Expected type: ' + input.line.docType + '.' }] }],
    },
  }
}

// Check one paper against the site's facts. Plain code; every check says why.
// accepted: all checks pass. rejected: a check fails on a printed value. review: something
// needed for a check was not printed or not read (a person looks, never a guess).
export function checkPaper(input) {
  const line = input.line || {}
  const f = input.fields || {}
  const mob = input.mob || {}
  const P = Object.assign({ calibrationMaxAgeDays: 180, coverBeyondStartDays: 90, workersPerSafetyOfficer: 500 }, input.params || {})
  const day = (s) => (typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) ? Date.parse(s + 'T00:00:00Z') : NaN)
  const has = (v) => v !== null && v !== undefined && v !== '' && !(typeof v === 'number' && !Number.isFinite(v))
  const addDays = (t, n) => t + n * 86400000
  const iso = (t) => new Date(t).toISOString().slice(0, 10)
  const norm = (s) => String(s || '').toLowerCase().replace(/\b(private|pvt|limited|ltd|llp|co|company|and|&|m\/s|the)\b/g, ' ').replace(/[^a-z0-9ऀ-ॿ]+/g, ' ').trim()
  const nameOk = (name) => {
    const want = [mob.contractor_name].concat(mob.contractor_aliases || []).map(norm).filter(Boolean)
    const got = norm(name)
    return want.some((w) => {
      if (!w || !got) return false
      if (got.includes(w) || w.includes(got)) return true
      const a = new Set(w.split(' ')), b = got.split(' ')
      return b.filter((x) => a.has(x)).length / Math.max(a.size, 1) >= 0.6
    })
  }
  const start = day(mob.start_date)
  const visit = day(mob.visit_date || mob.start_date)
  const checks = []
  const need = (rule, v, label) => (has(v) ? true : (checks.push({ rule, result: 'missing', note: label + ' not printed or not read' }), false))
  const pass = (rule, ok, note) => checks.push({ rule, result: ok ? 'pass' : 'fail', note })

  if (f.readable === false) checks.push({ rule: 'readable', result: 'missing', note: 'Paper could not be read' })
  if (f.contains_unmasked_id) pass('idMasked', false, 'A full Aadhaar number is visible. Ask for a masked copy and delete this one.')
  if (line.docType && f.doc_type && f.doc_type !== line.docType) checks.push({ rule: 'docType', result: 'missing', note: 'Looks like ' + f.doc_type + ', expected ' + line.docType })

  for (const rule of line.rules || []) {
    if (rule === 'nameMatchesContractor') {
      if (need(rule, f.holder_name, 'Name')) pass(rule, nameOk(f.holder_name), 'Name on paper: "' + f.holder_name + '"')
    } else if (rule === 'siteMatches') {
      if (need(rule, f.site_address, 'Site address')) {
        const a = norm(f.site_address)
        const keys = (mob.site_keywords || []).map(norm).filter(Boolean)
        pass(rule, keys.some((k) => a.includes(k)), 'Address on paper: "' + f.site_address + '"')
      }
    } else if (rule === 'validOnStart') {
      if (need(rule, f.valid_to, 'Valid-to date')) {
        const from = has(f.valid_from) ? day(f.valid_from) : -Infinity
        pass(rule, from <= start && day(f.valid_to) >= start, 'Valid ' + (f.valid_from || '?') + ' to ' + f.valid_to + '; start ' + mob.start_date)
      }
    } else if (rule === 'validBeyondStart') {
      if (need(rule, f.valid_to, 'Valid-to date')) {
        const until = addDays(start, P.coverBeyondStartDays)
        pass(rule, day(f.valid_to) >= until, 'Valid to ' + f.valid_to + '; must cover at least ' + iso(until))
      }
    } else if (rule === 'coversPeakWorkers') {
      if (need(rule, f.workers_covered, 'Number of workers')) pass(rule, Number(f.workers_covered) >= Number(mob.peak_workers), f.workers_covered + ' workers covered; planned peak ' + mob.peak_workers)
    } else if (rule === 'sumInsuredCoversContract') {
      if (need(rule, f.sum_insured_inr, 'Sum insured')) pass(rule, Number(f.sum_insured_inr) >= Number(mob.contract_value_inr), 'Sum insured ₹' + Number(f.sum_insured_inr).toLocaleString('en-IN') + '; contract ₹' + Number(mob.contract_value_inr).toLocaleString('en-IN'))
    } else if (rule === 'principalNamed') {
      if (need(rule, f.principal_named, 'Insured parties')) pass(rule, f.principal_named === true, f.principal_named ? 'Developer named as principal' : 'Developer not named as an insured party')
    } else if (rule === 'calibrationCurrent') {
      if (has(f.next_due_date)) pass(rule, day(f.next_due_date) >= visit, 'Next calibration due ' + f.next_due_date)
      else if (need(rule, f.issue_date, 'Calibration date')) pass(rule, day(f.issue_date) >= addDays(visit, -P.calibrationMaxAgeDays), 'Calibrated ' + f.issue_date + '; limit ' + P.calibrationMaxAgeDays + ' days')
    } else if (rule === 'safetyOfficersEnough') {
      const needN = Math.max(1, Math.ceil(Number(mob.peak_workers || 0) / P.workersPerSafetyOfficer))
      if (need(rule, f.officers_count, 'Number of safety officers')) pass(rule, Number(f.officers_count) >= needN, f.officers_count + ' named; ' + needN + ' needed for ' + mob.peak_workers + ' workers')
    }
  }
  const failed = checks.filter((c) => c.result === 'fail')
  const missing = checks.filter((c) => c.result === 'missing')
  const status = failed.length ? 'rejected' : missing.length ? 'review' : 'accepted'
  return { ...input, paper: { status, checks, expires_on: has(f.valid_to) ? f.valid_to : has(f.next_due_date) ? f.next_due_date : null } }
}

// A typed message that is not evidence: a command, a remark, or a question.
export function readTextCommand(input) {
  const t = String((input.message && input.message.text) || '').trim()
  const low = t.toLowerCase()
  const words = (list) => list.some((w) => low === w || low.startsWith(w + ' ') || low.includes(' ' + w))
  if (!t) return { ...input, command: 'empty' }
  if (words(['status', 'pending', 'baki', 'baaki', 'बाकी', 'kya bacha', 'kitna bacha', 'missing', 'list'])) return { ...input, command: 'gap_list' }
  if (words(['help', 'madad', 'मदद', 'kaise'])) return { ...input, command: 'help' }
  const na = t.match(/\b([A-Z]{2,3})[\s\-]*0*(\d{1,2})\b\s*(?:[-:]\s*)?(?:na|n\/a|not applicable|lagu nahi|लागू नहीं)\b(.*)$/i)
  if (na) return { ...input, command: 'request_na', line: na[1].toUpperCase() + '-' + String(Number(na[2])).padStart(2, '0'), reason: na[3].trim() }
  return { ...input, command: 'remark' }
}

// ---------------------------------------------------------------------------
// WF-03 Walk (the engineer's phone page)
// ---------------------------------------------------------------------------

// Validate one capture from the walk page before anything is stored.
export function validateCapture(input) {
  const b = input.body || {}
  const errors = []
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!uuid.test(String(b.capture_id || ''))) errors.push('capture_id must be a UUID (it makes retries safe)')
  if (!/^[A-Z]{2,3}-\d{2}$/.test(String(b.line || ''))) errors.push('line must be a checklist code like LC-03')
  if (!['ok', 'not_ok', 'na', 'photo'].includes(b.status)) errors.push('status must be ok, not_ok, na or photo')
  if (b.photo_b64 && String(b.photo_b64).length > 7_000_000) errors.push('photo larger than 5 MB')
  if (b.audio_b64 && String(b.audio_b64).length > 14_000_000) errors.push('voice remark larger than 10 MB')
  const g = b.gps
  if (g && !(Math.abs(g.lat) <= 90 && Math.abs(g.lng) <= 180 && g.accuracy > 0)) errors.push('gps is not a valid fix')
  const lineKnown = (input.visit_lines || []).includes(b.line)
  if (b.line && !lineKnown) errors.push('line ' + b.line + ' is not on this site\'s checklist')
  const skew = b.client_ts ? Math.abs(Date.parse(b.client_ts) - Number(input.now || Date.now())) : 0
  return { ...input, valid: errors.length === 0, errors, clock_skew_min: Math.round(skew / 60000) }
}

// Where was the phone, against the areas drawn for this site?
// Phone GPS is honest about its own error: coords.accuracy is a radius in metres (95%).
// So the answer is never just yes/no: in, edge (inside once you allow for the error),
// out, or unknown (no fix / fix too weak to say).
export function geofence(input) {
  const P = Object.assign({ goodFixM: 15, weakFixM: 40, edgeBufferM: 10 }, input.params || {})
  const fix = input.gps
  const zones = Array.isArray(input.zones) ? input.zones : []
  if (!fix || !(fix.accuracy > 0)) return { ...input, geo: { quality: 'none', result: 'unknown', zone: '', distance_m: null, note: 'No GPS fix with this photo' } }
  const quality = fix.accuracy <= P.goodFixM ? 'good' : fix.accuracy <= P.weakFixM ? 'weak' : 'poor'
  const R = 6371000
  const toXY = (lat, lng) => [((lng - fix.lng) * Math.PI / 180) * R * Math.cos(fix.lat * Math.PI / 180), ((lat - fix.lat) * Math.PI / 180) * R]
  const segDist = (p, a, b) => {
    const dx = b[0] - a[0], dy = b[1] - a[1]
    const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy || 1)))
    return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy)
  }
  const measure = (z) => {
    if (z.circle) {
      const c = toXY(z.circle.lat, z.circle.lng)
      const d = Math.hypot(c[0], c[1]) - z.circle.radius_m
      return { inside: d <= 0, edge: Math.abs(d) }
    }
    const pts = (z.polygon || []).map((p) => toXY(p[0], p[1]))
    let inside = false
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const [xi, yi] = pts[i], [xj, yj] = pts[j]
      if ((yi > 0) !== (yj > 0) && 0 < ((xj - xi) * (0 - yi)) / (yj - yi) + xi) inside = !inside
    }
    let edge = Infinity
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) edge = Math.min(edge, segDist([0, 0], pts[j], pts[i]))
    return { inside, edge }
  }
  const scored = zones.map((z) => {
    const m = measure(z)
    return { area: z.area, name: z.name, inside: m.inside, dist: m.inside ? 0 : m.edge, edge: m.edge }
  }).sort((a, b) => a.dist - b.dist)
  const want = input.line_area || ''
  const target = scored.find((s) => s.area === want)
  const slack = fix.accuracy + P.edgeBufferM
  let result = 'unknown'
  if (target) {
    if (target.inside && (target.edge >= fix.accuracy || quality === 'good')) result = 'in'
    else if (target.inside || target.dist <= slack) result = 'edge'
    else result = quality === 'poor' ? 'unknown' : 'out'
  }
  const nearest = scored[0]
  return {
    ...input,
    geo: {
      quality, accuracy_m: Math.round(fix.accuracy), result,
      zone: target ? target.area : '', distance_m: target ? Math.round(target.dist) : null,
      nearest: nearest ? nearest.area : '',
      note: !zones.length ? 'No areas drawn for this site yet'
        : !target ? 'No area drawn for ' + want
        : result === 'in' ? 'Inside ' + target.name
        : result === 'edge' ? 'At the edge of ' + target.name + ' (GPS ±' + Math.round(fix.accuracy) + ' m)'
        : result === 'out' ? Math.round(target.dist) + ' m outside ' + target.name + (nearest && nearest.area !== want ? '; nearest is ' + nearest.name : '')
        : 'GPS too weak (±' + Math.round(fix.accuracy) + ' m) to place it',
    },
  }
}

// Which areas did the engineer actually walk? Built from the trail the walk page sends
// every 20 s while it is open, plus every photo's own fix.
export function walkCoverage(input) {
  const P = Object.assign({ goodFixM: 15, weakFixM: 40, edgeBufferM: 10 }, input.params || {})
  const pts = (input.trail || []).concat((input.captures || []).filter((c) => c.gps).map((c) => ({ ...c.gps, photo: true })))
  const zones = input.zones || []
  const R = 6371000
  const near = (p, z) => {
    const lat0 = p.lat * Math.PI / 180
    const xy = (lat, lng) => [((lng - p.lng) * Math.PI / 180) * R * Math.cos(lat0), ((lat - p.lat) * Math.PI / 180) * R]
    if (z.circle) { const c = xy(z.circle.lat, z.circle.lng); return Math.hypot(c[0], c[1]) - z.circle.radius_m <= p.accuracy + P.edgeBufferM }
    const pts2 = z.polygon.map((q) => xy(q[0], q[1]))
    let inside = false
    for (let i = 0, j = pts2.length - 1; i < pts2.length; j = i++) {
      const [xi, yi] = pts2[i], [xj, yj] = pts2[j]
      if ((yi > 0) !== (yj > 0) && 0 < ((xj - xi) * (0 - yi)) / (yj - yi) + xi) inside = !inside
    }
    if (inside) return true
    let edge = Infinity
    for (let i = 0, j = pts2.length - 1; i < pts2.length; j = i++) {
      const a = pts2[j], b = pts2[i], dx = b[0] - a[0], dy = b[1] - a[1]
      const t = Math.max(0, Math.min(1, (-a[0] * dx - a[1] * dy) / (dx * dx + dy * dy || 1)))
      edge = Math.min(edge, Math.hypot(a[0] + t * dx, a[1] + t * dy))
    }
    return edge <= p.accuracy + P.edgeBufferM
  }
  const areas = (input.walk_areas || [...new Set(zones.map((z) => z.area))]).map((area) => {
    const zs = zones.filter((z) => z.area === area)
    const hits = pts.filter((p) => p.accuracy <= P.weakFixM && zs.some((z) => near(p, z))).sort((a, b) => Date.parse(a.ts) - Date.parse(b.ts))
    const mins = hits.length > 1 ? Math.round((Date.parse(hits[hits.length - 1].ts) - Date.parse(hits[0].ts)) / 60000) : 0
    return {
      area, drawn: zs.length > 0, visited: hits.length > 0, fixes: hits.length, photo_fixes: hits.filter((h) => h.photo).length,
      first: hits.length ? hits[0].ts : '', last: hits.length ? hits[hits.length - 1].ts : '', minutes: mins,
    }
  })
  return { ...input, coverage: { areas, visited: areas.filter((a) => a.visited).length, total: areas.length } }
}

// ---------------------------------------------------------------------------
// WF-04 Evening gap list (7 PM, T-3 to T-1)
// ---------------------------------------------------------------------------

export function gapList(input) {
  const mob = input.mob || {}
  const lines = input.lines || []
  const now = Number(input.now || Date.now())
  const todayIst = new Date(now + 5.5 * 3600 * 1000).toISOString().slice(0, 10) // calendar days in India
  const daysLeft = Math.round((Date.parse(mob.visit_date) - Date.parse(todayIst)) / 86400000)
  const paper = lines.filter((l) => l.when === 'paper')
  const label = { open: 'not received', filed: 'received, being checked', review: 'received, being checked', rejected: 'sent back' }
  const missing = paper.filter((l) => !['accepted', 'na'].includes(l.status))
  const critical = missing.filter((l) => l.severity === 'critical')
  const preWalk = lines.filter((l) => l.when === 'walk' && l.evidence !== 'document')
  const prePhotos = preWalk.filter((l) => l.status === 'filed' || l.status === 'accepted').length
  const byArea = {}
  for (const l of missing) (byArea[l.area] = byArea[l.area] || []).push(l)
  const out = []
  out.push('*' + (mob.project || 'Site') + ': papers still needed*')
  out.push(daysLeft > 0 ? 'Engineer visit in ' + daysLeft + ' day' + (daysLeft === 1 ? '' : 's') + ' (' + mob.visit_date + ').' : 'Engineer visit is today.')
  out.push(paper.length - missing.length + ' of ' + paper.length + ' papers accepted. ' + critical.length + ' critical still open.')
  for (const l of missing) {
    const why = l.status === 'rejected' && l.reason ? ': ' + l.reason : ''
    out.push((l.severity === 'critical' ? '🔴 ' : '• ') + l.code + ' ' + l.text + ' (' + (label[l.status] || l.status) + why + ')')
  }
  out.push('')
  out.push('Site photos sent so far: ' + prePhotos + ' of ' + preWalk.length + ' lines (optional before the visit).')
  out.push('Reply to this message with the paper, or write the line code (e.g. PAP-04) with the photo.')
  const lastIn = Number(input.last_inbound_ms || 0)
  const inWindow = lastIn > 0 && now - lastIn < 23.5 * 3600 * 1000
  return {
    ...input,
    gap: {
      text: out.join('\n'), missing: missing.length, critical: critical.length, total: paper.length,
      mode: inWindow ? 'session' : 'template',
      template: { name: 'vera_mob_gap_list', language: 'en', params: [mob.project || 'Site', String(missing.length), String(critical.length), mob.visit_date || ''] },
      engineer_line: (mob.project || 'Site') + ': ' + (paper.length - missing.length) + '/' + paper.length + ' papers accepted, ' + critical.length + ' critical open' + (critical.length ? ' (' + critical.map((l) => l.code).join(', ') + ')' : '') + '. Site photos on ' + prePhotos + '/' + preWalk.length + ' lines.',
      ready_to_travel: critical.length === 0,
    },
  }
}

// ---------------------------------------------------------------------------
// WF-05 Replies: one message per burst, not one per photo
// ---------------------------------------------------------------------------

export function composeReply(input) {
  const frags = Array.isArray(input.fragments) ? input.fragments : []
  const filed = frags.filter((f) => f.kind === 'filed')
  const accepted = frags.filter((f) => f.kind === 'accepted')
  const rejected = frags.filter((f) => f.kind === 'rejected')
  const review = frags.filter((f) => f.kind === 'review')
  const asks = frags.filter((f) => f.kind === 'unclear')
  const out = []
  if (accepted.length) out.push('✅ Accepted: ' + accepted.map((f) => f.line).join(', '))
  if (filed.length) out.push('📎 Filed: ' + filed.map((f) => f.line).join(', ') + (filed.some((f) => f.photo) ? ' (site photos are checked by the engineer on the visit day)' : ''))
  for (const f of rejected) out.push('↩️ ' + f.line + ' sent back: ' + f.reason)
  if (review.length) out.push('🔎 Being checked by our team: ' + review.map((f) => f.line || 'item').join(', '))
  if (asks.length) out.push('❓ ' + asks.length + ' item' + (asks.length > 1 ? 's' : '') + ' could not be placed. Please reply to it with the line code.')
  if (input.open_count != null) out.push('Still open: ' + input.open_count + ' line' + (input.open_count === 1 ? '' : 's') + '. Send *status* for the list.')
  return { ...input, reply: out.join('\n'), count: frags.length }
}

// ---------------------------------------------------------------------------
// WF-06 End of day: score the visit, then let AI word it, then check the wording
// ---------------------------------------------------------------------------

// The recommendation comes from here, never from AI.
export function scoreVisit(input) {
  const lines = input.lines || []
  const cov = (input.coverage && input.coverage.areas) || []
  const done = (l) => ['ok', 'accepted', 'na'].includes(l.status)
  const openL = lines.filter((l) => !done(l))
  const crit = openL.filter((l) => l.severity === 'critical')
  const major = openL.filter((l) => l.severity === 'major')
  const minor = openL.filter((l) => l.severity === 'minor')
  const missedAreas = cov.filter((a) => !a.visited).map((a) => a.area)
  const unwalked = lines.filter((l) => l.when === 'walk' && !['ok', 'not_ok', 'na'].includes(l.status))
  let recommendation = 'ready'
  if (crit.length || missedAreas.length) recommendation = 'not_ready'
  else if (major.length) recommendation = 'conditional'
  const due = (sev) => (sev === 'critical' ? 0 : sev === 'major' ? 7 : 14)
  const visit = Date.parse((input.visit_date || '1970-01-01') + 'T00:00:00Z')
  const openItems = openL.map((l) => ({
    line: l.code, area: l.area, severity: l.severity, text: l.text,
    finding: l.remark || (l.status === 'rejected' ? l.reason || 'Paper sent back' : l.status === 'not_ok' ? 'Not acceptable on the day' : 'Not checked / not received'),
    due_on: new Date(visit + due(l.severity) * 86400000).toISOString().slice(0, 10),
  }))
  const byArea = {}
  for (const l of lines) {
    const a = (byArea[l.area] = byArea[l.area] || { area: l.area, total: 0, done: 0, open: 0, photos: 0 })
    a.total++
    if (done(l)) a.done++
    else a.open++
    a.photos += Number(l.photos || 0)
  }
  const withEvidence = lines.filter((l) => Number(l.photos || 0) > 0 || l.status === 'accepted' || l.status === 'na').length
  return {
    ...input,
    score: {
      recommendation, critical_open: crit.length, major_open: major.length, minor_open: minor.length,
      areas_missed: missedAreas, lines_unwalked: unwalked.map((l) => l.code),
      done: lines.filter(done).length, total: lines.length,
      prewritten_pct: lines.length ? Math.round((withEvidence / lines.length) * 100) : 0,
      open_items: openItems, by_area: Object.values(byArea),
    },
  }
}

export function buildNarrativeRequest(input) {
  const s = input.score
  const remarks = (input.remarks || []).map((r) => '- [' + r.line + '] ' + r.text + (r.lang && r.lang !== 'en' ? ' (' + r.lang + ')' : '')).join('\n')
  const schema = {
    type: 'object', additionalProperties: false, required: ['areas', 'remarks_en'],
    properties: {
      areas: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['area', 'observation', 'lines'], properties: { area: { type: 'string' }, observation: { type: 'string' }, lines: { type: 'array', items: { type: 'string' } } } } },
      remarks_en: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['line', 'english'], properties: { line: { type: 'string' }, english: { type: 'string' } } } },
    },
  }
  return {
    ...input,
    request: {
      model: input.model || 'claude-opus-5-5',
      max_tokens: 8000,
      fallbacks: 'default',
      output_config: { effort: 'medium', format: { type: 'json_schema', schema } },
      system: [
        'You help a site engineer write the observations section of a mobilisation (NOC) report for a construction site in India.',
        'You get his voice remarks (transcribed, often Hindi, Marathi or Hinglish) and the open items, already decided by code.',
        'Write in plain English, short sentences, in his voice. Translate remarks faithfully; do not add facts that are not in them.',
        'Do not decide or change whether the site is ready, and do not restate counts or dates: those are printed from the checklist.',
        'Every observation must name the line codes it is about.',
      ].join('\n'),
      messages: [{ role: 'user', content: 'Open items:\n' + s.open_items.map((o) => '- [' + o.line + '] ' + o.severity + ': ' + o.text + ' | ' + o.finding).join('\n') + '\n\nEngineer remarks:\n' + (remarks || '(none)') }],
    },
  }
}

// AI wrote the words. Check them before they go into a signed report.
export function checkNarrative(input) {
  const res = input.ai || {}
  const codes = new Set((input.lines || []).map((l) => l.code))
  const tb = (res.content || []).find((b) => b.type === 'text')
  let n = null
  const problems = []
  if (res.stop_reason === 'refusal') problems.push('AI declined')
  try { n = JSON.parse(tb ? tb.text : '') } catch (e) { problems.push('not valid JSON') }
  if (n) {
    for (const a of n.areas || []) {
      for (const c of a.lines || []) if (!codes.has(c)) problems.push('unknown line ' + c)
      if (/\b(noc (is )?(granted|approved|issued)|ready to start|not ready)\b/i.test(a.observation)) problems.push('observation for ' + a.area + ' states a verdict')
    }
    for (const r of n.remarks_en || []) if (!codes.has(r.line)) problems.push('remark for unknown line ' + r.line)
  }
  const ok = problems.length === 0
  // If the words fail the check, the report still goes out: with the engineer's own
  // transcripts instead of the AI wording, and a note saying so.
  return { ...input, narrative: ok ? n : { areas: [], remarks_en: (input.remarks || []).map((r) => ({ line: r.line, english: r.text })) }, narrative_ok: ok, narrative_problems: problems }
}

export function renderReport(input) {
  const s = input.score
  const esc = (v) => String(v == null ? '' : v).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])
  const verdict = { ready: 'Ready to start', conditional: 'Ready to start with conditions', not_ready: 'Not ready' }[s.recommendation]
  const rows = s.open_items.map((o) => '<tr><td>' + esc(o.line) + '</td><td>' + esc(o.severity) + '</td><td>' + esc(o.text) + '<br><small>' + esc(o.finding) + '</small></td><td>' + esc(o.due_on) + '</td></tr>').join('')
  const areas = (input.narrative.areas || []).map((a) => '<h3>' + esc(a.area) + '</h3><p>' + esc(a.observation) + ' <small>(' + esc((a.lines || []).join(', ')) + ')</small></p>').join('')
  const cov = ((input.coverage && input.coverage.areas) || []).map((a) => '<li>' + esc(a.area) + ': ' + (a.visited ? 'walked, ' + a.minutes + ' min, ' + a.photo_fixes + ' photos with GPS' : '<b>no GPS record</b>') + '</li>').join('')
  const html = '<!doctype html><html><head><meta charset="utf-8"><title>NOC draft ' + esc(input.mob.project) + '</title>' +
    '<style>body{font:12px/1.5 Arial,sans-serif;margin:32px;color:#111}h1{font-size:20px}table{border-collapse:collapse;width:100%}td,th{border:1px solid #ccc;padding:4px 6px;text-align:left;vertical-align:top}.v{font-size:16px;font-weight:bold}.ai{color:#555;font-size:11px}</style></head><body>' +
    '<h1>Mobilisation report (draft for signature): ' + esc(input.mob.project) + '</h1>' +
    '<p>' + esc(input.mob.contractor_name) + ' · visit ' + esc(input.visit_date) + ' · checklist ' + esc(input.mob.template_version) + '</p>' +
    '<p class="v">Recommendation from the checklist: ' + esc(verdict) + '</p>' +
    '<p>' + s.done + ' of ' + s.total + ' lines closed. Open: ' + s.critical_open + ' critical, ' + s.major_open + ' major, ' + s.minor_open + ' minor.' + (s.areas_missed.length ? ' Areas with no GPS record: ' + esc(s.areas_missed.join(', ')) + '.' : '') + '</p>' +
    '<h2>Areas walked</h2><ul>' + cov + '</ul>' +
    '<h2>Open items</h2><table><tr><th>Line</th><th>Severity</th><th>Item</th><th>Due</th></tr>' + rows + '</table>' +
    '<h2>Observations</h2>' + areas +
    '<p class="ai">' + (input.narrative_ok ? 'Observations worded by AI from the engineer\'s voice remarks; checked against the checklist.' : 'AI wording failed its check; the engineer\'s transcribed remarks are shown as recorded.') + ' Recommendation, counts and dates are computed from the checklist, not by AI. Every line links to its photo or paper in Vera.</p>' +
    '<p>Signed: ______________________ (engineer) Date: __________</p></body></html>'
  return { ...input, html }
}

// ---------------------------------------------------------------------------
// WF-09 Send: the only way anything leaves Vera on WhatsApp
// ---------------------------------------------------------------------------

// Inside 24 h of the person's last message we may send anything (free).
// Outside it, only an approved template. The window check is ours, not a guess:
// last_inbound_at is written by the router for every message we receive.
export function chooseSendMode(input) {
  const now = Number(input.now || Date.now())
  const last = input.last_inbound_at ? Date.parse(input.last_inbound_at) : 0
  const forceTemplate = !!(input.send_error && input.send_error.action === 'needs_template')
  const open = last > 0 && now - last < 23.5 * 3600 * 1000 && !forceTemplate
  const req = input.request || {}
  const to = String(input.phone || '').replace(/\D/g, '')
  const attempt = Number(input.attempt || 0)
  if (!/^\d{10,15}$/.test(to)) return { ...input, can_send: false, why: 'No valid phone number for this contact' }
  if (open && req.body) return { ...input, can_send: true, mode: 'session', attempt, payload: { messaging_product: 'whatsapp', recipient_type: 'individual', to, ...req.body } }
  if (req.template) {
    return {
      ...input, can_send: true, mode: 'template', attempt,
      payload: {
        messaging_product: 'whatsapp', to, type: 'template',
        template: { name: req.template.name, language: { code: req.template.language || 'en' }, components: [{ type: 'body', parameters: (req.template.params || []).map((p) => ({ type: 'text', text: String(p) })) }] },
      },
    }
  }
  return { ...input, can_send: false, why: 'Outside the 24-hour window and no template for this message' }
}

// What to do when Meta refuses a send. Codes from the Cloud API error reference.
export function classifySendError(input) {
  const e = input.error || {}
  const text = JSON.stringify(e)
  const code = Number((text.match(/"code"\s*:\s*(\d{3,6})/) || [])[1] || 0)
  const attempt = Number(input.attempt || 0) + 1
  let action = 'review'
  let note = 'Send failed: ' + (e.message || 'unknown error')
  if ([131056, 130429, 80007].includes(code)) { action = attempt < 3 ? 'retry' : 'review'; note = 'Rate limited by WhatsApp (' + code + ')' }
  else if (code === 131047) { action = 'needs_template'; note = 'More than 24 h since their last message: needs a template' }
  else if ([131026, 131051, 131052, 131053].includes(code)) { action = 'review'; note = 'WhatsApp could not deliver to this number (' + code + ')' }
  else if (/ETIMEDOUT|ECONNRESET|5\d\d/.test(text) && attempt < 3) { action = 'retry'; note = 'WhatsApp did not answer; retrying' }
  return { ...input, attempt, send_error: { code, action, note } }
}

// One-tap confirmation: up to 3 buttons (WhatsApp's limit), else a list (up to 10 rows).
export function buildConfirm(input) {
  const opts = (input.options || []).slice(0, 10)
  const byCode = {}
  for (const l of input.lines || []) byCode[l.code] = l
  const short = (s, n) => (s.length > n ? s.slice(0, n - 1) + '…' : s)
  const ev = input.evidence_id || input.message_id
  const body = { text: 'Which checklist line is this for?' + (input.reason ? '\n' + short(input.reason, 200) : '') }
  let interactive
  if (opts.length && opts.length <= 2) {
    interactive = {
      type: 'button', body,
      action: { buttons: opts.map((c) => ({ type: 'reply', reply: { id: 'bind:' + ev + ':' + c, title: short(c + ' ' + (byCode[c] ? byCode[c].text : ''), 20) } })).concat([{ type: 'reply', reply: { id: 'bind:' + ev + ':OTHER', title: 'Something else' } }]) },
    }
  } else {
    const rows = (opts.length ? opts : (input.lines || []).filter((l) => !['accepted', 'ok', 'na'].includes(l.status)).slice(0, 9).map((l) => l.code))
      .map((c) => ({ id: 'bind:' + ev + ':' + c, title: short(c, 24), description: short(byCode[c] ? byCode[c].text : '', 72) }))
    rows.push({ id: 'bind:' + ev + ':OTHER', title: 'Something else', description: 'Type the line code, e.g. LC-03' })
    interactive = { type: 'list', body, action: { button: 'Choose line', sections: [{ title: 'Open lines', rows: rows.slice(0, 10) }] } }
  }
  return { ...input, request: { body: { type: 'interactive', context: input.wamid ? { message_id: input.wamid } : undefined, interactive } } }
}

// Button and list answers carry their meaning in the id we gave them: "<verb>:<ref>:<value>".
export function parseAnswer(input) {
  const i = (input.message && input.message.interactive) || {}
  const [verb, ref, value] = String(i.id || '').split(':')
  const allowed = { bind: ['contractor', 'engineer', 'reviewer'], pick: ['contractor', 'engineer'], na: ['engineer'], close: ['engineer'], sign: ['engineer'], review: ['reviewer'] }
  const role = input.contact_role || ''
  if (!allowed[verb]) return { ...input, answer: { ok: false, why: 'Unknown button' } }
  if (!allowed[verb].includes(role)) return { ...input, answer: { ok: false, why: 'Only ' + allowed[verb].join(' / ') + ' can do this' } }
  if (verb === 'sign' && !['approve', 'conditions', 'hold'].includes(value)) return { ...input, answer: { ok: false, why: 'Unknown sign-off choice' } }
  return { ...input, answer: { ok: true, verb, ref, value, by: input.contact_id, at: new Date(Number(input.now || Date.now())).toISOString() } }
}

// ---------------------------------------------------------------------------
// WF-08 Set up a new site
// ---------------------------------------------------------------------------

export function validateSetup(input) {
  const f = input
  const errors = []
  const day = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''))
  const phone = (s) => /^\d{10,15}$/.test(String(s || '').replace(/\D/g, ''))
  if (!f.project) errors.push('Project name is needed')
  if (!f.contractor_name) errors.push('Contractor name is needed')
  if (!day(f.start_date) || !day(f.visit_date) || !day(f.contract_end)) errors.push('Dates must be YYYY-MM-DD')
  if (day(f.visit_date) && day(f.start_date) && f.visit_date > f.start_date) errors.push('Visit must be on or before the start date')
  if (!(Number(f.contract_value_inr) > 0)) errors.push('Contract value must be a number in rupees')
  if (!(Number(f.peak_workers) > 0)) errors.push('Planned peak labour must be a number')
  if (!phone(f.contractor_phone)) errors.push('Contractor phone must have country code, e.g. 9198xxxxxxxx')
  if (!phone(f.engineer_phone)) errors.push('Engineer phone must have country code')
  if (!['plant', 'rmc'].includes(f.concrete)) errors.push('Concrete must be "plant" or "rmc"')
  const list = (s) => String(s || '').split(/[,;\n]/).map((x) => x.trim()).filter(Boolean)
  return {
    ...input, valid: errors.length === 0, errors,
    clean: {
      project: String(f.project || '').trim(), package: String(f.package || '').trim(),
      contractor_name: String(f.contractor_name || '').trim(), contractor_aliases: list(f.contractor_aliases),
      site_address: String(f.site_address || '').trim(), site_keywords: list(f.site_keywords),
      start_date: f.start_date, visit_date: f.visit_date, contract_end: f.contract_end,
      contract_value_inr: Number(f.contract_value_inr), peak_workers: Number(f.peak_workers),
      flags: { concrete: f.concrete, lifting: /yes|true|1/i.test(String(f.lifting)), creche: /yes|true|1/i.test(String(f.creche)), excavation: /yes|true|1/i.test(String(f.excavation)) },
      contractor_phone: String(f.contractor_phone || '').replace(/\D/g, ''), engineer_phone: String(f.engineer_phone || '').replace(/\D/g, ''),
    },
  }
}

// Copy the template lines that apply to this site. The template comes in from the Code node.
export function instantiateChecklist(input) {
  const s = input.clean
  const flags = { onSitePlant: s.flags.concrete === 'plant', rmc: s.flags.concrete === 'rmc', lifting: s.flags.lifting, creche: s.flags.creche, excavation: s.flags.excavation }
  const rows = (input.template || []).filter((l) => !l.appliesIf || flags[l.appliesIf]).map((l) => ({
    code: l.code, area: l.area, text: l.text, evidence: l.evidence, when: l.when, severity: l.severity,
    doc_type: l.docType || null, rules: l.rules || [], hint: l.hint || '', status: 'open',
  }))
  const areas = (input.areas || []).filter((a) => rows.some((r) => r.area === a.code))
  return { ...input, checklist: rows, checklist_areas: areas }
}

// One prompt per area. Replying to it with photos files them under that area for sure;
// a number in the caption picks the line. This is what keeps AI's guessing small.
export function buildAreaPrompts(input) {
  const rows = input.checklist || []
  const out = []
  for (const a of input.checklist_areas || []) {
    const ls = rows.filter((r) => r.area === a.code)
    const lines = ls.map((l) => Number(l.code.split('-')[1]) + '. ' + l.text + (l.severity === 'critical' ? ' 🔴' : '')).join('\n')
    out.push({
      mobilisation_id: input.mobilisation_id, contact_id: input.contractor_contact_id, kind: 'area', area: a.code, line_code: '',
      request: { body: { type: 'text', text: { preview_url: false, body: '*' + a.name + ' (' + a.code + ')*\n' + lines + '\n\nReply to *this message* with photos or papers for ' + a.name + '. Write the number in the caption (e.g. 3).' } } },
    })
  }
  return out
}

// ---------------------------------------------------------------------------
// WF-07 Open items after the visit
// ---------------------------------------------------------------------------

export function reminderPlan(input) {
  const today = String(input.today || new Date().toISOString().slice(0, 10))
  const it = input.item || {}
  const overdueDays = Math.round((Date.parse(today) - Date.parse(it.due_on)) / 86400000)
  const who = it.severity === 'critical' && overdueDays >= 1 ? 'escalate' : 'contractor'
  const text = (overdueDays > 0 ? '⏰ Overdue by ' + overdueDays + ' day' + (overdueDays > 1 ? 's' : '') : '📌 Due today') + ': ' + it.line + ' ' + it.text +
    (it.finding ? '\nFinding: ' + it.finding : '') + '\nReply to *this message* with a photo once it is fixed. The engineer approves it from the photo.'
  return {
    ...input, who, overdue_days: overdueDays,
    request: {
      body: { type: 'text', text: { preview_url: false, body: text } },
      template: { name: 'vera_mob_open_item', language: 'en', params: [it.line, it.text, it.due_on] },
    },
    escalation: who === 'escalate' ? (input.project || 'Site') + ': critical item ' + it.line + ' is ' + overdueDays + ' day(s) overdue. ' + it.text : '',
  }
}
