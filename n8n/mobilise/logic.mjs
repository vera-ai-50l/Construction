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
    return done({ line: prompt.line, method: prompt.kind === 'open_item' ? 'reply-to-open-item' : 'reply-to-line', confidence: 1, candidates: [], open_item: prompt.kind === 'open_item' ? String(prompt.ref || '') : '' })
  }

  const text = [m.caption, m.text, m.filename].filter(Boolean).join(' ')
  const codeRe = new RegExp('(?<![A-Za-z0-9])(' + areas.join('|') + ')[\\s_\\-\\.]*0*(\\d{1,2})(?!\\d)', 'gi')
  const found = new Set()
  let hit
  while (areas.length && (hit = codeRe.exec(text))) {
    const code = hit[1].toUpperCase() + '-' + String(Number(hit[2])).padStart(2, '0')
    if (byCode[code]) found.add(code)
  }
  // Spoken codes, as speech-to-text writes them: "एल.सी. तीन" (LC 3), "एसएफ आठ" (SF 8),
  // "एस.वाय.एक." (SY 1), "LC teen", "BP zero six". Letter names and number words in Hindi,
  // Marathi and English; only sequences that spell a real area code count.
  const letterNames = [['डब्ल्यू', 'W'], ['डबल्यू', 'W'], ['वाय', 'Y'], ['वाई', 'Y'], ['एफ', 'F'], ['एल', 'L'], ['एस', 'S'], ['बी', 'B'], ['सी', 'C'], ['डी', 'D'], ['पी', 'P'], ['आर', 'R'], ['ए', 'A']]
  const numberWords = {
    0: ['zero', 'शून्य'], 1: ['one', 'ek', 'एक'], 2: ['two', 'do', 'दो', 'दोन'], 3: ['three', 'teen', 'तीन'], 4: ['four', 'char', 'chaar', 'चार'],
    5: ['five', 'paanch', 'panch', 'पांच', 'पाँच', 'पाच'], 6: ['six', 'chhe', 'chah', 'chhah', 'छह', 'छः', 'छे', 'सहा'], 7: ['seven', 'saat', 'सात'],
    8: ['eight', 'aath', 'आठ'], 9: ['nine', 'nau', 'नौ', 'नऊ'], 10: ['ten', 'das', 'दस', 'दहा'], 11: ['eleven', 'gyarah', 'ग्यारह', 'अकरा'],
    12: ['twelve', 'barah', 'बारह', 'बारा'], 13: ['thirteen', 'terah', 'तेरह', 'तेरा'], 14: ['fourteen', 'chaudah', 'चौदह', 'चौदा'],
    15: ['fifteen', 'pandrah', 'पंद्रह', 'पंधरा'], 16: ['sixteen', 'solah', 'सोलह', 'सोळा'],
  }
  const wordToN = {}
  for (const [k, ws] of Object.entries(numberWords)) for (const w of ws) wordToN[w] = Number(k)
  const esc = (x) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const L = letterNames.map((x) => esc(x[0])).join('|')
  const W = Object.keys(wordToN).sort((a, b) => b.length - a.length).map(esc).join('|')
  const edge = '(?![\\u0900-\\u097FA-Za-z])'
  const spokenRe = new RegExp('(?<![\\u0900-\\u097FA-Za-z])((?:(?:' + L + '|[A-Za-z])[\\s.\\-]*){2,3}?)[\\s.\\-]*(\\d{1,2}|(?:' + W + ')' + edge + '(?:[\\s\\-]*(?:' + W + ')' + edge + ')?)', 'gi')
  const toLatin = (seq) => {
    let out = ''
    let rest = seq.replace(/[\s.\-]/g, '')
    while (rest) {
      const hitL = letterNames.find(([dev]) => rest.startsWith(dev))
      if (hitL) { out += hitL[1]; rest = rest.slice(hitL[0].length) } else if (/^[A-Za-z]/.test(rest)) { out += rest[0].toUpperCase(); rest = rest.slice(1) } else return ''
    }
    return out
  }
  const toNumber = (num) => {
    if (/^\d+$/.test(num)) return Number(num)
    const parts = num.toLowerCase().split(/[\s\-]+/).filter(Boolean).map((w) => wordToN[w])
    if (parts.some((x) => x === undefined)) return NaN
    return parts.length === 2 ? (parts[0] === 0 ? parts[1] : parts[0] * 10 + parts[1]) : parts[0]
  }
  let sp
  while (areas.length && (sp = spokenRe.exec(text))) {
    const area = toLatin(sp[1])
    const num = toNumber(sp[2])
    if (!areas.includes(area) || !(num >= 1 && num <= 99)) continue
    const code = area + '-' + String(num).padStart(2, '0')
    if (byCode[code]) found.add(code)
  }
  if (found.size === 1) return done({ line: [...found][0], method: m.type === 'audio' ? 'spoken-code' : 'caption-code', confidence: 1, candidates: [] })
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
  if (input.contact_role === 'reviewer') return { ...input, command: 'help', help: 'reviewer' }
  if (!t) return { ...input, command: 'empty' }
  if (words(['status', 'pending', 'baki', 'baaki', 'बाकी', 'kya bacha', 'kitna bacha', 'missing', 'list'])) return { ...input, command: 'gap_list' }
  if (words(['help', 'madad', 'मदद', 'kaise'])) return { ...input, command: 'help' }
  const na = t.match(/\b([A-Z]{2,3})[\s\-]*0*(\d{1,2})\b\s*(?:[-:]\s*)?(?:na|n\/a|not applicable|lagu nahi|लागू नहीं)\b(.*)$/i)
  if (na) {
    const line = na[1].toUpperCase() + '-' + String(Number(na[2])).padStart(2, '0')
    const known = (input.lines || []).some((l) => l.code === line)
    if (!known) return { ...input, command: 'help', help: 'unknown_line', line }
    return { ...input, command: 'request_na', line, reason: na[3].trim() }
  }
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
  // A QR sticker scanned in the last few minutes (verified by the walk API) places the photo
  // in that area even indoors, where GPS cannot. GPS is still recorded and reported.
  const spot = String(input.spot_area || '')
  const spotHit = !!spot && spot === String(input.line_area || '')
  if (!fix || !(fix.accuracy > 0)) {
    return { ...input, geo: { quality: 'none', result: spotHit ? 'in' : 'unknown', zone: spotHit ? spot : '', distance_m: null, spot, note: spotHit ? 'Sticker for ' + spot + ' scanned; no GPS fix' : 'No GPS fix with this photo' } }
  }
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
  const gpsNote = !zones.length ? 'No areas drawn for this site yet'
        : !target ? 'No area drawn for ' + want
        : result === 'in' ? 'Inside ' + target.name
        : result === 'edge' ? 'At the edge of ' + target.name + ' (GPS ±' + Math.round(fix.accuracy) + ' m)'
        : result === 'out' ? Math.round(target.dist) + ' m outside ' + target.name + (nearest && nearest.area !== want ? '; nearest is ' + nearest.name : '')
        : 'GPS too weak (±' + Math.round(fix.accuracy) + ' m) to place it'
  return {
    ...input,
    geo: {
      quality, accuracy_m: Math.round(fix.accuracy), result: spotHit ? 'in' : result, gps_result: result, spot,
      zone: target ? target.area : spotHit ? spot : '', distance_m: target ? Math.round(target.dist) : null,
      nearest: nearest ? nearest.area : '',
      note: spotHit ? 'Sticker for ' + spot + ' scanned · GPS: ' + gpsNote : spot ? gpsNote + ' · last sticker scanned: ' + spot : gpsNote,
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
    // A sticker scan whose own GPS fix (a usable one) is far from every shape drawn for its
    // area is not counted: it may be a photo of the sticker scanned somewhere else.
    const stickers = (input.spots || []).filter((s) => s.area === area)
    const far = (s) => !!(s.gps && s.gps.accuracy > 0 && s.gps.accuracy <= P.weakFixM && zs.length && !zs.some((z) => near({ ...s.gps, accuracy: s.gps.accuracy + (P.stickerGraceM || 50) }, z)))
    const trusted = stickers.filter((s) => !far(s))
    const hits = pts.filter((p) => p.accuracy <= P.weakFixM && zs.some((z) => near(p, z))).concat(trusted.map((s) => ({ ts: s.ts, sticker: true })))
      .sort((a, b) => Date.parse(a.ts) - Date.parse(b.ts))
    const mins = hits.length > 1 ? Math.round((Date.parse(hits[hits.length - 1].ts) - Date.parse(hits[0].ts)) / 60000) : 0
    return {
      area, drawn: zs.length > 0, visited: hits.length > 0, fixes: hits.filter((h) => !h.sticker).length, photo_fixes: hits.filter((h) => h.photo).length, stickers: trusted.length, sticker_mismatch: stickers.length - trusted.length,
      first: hits.length ? hits[0].ts : '', last: hits.length ? hits[hits.length - 1].ts : '', minutes: mins,
    }
  })
  return { ...input, coverage: { areas, visited: areas.filter((a) => a.visited).length, total: areas.length } }
}

