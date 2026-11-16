// The "looked at it" layer of a teardown: findings from someone viewing the screenshots
// (hierarchy, clarity, generic AI look, confusing flows). Measured checks cannot see these.
//
// A review is a JSON file at <run>/reviews/<domain>.json. It can be written by hand,
// or by Claude with --ai-review (needs ANTHROPIC_API_KEY). A hand-written file always
// wins and is never overwritten.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import * as z from 'zod/v4';

const Finding = z.object({
  screen: z.enum(['home', 'pricing', 'signup', 'demo', 'dashboard']),
  severity: z.number().int().describe('3 = fix first, 2 = important, 1 = polish'),
  issue: z.string().describe('What is visibly wrong, in one or two plain sentences. Quote real on-screen text where it helps.'),
  impact: z.string().describe('One sentence: the likely effect on a visitor (confusion, distrust, drop-off). No numbers you did not measure.'),
  fix: z.string().describe('One sentence: the concrete change.'),
});

export const Review = z.object({
  visual_findings: z.array(Finding).describe('2 to 4 findings, most important first'),
  strength: z.string().describe('One genuine, specific thing the product does well, as a clause that can follow "First, what works: "'),
  looks_ai_generated: z.boolean(),
  ai_look_evidence: z.string().describe('If looks_ai_generated, what gives it away; otherwise empty'),
});

const SYSTEM = `You are a senior product designer reviewing a software company's public screens to write a short teardown that will be emailed to its founder.

Rules:
- Describe only what is visible in the screenshots. If something is cut off or not shown, do not guess about it.
- Be specific: name the element and quote its on-screen text where useful ("the headline 'Supercharge your workflow' does not say what the product does").
- Do not invent metrics, conversion rates or analytics. Do not claim to know their churn or bounce rate; describe the likely effect on a visitor instead.
- Do not repeat the measured findings you are given; add what only a person looking at the page would notice: unclear headline or value proposition, weak hierarchy, competing focal points, generic template or AI-generated look, inconsistent components, confusing next step, trust gaps, cramped or empty layouts, mobile layout problems.
- Plain, direct sentences an engineer would respect. No design jargon, no flattery, no exclamation marks.
- If the screens are genuinely well designed, return fewer findings and say so through the severities (1 = polish).`;

const IMAGE_ORDER = ['home', 'home-mobile', 'pricing', 'signup', 'demo', 'dashboard'];

export function reviewPath(outDir, domain) {
  return path.join(outDir, 'reviews', `${domain}.json`);
}

export async function loadReview(outDir, domain) {
  const f = reviewPath(outDir, domain);
  if (!existsSync(f)) return null;
  const parsed = Review.safeParse(JSON.parse(await readFile(f, 'utf8')));
  return parsed.success ? { ...parsed.data, source: 'file' } : null;
}

let client = null;

/**
 * Ask Claude to review the screenshots. Returns the review, or null with a logged
 * reason (no key, refusal, API error) so the teardown falls back to measured findings.
 */
export async function aiReview({ lead, shots, measured, outDir, log = console.error }) {
  client ||= new Anthropic();
  const images = [];
  for (const key of IMAGE_ORDER) {
    if (!shots[key]) continue;
    images.push({ type: 'text', text: `Screen: ${key}` });
    images.push({ type: 'image', source: { type: 'base64', media_type: 'image/png', data: (await readFile(shots[key])).toString('base64') } });
  }
  if (!images.length) return null;
  const context = [
    `Company: ${lead.name} (${lead.site.fetched_url})`,
    `What it says it does: ${lead.description || lead.site.meta_description || 'unknown'}`,
    `Customer type: ${lead.profile === 'type_a' ? 'small self-serve product, likely built with an AI app builder' : 'funded B2B software company with a data-heavy product'}`,
    `Measured findings already in the email (do not repeat): ${measured.map((f) => `${f.key} (${f.metric})`).join('; ') || 'none'}`,
  ].join('\n');

  try {
    const res = await client.beta.messages.parse({
      model: 'claude-opus-5-5',
      max_tokens: 16000,
      // Server-side fallback: if the request is declined, the API retries it on a fallback model.
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'medium', format: betaZodOutputFormat(Review) },
      system: SYSTEM,
      messages: [{ role: 'user', content: [...images, { type: 'text', text: `${context}\n\nReview these screens.` }] }],
    });
    if (res.stop_reason === 'refusal' || !res.parsed_output) {
      log(`  ai review skipped for ${lead.domain}: ${res.stop_reason}`);
      return null;
    }
    const review = { ...res.parsed_output, source: 'claude' };
    await mkdir(path.join(outDir, 'reviews'), { recursive: true });
    await writeFile(reviewPath(outDir, lead.domain), JSON.stringify(review, null, 2));
    return review;
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) log('  ai review: no valid Anthropic credentials (set ANTHROPIC_API_KEY)');
    else if (e instanceof Anthropic.RateLimitError) log(`  ai review rate-limited for ${lead.domain}; re-run later`);
    else if (e instanceof Anthropic.APIError) log(`  ai review API error ${e.status} for ${lead.domain}: ${e.message.slice(0, 120)}`);
    else log(`  ai review failed for ${lead.domain}: ${String(e.message || e).slice(0, 120)}`);
    return null;
  }
}

/** Visual findings in the same shape as measured ones. */
export function reviewFindings(review) {
  if (!review) return [];
  return review.visual_findings.map((f, i) => ({
    key: `visual_${i + 1}`,
    screen: f.screen,
    severity: Math.max(1, Math.min(3, f.severity)),
    metric: 'reviewed',
    issue: f.issue,
    impact: f.impact,
    fix: f.fix,
    visual: true,
  }));
}
