// Contact details shown on the demo page. Leave a field empty to hide it.
// (Fill these in before sharing the link.)
export const contact = {
  whatsapp: '', // digits with country code, e.g. '919800000000'
  whatsappLabel: '', // how the number is shown, e.g. '+91 98000 00000'
  email: '',
  name: '', // person to ask for, e.g. 'Rishi'
}

// "sharma-infra" -> "Sharma Infra". Keeps short words like "and" lower-case.
export function firmName(slug?: string) {
  if (!slug) return ''
  const small = new Set(['and', 'of', 'the', '&'])
  return decodeURIComponent(slug)
    .replace(/[-_]+/g, ' ')
    .trim()
    .split(/\s+/)
    .map((w, i) => (i > 0 && small.has(w.toLowerCase()) ? w.toLowerCase() : w.length <= 3 && /^[a-z]+$/i.test(w) && w === w.toUpperCase() ? w : w[0].toUpperCase() + w.slice(1).toLowerCase()))
    .join(' ')
}

// contractor: sales view. developer: free-issue pilot. review: shared for feedback, no prices or pilot.
export type Audience = 'contractor' | 'developer' | 'review'