// The engineer marks an area on the walk page: standing in it (a circle from averaged
// fixes) or walking its corners (a polygon). Checked before it replaces what was there.
export function validateZone(input) {
  const b = input.body || {}
  const errors = []
  const areas = Array.isArray(input.areas) ? input.areas : []
  const sh = b.shape || {}
  const okPt = (p) => Array.isArray(p) && p.length === 2 && Math.abs(p[0]) <= 90 && Math.abs(p[1]) <= 180
  if (!/^[A-Z]{2,3}$/.test(String(b.area || ''))) errors.push('area must be an area code like LC')
  else if (areas.length && !areas.includes(b.area)) errors.push('area ' + b.area + ' is not on this site\'s checklist')
  let shape = null
  if (sh.circle) {
    const c = sh.circle
    if (!(Math.abs(c.lat) <= 90 && Math.abs(c.lng) <= 180)) errors.push('circle centre is not a valid point')
    if (!(c.radius_m >= 5 && c.radius_m <= 150)) errors.push('radius must be 5 to 150 m')
    if (!(c.accuracy_m > 0 && c.accuracy_m <= 30)) errors.push('GPS was too weak to mark the area (need ±30 m or better)')
    shape = { circle: { lat: Number(c.lat), lng: Number(c.lng), radius_m: Math.round(c.radius_m) } }
  } else if (Array.isArray(sh.polygon)) {
    const p = sh.polygon
    if (p.length < 3 || p.length > 30 || !p.every(okPt)) errors.push('outline needs 3 to 30 valid corners')
    else {
      const R = 6371000
      const lat0 = p[0][0] * Math.PI / 180
      const xy = p.map((q) => [q[1] * Math.PI / 180 * R * Math.cos(lat0), q[0] * Math.PI / 180 * R])
      let a = 0
      for (let i = 0, j = xy.length - 1; i < xy.length; j = i++) a += xy[j][0] * xy[i][1] - xy[i][0] * xy[j][1]
      const area = Math.abs(a / 2)
      if (area < 20) errors.push('outline is too small (under 20 m²): walk the real corners')
      if (area > 200000) errors.push('outline is larger than 20 hectares')
    }
    if (!(sh.accuracy_m > 0 && sh.accuracy_m <= 30)) errors.push('GPS was too weak at one of the corners (need ±30 m or better)')
    shape = { polygon: p.map((q) => [Number(q[0]), Number(q[1])]) }
  } else errors.push('shape must be a circle or a polygon')
  const name = String(b.name || '').trim().slice(0, 60) || String(b.area || '')
  return { ...input, valid: errors.length === 0, errors, zone: { area: b.area, name, shape } }
}

