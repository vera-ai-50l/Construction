// ICP profiles: where to find each customer type and what qualifies it.
// type_a / type_b follow the positioning brief; the other three are the ICPs the
// research report ranked, kept so the lead pools can be compared.
import { ycCompanies } from './sources/yc.mjs';
import { storylaneShowcase } from './sources/storylane.mjs';
import { githubProducts } from './sources/github.mjs';
import { trustmrrStartups } from './sources/trustmrr.mjs';
import { serpFootprints } from './sources/serp.mjs';

const AI = /\b(ai|a\.i\.|llms?|genai|generative ai|agents?|agentic|machine learning|copilot)\b/i;

export const PROFILES = {
  vibe: {
    label: 'Vibe-coded products with paying users',
    offer: 'AI App Glow-Up',
    describe:
      'TrustMRR startups with verified revenue (and, with --serp, Google results for builder footprints), kept only when the site is not professionally designed.',
    discover: async ({ limit, offset, minRevenue = 500, serp = false, log }) => {
      // Revenue yield on TrustMRR is low (a few % clear $1K/month), so read widely.
      // --limit applies per source, so each source gets a fair sample in the funnel.
      const rows = (await trustmrrStartups({ limit: limit * 8, offset, minRevenue30d: minRevenue, b2bOnly: false })).slice(0, limit);
      if (serp) {
        try {
          rows.push(...(await serpFootprints({ log })).slice(offset, offset + limit));
        } catch (e) {
          log?.(`vibe: Google footprint search skipped: ${e.message}`);
        }
      }
      return rows;
    },
  },
  type_a: {
    label: 'A: AI-built app with paying users',
    offer: 'AI App Glow-Up',
    describe: 'Small products with verified revenue; flagged when the site shows Lovable/Bolt/v0/Replit/Base44 fingerprints.',
    discover: async ({ limit, offset }) =>
      trustmrrStartups({ limit: limit * 6, offset, minRevenue30d: 1000, b2bOnly: true }),
    // Tagged rather than filtered: fingerprints miss many AI-built apps.
  },
  type_b: {
    label: 'B: funded AI SaaS with data-heavy dashboards',
    offer: 'Dashboard Sprint',
    describe: 'Recent YC B2B companies whose product is analytics, monitoring, evals, agents or data tooling.',
    discover: async () =>
      ycCompanies({
        include: /\b(dashboards?|analytics|observability|monitoring|evals?|evaluation|tracing|insights?|reporting|data platform|data pipelines?|metrics|ai agents?|agent platform|llmops|bi\b|business intelligence)\b/i,
        exclude: /\b(hardware|biotech|drug|robot(ics)?|satellite|consumer app)\b/i,
        minYear: 2023,
        minTeam: 2,
        maxTeam: 80,
        b2bOnly: true,
      }).then((rows) => rows.filter((r) => AI.test(r.description + ' ' + r.yc.tags.join(' ')))),
  },
  published_demo: {
    label: 'Report ICP 1: B2B SaaS with a published demo (AI-retrofit when AI terms appear)',
    offer: 'Dashboard Sprint',
    describe: "Companies in Storylane's public showcase: their real screens are public (Level B).",
    discover: async ({ limit }) => storylaneShowcase({ limit: limit * 2 }),
  },
  voice_ai: {
    label: 'Report ICP 2: voice-AI and agent-builder platforms',
    offer: 'Dashboard Sprint',
    describe: 'YC companies building voice agents, AI phone/call platforms or agent builders.',
    discover: async () =>
      ycCompanies({
        include: /\b(voice ai|voice agents?|ai phone|phone agents?|call(s)? (center|centre)|conversational ai|agent builder|build (ai )?agents|no-code agents?|workflow automation)\b/i,
        minYear: 2022,
        minTeam: 3,
        b2bOnly: false,
      }),
  },
  open_source_demo: {
    label: 'Report ICP 3: open-source B2B product with a company behind it',
    offer: 'Dashboard Sprint',
    describe: 'Organisation-owned GitHub projects with 1,500+ stars and a company homepage.',
    discover: async () =>
      githubProducts({
        topics: ['observability', 'analytics', 'business-intelligence', 'crm', 'erp', 'monitoring', 'llmops', 'self-hosted'],
        minStars: 1500,
        perTopic: 30,
      }),
  },
};

export const PROFILE_NAMES = Object.keys(PROFILES);
