// Contact details shown on the demo page. Leave a field empty to hide it.
export const contact = {
  whatsapp: '919619749965', // digits with country code
  whatsappLabel: '96197 49965', // how the number is shown
  email: 'shivam@getveraai.com',
  name: 'Shivam', // person to ask for
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

// contractor: sales view. review: shared for feedback, no prices or pilot.
export type Audience = 'contractor' | 'review'