// ---------------------------------------------------------------------------
// WF-04 Evening gap list (7 PM, T-3 to T-1)
// ---------------------------------------------------------------------------

export function gapList(input) {
  // Text in the person's language (input.lang), from messages.mjs (input.texts, added by the node); English if missing.
  const T = (k, v) => { const all = input.texts || {}; const t = (all[input.lang] || {})[k] || (all.en || {})[k] || k; return String(t).replace(/\{(\w+)\}/g, (_, n) => (v && v[n] != null ? String(v[n]) : '')) }
  const mob = input.mob || {}
  const lines = input.lines || []
  const now = Number(input.now || Date.now())
  const todayIst = new Date(now + 5.5 * 3600 * 1000).toISOString().slice(0, 10) // calendar days in India
  const daysLeft = Math.round((Date.parse(mob.visit_date) - Date.parse(todayIst)) / 86400000)
  const paper = lines.filter((l) => l.when === 'paper')
  const missing = paper.filter((l) => !['accepted', 'na'].includes(l.status))
  const critical = missing.filter((l) => l.severity === 'critical')
  const preWalk = lines.filter((l) => l.when === 'walk' && l.evidence !== 'document')
  const prePhotos = preWalk.filter((l) => l.status === 'filed' || l.status === 'accepted').length
  const project = mob.project || 'Site'
  const out = []
  out.push(T('gap_title', { project }))
  out.push(daysLeft > 0 ? T(daysLeft === 1 ? 'gap_visit_in_1' : 'gap_visit_in_n', { n: daysLeft, date: mob.visit_date }) : T('gap_visit_today'))
  out.push(T('gap_counts', { ok: paper.length - missing.length, total: paper.length, crit: critical.length }))
  for (const l of missing) {
    const why = l.status === 'rejected' && l.reason ? ': ' + l.reason : ''
    out.push((l.severity === 'critical' ? '🔴 ' : '• ') + l.code + ' ' + l.text + ' (' + T('st_' + l.status) + why + ')')
  }
  out.push('')
  out.push(T('gap_photos', { n: prePhotos, total: preWalk.length }))
  out.push(T('gap_reply'))
  const lastIn = Number(input.last_inbound_ms || 0)
  const inWindow = lastIn > 0 && now - lastIn < 23.5 * 3600 * 1000
  return {
    ...input, texts: undefined,
    gap: {
      text: out.join('\n'), missing: missing.length, critical: critical.length, total: paper.length,
      mode: inWindow ? 'session' : 'template',
      template: { name: 'vera_mob_gap_list', language: ['hi', 'mr'].includes(input.lang) ? input.lang : 'en', params: [project, String(missing.length), String(critical.length), mob.visit_date || ''] },
      engineer_line: project + ': ' + (paper.length - missing.length) + '/' + paper.length + ' papers accepted, ' + critical.length + ' critical open' + (critical.length ? ' (' + critical.map((l) => l.code).join(', ') + ')' : '') + '. Site photos on ' + prePhotos + '/' + preWalk.length + ' lines.',
      ready_to_travel: critical.length === 0,
    },
  }
}

// ---------------------------------------------------------------------------
// WF-05 Replies: one message per burst, not one per photo
// ---------------------------------------------------------------------------

export function composeReply(input) {
  // Text in the person's language (input.lang), from messages.mjs (input.texts, added by the node); English if missing.
  const T = (k, v) => { const all = input.texts || {}; const t = (all[input.lang] || {})[k] || (all.en || {})[k] || k; return String(t).replace(/\{(\w+)\}/g, (_, n) => (v && v[n] != null ? String(v[n]) : '')) }
  const frags = Array.isArray(input.fragments) ? input.fragments : []
  const of = (k) => frags.filter((f) => f.kind === k)
  const codes = (k) => of(k).map((f) => f.line || T('r_review_item')).join(', ')
  const out = []
  if (of('accepted').length) out.push(T('r_accepted', { lines: codes('accepted') }))
  if (of('filed').length) out.push(T('r_filed', { lines: codes('filed') }) + (of('filed').some((f) => f.photo) ? T('r_filed_photo_note') : ''))
  for (const f of of('rejected')) out.push(T('r_rejected', { line: f.line, reason: f.reason }))
  if (of('review').length) out.push(T('r_review', { lines: codes('review') }))
  if (of('na').length) out.push(T('r_na', { lines: codes('na') }))
  for (const f of of('na_refused')) out.push(T('r_na_refused', { line: f.line }))
  if (of('closed').length) out.push(T('r_closed', { lines: codes('closed') }))
  for (const f of of('reopened')) out.push(T('r_reopened', { line: f.line }))
  for (const f of of('resend')) out.push(T(f.line ? 'r_resend_line' : 'r_resend', { line: f.line, reason: f.reason || T('r_resend_default') }))
  const asks = of('unclear').length
  if (asks) out.push(T(asks === 1 ? 'r_unclear_1' : 'r_unclear_n', { n: asks }))
  if (input.open_count != null) out.push(T(Number(input.open_count) === 1 ? 'r_open_1' : 'r_open_n', { n: input.open_count }))
  return { ...input, texts: undefined, reply: out.join('\n'), count: frags.length }
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
  const mob = input.mob || {}
  const esc = (v) => String(v == null ? '' : v).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])
  const AREA = { PAP: 'Papers and licences', DR: 'Drawings and design readiness', LC: 'Labour camp', SY: 'Stores yard', BP: 'Batching plant / RMC', FW: 'Formwork and scaffolding', SF: 'Safety set-up' }
  const areaName = (a) => AREA[a] || a
  const ist = (ts) => (ts ? new Date(Date.parse(ts) + 5.5 * 3600 * 1000).toISOString().slice(11, 16) : '')
  const verdict = { ready: 'Ready to start', conditional: 'Ready to start with conditions', not_ready: 'Not ready' }[s.recommendation]
  const tone = { ready: 'ok', conditional: 'warn', not_ready: 'bad' }[s.recommendation]
  const why = []
  if (s.critical_open) why.push(s.critical_open + ' critical item' + (s.critical_open > 1 ? 's' : '') + ' open')
  if ((s.areas_missed || []).length) why.push('no GPS or sticker record for ' + s.areas_missed.map(areaName).join(', '))
  if (!why.length && s.major_open) why.push(s.major_open + ' major item' + (s.major_open > 1 ? 's' : '') + ' open, each with a due date')
  if (!why.length) why.push('every critical and major line is closed')
  const english = {}
  for (const r of (input.narrative && input.narrative.remarks_en) || []) english[r.line] = r.english
  const sev = (x) => '<span class="sev ' + esc(x) + '">' + esc(x) + '</span>'
  const order = { critical: 0, major: 1, minor: 2 }
  const items = (s.open_items || []).slice().sort((a, b) => order[a.severity] - order[b.severity] || String(a.line).localeCompare(String(b.line)))
  const rows = items.map((o) => '<tr><td class="code">' + esc(o.line) + '</td><td>' + sev(o.severity) + '</td><td>' + esc(o.text) + '<div class="finding">' + esc(english[o.line] || o.finding) + '</div></td><td class="nowrap">' + esc(o.due_on) + '</td></tr>').join('')
  const cov = ((input.coverage && input.coverage.areas) || []).map((a) => '<tr><td>' + esc(areaName(a.area)) + '</td><td>' +
    (a.visited ? (a.first ? esc(ist(a.first)) + (a.last && a.last !== a.first ? '–' + esc(ist(a.last)) : '') + ' · ' + a.minutes + ' min' : 'walked') : '<b>no GPS or sticker record</b>') +
    '</td><td class="num">' + (a.fixes || 0) + '</td><td class="num">' + (a.photo_fixes || 0) + '</td><td class="num">' + (a.stickers || 0) + '</td><td>' +
    (a.sticker_mismatch ? '<b>' + a.sticker_mismatch + ' sticker scan' + (a.sticker_mismatch > 1 ? 's' : '') + ' with GPS far from this area (not counted)</b>' : a.drawn === false ? 'area not drawn' : '') + '</td></tr>').join('')
  const obs = ((input.narrative && input.narrative.areas) || []).map((a) => '<div class="obs"><h3>' + esc(areaName(a.area)) + ' <span class="codes">' + esc((a.lines || []).join(', ')) + '</span></h3><p>' + esc(a.observation) + '</p></div>').join('')
  const remarks = (input.remarks || []).map((r) => '<tr><td class="code">' + esc(r.line) + '</td><td lang="' + esc(String(r.lang || '').slice(0, 2)) + '">' + esc(r.text) + (r.lang && !/^en/.test(r.lang) ? ' <span class="lang">' + esc(r.lang) + '</span>' : '') + '</td><td>' + esc(english[r.line] || '') + '</td></tr>').join('')
  const byArea = (s.by_area || []).map((a) => '<tr><td>' + esc(areaName(a.area)) + '</td><td class="num">' + a.done + '/' + a.total + '</td><td class="num">' + a.open + '</td><td class="num">' + a.photos + '</td></tr>').join('')
  const stat = (n, label, cls) => '<div class="stat ' + (cls || '') + '"><b>' + esc(n) + '</b><span>' + esc(label) + '</span></div>'
  const html = '<!doctype html><html lang="en"><head><meta charset="utf-8"><title>NOC draft ' + esc(mob.project) + '</title><style>' +
    '@page{size:A4;margin:16mm 14mm 18mm}*{box-sizing:border-box}body{font:10.5px/1.5 "Noto Sans","Noto Sans Devanagari",Arial,sans-serif;color:#1d1813;margin:0}' +
    '.top{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #1d1813;padding-bottom:8px}.brand{font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:#7d7166}' +
    'h1{font-size:19px;margin:2px 0 0}.draft{border:1.5px solid #b4532a;color:#b4532a;font-weight:700;font-size:10px;padding:3px 8px;letter-spacing:.06em;text-transform:uppercase}' +
    '.meta{display:grid;grid-template-columns:repeat(4,1fr);gap:6px 14px;margin:10px 0 12px}.meta div{font-size:9.5px;color:#7d7166}.meta b{display:block;color:#1d1813;font-size:10.5px;font-weight:600}' +
    '.verdict{border-radius:6px;padding:10px 14px;margin:0 0 10px}.verdict b{font-size:16px;display:block}.verdict.bad{background:#f6e2d8;border-left:5px solid #b4532a}.verdict.warn{background:#f3e3c2;border-left:5px solid #c08a2b}.verdict.ok{background:#dfe5d6;border-left:5px solid #6f7f62}' +
    '.stats{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin:0 0 14px}.stat{border:1px solid #e3dccf;border-radius:6px;padding:7px 9px}.stat b{font-size:17px;display:block;line-height:1.1}.stat span{color:#7d7166;font-size:9.5px}.stat.bad b{color:#b4532a}.stat.warn b{color:#a06f17}' +
    'h2{font-size:12.5px;margin:16px 0 6px;padding-bottom:3px;border-bottom:1px solid #e3dccf;break-after:avoid}h3{break-after:avoid}.obs,.box,.verdict,.stats{break-inside:avoid}h3{font-size:11px;margin:8px 0 2px}.codes{font-weight:400;color:#7d7166;font-family:monospace;font-size:9.5px}' +
    'table{border-collapse:collapse;width:100%;page-break-inside:auto}tr{page-break-inside:avoid}th{text-align:left;font-size:9px;text-transform:uppercase;letter-spacing:.05em;color:#7d7166;font-weight:600;border-bottom:1px solid #cfc6b6;padding:4px 6px}' +
    'td{border-bottom:1px solid #eee7da;padding:5px 6px;vertical-align:top}.code{font-family:monospace;white-space:nowrap}.num{text-align:right;font-variant-numeric:tabular-nums}.nowrap{white-space:nowrap}.finding{color:#4a4038;font-size:9.5px;margin-top:2px}' +
    '.sev{display:inline-block;border-radius:9px;padding:0 7px;font-size:9px;font-weight:600}.sev.critical{background:#f6e2d8;color:#9c4220}.sev.major{background:#f3e3c2;color:#8a5d12}.sev.minor{background:#ece7dd;color:#4a4038}' +
    '.lang{font-size:8.5px;color:#7d7166;border:1px solid #d9d1c3;border-radius:3px;padding:0 3px}.obs p{margin:0 0 4px}.cols{display:grid;grid-template-columns:1.25fr 1fr;gap:16px}' +
    '.sign{display:grid;grid-template-columns:1.4fr 1fr;gap:16px;margin-top:10px}.box{border:1px solid #cfc6b6;border-radius:6px;padding:10px 12px;min-height:70px}.choice{margin:3px 0}.choice i{display:inline-block;width:10px;height:10px;border:1px solid #1d1813;margin-right:6px;vertical-align:-1px}' +
    '.ai{color:#4a4038;font-size:9.5px;background:#f6f1e7;border-radius:6px;padding:8px 10px;margin-top:12px}' +
    '</style></head><body>' +
    '<div class="top"><div><div class="brand">Vera · Mobilisation report</div><h1>' + esc(mob.project) + '</h1></div><div class="draft">Draft for signature</div></div>' +
    '<div class="meta"><div>Contractor<b>' + esc(mob.contractor_name) + '</b></div><div>Site<b>' + esc(mob.site_address || '') + '</b></div><div>Visit<b>' + esc(input.visit_date) + '</b></div><div>Checklist<b>' + esc(mob.template_version) + (input.version ? ' · report v' + esc(input.version) : '') + '</b></div></div>' +
    '<div class="verdict ' + tone + '"><b>Recommendation from the checklist: ' + esc(verdict) + '</b>' + esc(why.join('; ')) + '.</div>' +
    '<div class="stats">' + stat(s.done + '/' + s.total, 'lines closed') + stat(s.critical_open, 'critical open', s.critical_open ? 'bad' : '') + stat(s.major_open, 'major open', s.major_open ? 'warn' : '') + stat(s.minor_open, 'minor open') + stat((s.prewritten_pct || 0) + '%', 'lines with evidence on file') + '</div>' +
    '<h2>Open items</h2>' + (rows ? '<table><tr><th>Line</th><th>Severity</th><th>Item and finding</th><th>Due</th></tr>' + rows + '</table>' : '<p>None.</p>') +
    '<h2>Areas walked</h2><table><tr><th>Area</th><th>On site (IST)</th><th class="num">GPS fixes</th><th class="num">Photos with GPS</th><th class="num">Stickers</th><th></th></tr>' + cov + '</table>' +
    '<h2>Observations</h2>' + (obs || '<p>No observations recorded.</p>') +
    (remarks ? '<h2>Engineer\'s remarks, as spoken</h2><table><tr><th>Line</th><th>Original</th><th>English</th></tr>' + remarks + '</table>' : '') +
    '<div class="cols"><div><h2>Lines by area</h2><table><tr><th>Area</th><th class="num">Closed</th><th class="num">Open</th><th class="num">Photos</th></tr>' + byArea + '</table></div>' +
    '<div><h2>Sign-off</h2><div class="box"><div class="choice"><i></i>Approve</div><div class="choice"><i></i>Approve with the conditions above</div><div class="choice"><i></i>Hold</div></div></div></div>' +
    '<div class="sign"><div class="box">Signed: ______________________ (engineer)<br><br>Name: ______________________</div><div class="box">Date: __________<br><br>Signed on WhatsApp by the engineer\'s own number; the tap and its message id are kept with this report.</div></div>' +
    '<p class="ai">' + (input.narrative_ok ? 'Observations worded by AI from the engineer\'s voice remarks; checked against the checklist.' : 'AI wording failed its check; the engineer\'s transcribed remarks are shown as recorded.') +
    ' Recommendation, counts and dates are computed from the checklist, not by AI. Areas count as walked only with GPS fixes inside them, allowing for each fix\'s own error, or a signed sticker scanned there. Every line links to its photo or paper in Vera.</p>' +
    '</body></html>'
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
  const template = (t) => {
    const components = []
    if (t.header) components.push({ type: 'header', parameters: [t.header] })
    components.push({ type: 'body', parameters: (t.params || []).map((p) => ({ type: 'text', text: String(p) })) })
    ;(t.buttons || []).forEach((payload, i) => components.push({ type: 'button', sub_type: 'quick_reply', index: String(i), parameters: [{ type: 'payload', payload: String(payload) }] }))
    return { messaging_product: 'whatsapp', to, type: 'template', template: { name: t.name, language: { code: t.language || 'en' }, components } }
  }
  if (!/^\d{10,15}$/.test(to)) return { ...input, can_send: false, why: 'No valid phone number for this contact' }
  if (open && req.body) return { ...input, can_send: true, mode: 'session', attempt, payload: { messaging_product: 'whatsapp', recipient_type: 'individual', to, ...req.body } }
  if (req.template) return { ...input, can_send: true, mode: 'template', attempt, payload: template(req.template) }
  // Outside the window with no template of its own (buttons, a photo to approve, the NOC to sign):
  // send the one generic template with a "Show me" button and keep the real message. The tap
  // opens the window and WF-02 releases everything held for this person.
  if (req.body) {
    return {
      ...input, can_send: true, mode: 'hold', attempt, held_body: req,
      payload: template({ name: 'vera_mob_action_needed', language: ['hi', 'mr'].includes(input.language) ? input.language : 'en', params: [String(req.summary || 'a message')], buttons: ['show:latest'] }),
    }
  }
  return { ...input, can_send: false, why: 'Nothing to send' }
}

// What to do when Meta refuses a send. Codes from the Cloud API error reference.
export function classifySendError(input) {
  const e = input.error || {}
  const text = JSON.stringify(e)
  const code = Number((text.match(/"code"\s*:\s*(\d{3,6})/) || [])[1] || 0)
  // HTTP status from n8n's error ("403 - …" or httpCode), never from digits elsewhere in the text.
  const status = Number(e.httpCode || (String(e.message || '').match(/^(\d{3})\b/) || [])[1] || 0)
  const attempt = Number(input.attempt || 0) + 1
  let action = 'review'
  let note = 'Send failed: ' + (e.message || 'unknown error')
  if ([131056, 130429, 80007].includes(code)) { action = attempt < 3 ? 'retry' : 'review'; note = 'Rate limited by WhatsApp (' + code + ')' }
  else if (code === 131047) { action = 'needs_template'; note = 'More than 24 h since their last message: needs a template' }
  else if ([131026, 131051, 131052, 131053].includes(code)) { action = 'review'; note = 'WhatsApp could not deliver to this number (' + code + ')' }
  else if ((status >= 500 || /ETIMEDOUT|ECONNRESET|ECONNABORTED|socket hang up/.test(text)) && attempt < 3) { action = 'retry'; note = 'WhatsApp did not answer; retrying' }
  return { ...input, attempt, send_error: { code, action, note } }
}

// One-tap confirmation: up to 3 buttons (WhatsApp's limit), else a list (up to 10 rows).
export function buildConfirm(input) {
  // Text in the person's language (input.lang), from messages.mjs (input.texts, added by the node); English if missing.
  const T = (k, v) => { const all = input.texts || {}; const t = (all[input.lang] || {})[k] || (all.en || {})[k] || k; return String(t).replace(/\{(\w+)\}/g, (_, n) => (v && v[n] != null ? String(v[n]) : '')) }
  const opts = (input.options || []).slice(0, 10)
  const byCode = {}
  for (const l of input.lines || []) byCode[l.code] = l
  const short = (s, n) => (s.length > n ? s.slice(0, n - 1) + '…' : s)
  const ev = input.evidence_id || input.message_id
  const body = { text: T('confirm_q') }
  let interactive
  if (opts.length && opts.length <= 2) {
    interactive = {
      type: 'button', body,
      action: { buttons: opts.map((c) => ({ type: 'reply', reply: { id: 'bind:' + ev + ':' + c, title: short(c + ' ' + (byCode[c] ? byCode[c].text : ''), 20) } })).concat([{ type: 'reply', reply: { id: 'bind:' + ev + ':OTHER', title: short(T('confirm_other'), 20) } }]) },
    }
  } else {
    const rows = (opts.length ? opts : (input.lines || []).filter((l) => !['accepted', 'ok', 'na'].includes(l.status)).slice(0, 9).map((l) => l.code))
      .map((c) => ({ id: 'bind:' + ev + ':' + c, title: short(c, 24), description: short(byCode[c] ? byCode[c].text : '', 72) }))
    rows.push({ id: 'bind:' + ev + ':OTHER', title: short(T('confirm_other'), 24), description: short(T('confirm_other_desc'), 72) })
    interactive = { type: 'list', body, action: { button: short(T('confirm_button'), 20), sections: [{ title: short(T('confirm_section'), 24), rows: rows.slice(0, 10) }] } }
  }
  return { ...input, texts: undefined, request: { body: { type: 'interactive', context: input.wamid ? { message_id: input.wamid } : undefined, interactive } } }
}

// Button and list answers carry their meaning in the id we gave them: "<verb>:<ref>:<value>".
export function parseAnswer(input) {
  const i = (input.message && input.message.interactive) || {}
  const [verb, ref, value] = String(i.id || '').split(':')
  const allowed = {
    bind: ['contractor', 'engineer', 'reviewer'], pick: ['contractor', 'engineer'], na: ['engineer'], close: ['engineer'], sign: ['engineer'],
    review: ['reviewer'], show: ['contractor', 'engineer', 'reviewer', 'project_head', 'design', 'ehs'],
  }
  const values = { na: ['approve', 'reject'], close: ['accept', 'reject'], sign: ['approve', 'conditions', 'hold'] }
  const role = input.contact_role || ''
  if (!allowed[verb]) return { ...input, answer: { ok: false, why: 'Unknown button' } }
  if (!allowed[verb].includes(role)) return { ...input, answer: { ok: false, why: 'Only ' + allowed[verb].join(' / ') + ' can do this' } }
  if (values[verb] && !values[verb].includes(value)) return { ...input, answer: { ok: false, why: 'Unknown choice' } }
  if (verb !== 'show' && !ref) return { ...input, answer: { ok: false, why: 'Button has no reference' } }
  return { ...input, answer: { ok: true, verb, ref, value: value || '', by: input.contact_id, at: new Date(Number(input.now || Date.now())).toISOString() } }
}

// The engineer approves a fixed item from the contractor's photo, not from another visit.
export function buildClosureAsk(input) {
  const id = input.open_item_id
  return {
    ...input,
    msg: {
      summary: 'a fixed item to approve',
      text: (input.project ? input.project + ': ' : '') + 'the contractor says ' + input.line_code + ' is fixed.\n' + input.text +
        (input.finding ? '\nAt the visit: ' + input.finding : '') + '\nAccept the photo to close it.',
      buttons: [{ id: 'close:' + id + ':accept', title: 'Accept, close it' }, { id: 'close:' + id + ':reject', title: 'Not fixed' }],
    },
  }
}

// One review-queue item as a WhatsApp message for a Vera reviewer. What the reviewer can
// do depends on what the item is: an unfiled file (pick the line), a paper a person must
// check (accept / send back), or a failure with no file (ask to resend / handled).
export function buildReviewMessage(input) {
  const rid = input.review_id
  const short = (s, n) => (s.length > n ? s.slice(0, n - 1) + '…' : s)
  const open = Array.isArray(input.open_lines) ? input.open_lines : []
  const byCode = {}
  for (const l of open) byCode[l.code] = l
  const msg = input.message || {}
  const said = [msg.caption, msg.text, msg.filename].filter(Boolean).join(' | ')
  const head = ['Review #' + rid + (input.project ? ' · ' + input.project : ''), String(input.reason || '')]
  if (input.line_code) head.push('Filed on ' + input.line_code + (input.line_text ? ': ' + input.line_text : ''))
  if (said) head.push('Sender wrote: ' + short(said, 300))
  const B = (value, title, description) => ({ id: 'review:' + rid + ':' + value, title, description: description || '' })
  let buttons
  let type
  if (input.evidence_id && !input.line_code) {
    type = 'file'
    const suggested = (Array.isArray(input.options) ? input.options : []).filter((c) => byCode[c])
    const rest = open.map((l) => l.code).filter((c) => !suggested.includes(c))
    const codes = suggested.concat(rest).slice(0, 8)
    buttons = codes.map((c) => B(c, c, byCode[c].text)).concat([B('resend', 'Ask to send again', 'Unreadable or wrong file'), B('done', 'Handled in Vera', 'Nothing to send')])
    head.push(codes.length ? 'Which line is it for?' : 'No open lines left on this site.')
  } else if (input.evidence_id && ['document', 'both'].includes(input.line_evidence)) {
    type = 'paper'
    buttons = [B('accept', 'Accept paper'), B('reject', 'Send back'), B('done', 'Handled in Vera')]
    head.push('Check the paper against the site facts in Vera, then choose.')
  } else {
    type = 'other'
    buttons = (input.message_id || input.evidence_id ? [B('resend', 'Ask to send again')] : []).concat([B('done', 'Handled')])
  }
  return {
    ...input, review_type: type,
    contact_id: input.reviewer_id, kind: 'review', ref: String(rid),
    msg: { summary: 'an item to review', text: head.filter(Boolean).join('\n'), buttons, list_title: 'Choose' },
  }
}

// A message that shows a stored photo or paper with answer buttons. The file goes as a
// WhatsApp media id (uploaded just before), so no public link to the evidence ever exists.
// Up to 3 choices: one button message with the picture on top. More: the picture, then a list.
export function buildEvidenceMessage(input) {
  const m = input.msg || {}
  const short = (s, n) => (String(s).length > n ? String(s).slice(0, n - 1) + '…' : String(s))
  const buttons = (m.buttons || []).slice(0, 10)
  const text = short(m.text || '', 1000) || 'Please choose.'
  const isPdf = /pdf/.test(String(input.media_mime || '')) || input.media_kind === 'document'
  const media = input.media_id ? (isPdf ? { type: 'document', document: { id: input.media_id, filename: m.filename || 'evidence.pdf' } } : { type: 'image', image: { id: input.media_id } }) : null
  const base = { contact_id: input.contact_id, mobilisation_id: input.mobilisation_id, kind: input.kind, ref: input.ref }
  const wrap = (body) => ({ ...base, request: { body, summary: m.summary || 'a message' } })
  if (!buttons.length) {
    if (!media) return [wrap({ type: 'text', text: { preview_url: false, body: text } })]
    return [wrap(media.type === 'image' ? { type: 'image', image: { ...media.image, caption: text } } : { type: 'document', document: { ...media.document, caption: text } })]
  }
  if (buttons.length <= 3) {
    return [wrap({ type: 'interactive', interactive: { type: 'button', ...(media ? { header: media } : {}), body: { text }, action: { buttons: buttons.map((b) => ({ type: 'reply', reply: { id: b.id, title: short(b.title, 20) } })) } } })]
  }
  const out = []
  if (media) out.push(wrap(media.type === 'image' ? { type: 'image', image: { ...media.image, caption: text } } : { type: 'document', document: { ...media.document, caption: text } }))
  out.push(wrap({
    type: 'interactive',
    interactive: {
      type: 'list', body: { text: media ? 'Choose for the file above.' : text },
      action: { button: 'Choose', sections: [{ title: short(m.list_title || 'Choose one', 24), rows: buttons.map((b) => ({ id: b.id, title: short(b.title, 24), description: short(b.description || '', 72) })) }] },
    },
  }))
  return out
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
      flags: { concrete: f.concrete, lifting: /yes|true|1/i.test(String(f.lifting)), creche: /yes|true|1/i.test(String(f.creche)), excavation: /yes|true|1/i.test(String(f.excavation)), shadow: !/^(no|false|0)$/i.test(String(f.shadow == null ? 'yes' : f.shadow).trim()) },
      contractor_phone: String(f.contractor_phone || '').replace(/\D/g, ''), engineer_phone: String(f.engineer_phone || '').replace(/\D/g, ''),
      contractor_lang: /hindi|हिन्दी|^hi$/i.test(String(f.contractor_lang || '')) ? 'hi' : /marathi|मराठी|^mr$/i.test(String(f.contractor_lang || '')) ? 'mr' : 'en',
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
  // Text in the person's language (input.lang), from messages.mjs (input.texts, added by the node); English if missing.
  const T = (k, v) => { const all = input.texts || {}; const t = (all[input.lang] || {})[k] || (all.en || {})[k] || k; return String(t).replace(/\{(\w+)\}/g, (_, n) => (v && v[n] != null ? String(v[n]) : '')) }
  const rows = input.checklist || []
  const out = []
  const project = input.project || ''
  for (const a of input.checklist_areas || []) {
    const name = T('area_' + a.code) === 'area_' + a.code ? a.name : T('area_' + a.code)
    const ls = rows.filter((r) => r.area === a.code)
    const lines = ls.map((l) => Number(l.code.split('-')[1]) + '. ' + l.text + (l.severity === 'critical' ? ' 🔴' : '')).join('\n')
    out.push({
      mobilisation_id: input.mobilisation_id, contact_id: input.contractor_contact_id, kind: 'area', area: a.code, line_code: '',
      // Outside the 24-hour window (the first contact) these are held behind the "Show me"
      // template; the contractor's tap releases all of them.
      request: { summary: T('area_prompt_summary', { project }), body: { type: 'text', text: { preview_url: false, body: '*' + name + ' (' + a.code + ')*\n' + lines + '\n\n' + T('area_prompt_footer', { area: name }) } } },
    })
  }
  return out
}

// ---------------------------------------------------------------------------
// WF-07 Open items after the visit
// ---------------------------------------------------------------------------

export function reminderPlan(input) {
  // Text in the person's language (input.lang), from messages.mjs (input.texts, added by the node); English if missing.
  const T = (k, v) => { const all = input.texts || {}; const t = (all[input.lang] || {})[k] || (all.en || {})[k] || k; return String(t).replace(/\{(\w+)\}/g, (_, n) => (v && v[n] != null ? String(v[n]) : '')) }
  const today = String(input.today || new Date().toISOString().slice(0, 10))
  const it = input.item || {}
  const overdueDays = Math.round((Date.parse(today) - Date.parse(it.due_on)) / 86400000)
  const who = it.severity === 'critical' && overdueDays >= 1 ? 'escalate' : 'contractor'
  const text = (overdueDays > 0 ? T(overdueDays === 1 ? 'rem_overdue_1' : 'rem_overdue_n', { n: overdueDays }) : T('rem_due_today')) + ': ' + it.line + ' ' + it.text +
    (it.finding ? '\n' + T('rem_finding', { finding: it.finding }) : '') + '\n' + T('rem_reply')
  return {
    ...input, texts: undefined, who, overdue_days: overdueDays,
    request: {
      body: { type: 'text', text: { preview_url: false, body: text } },
      template: { name: 'vera_mob_open_item', language: ['hi', 'mr'].includes(input.lang) ? input.lang : 'en', params: [it.line, it.text, it.due_on] },
    },
    escalation: who === 'escalate' ? (input.project || 'Site') + ': critical item ' + it.line + ' is ' + overdueDays + ' day(s) overdue. ' + it.text : '',
  }
}
