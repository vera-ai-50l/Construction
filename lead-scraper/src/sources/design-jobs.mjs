// Source for all three ICPs: companies hiring a designer right now. A design job post
// means a design problem and a budget. Every hiring company is then sorted by what its
// own website shows: Shopify store (Type C), app built with an AI builder (Type A), or
// B2B SaaS (Type B). Public APIs and feeds only (robots.txt respected), plus job boards
// found with Google (Apify) for Shopify roles.
import * as cheerio from 'cheerio';
import { getJson, getText, cacheGet, cachePut, pool } from '../http.mjs';
import { runActor } from '../apify.mjs';
import { registrableDomain, isCompanySite } from '../domain.mjs';
import { count } from '../ledger.mjs';
import { guessSite } from './funding.mjs';
import { atsDesignRoles, hnDesignHiring } from './hiring-design.mjs';

export const DESIGN_ROLE = /\b(product designer|ux designer|ui designer|ui\/ux|ux\/ui|web designer|website designer|ecommerce designer|e-commerce designer|shopify (designer|developer)|design engineer|founding designer|digital designer|visual designer|interaction designer|head of design|design lead)\b/i;
const NOT_A_COMPANY = /(recruit|staffing|talent|agency|consult|freelance|upwork|fiverr|toptal|lemon\.io|huzzle|crossover|turing|andela|braintrust|contra|hired)/i;

const HIMALAYAS_QUERIES = ['product designer', 'ux designer', 'ui designer', 'web designer', 'design engineer', 'shopify', 'ecommerce designer'];
// Job posts that ask designers to work with AI builders: companies building with them.
export const AI_BUILDER_JOB_QUERIES = [
  'site:jobs.ashbyhq.com designer "lovable"',
  'site:jobs.lever.co designer "lovable"',
  'site:job-boards.greenhouse.io designer "lovable"',
  '"product designer" "lovable" "v0" job',
  '"designer" "bolt.new" OR "lovable.dev" hiring startup',
];
export const SHOPIFY_JOB_QUERIES = [
  'site:jobs.lever.co shopify designer',
  'site:jobs.ashbyhq.com shopify designer',
  'site:job-boards.greenhouse.io shopify designer',
  'site:apply.workable.com shopify designer',
  'site:breezy.hr shopify designer',
  '"shopify" "ecommerce designer" job -upwork -fiverr -freelancer',
  '"shopify store" "web designer" hiring -upwork -fiverr',
];

const textOf = (html) => cheerio.load(`<div>${html || ''}</div>`)('div').text().replace(/\s+/g, ' ').trim();

async function himalayas(log) {
  const out = [];
  for (const q of HIMALAYAS_QUERIES) {
    let seen = 0;
    for (let offset = 0; offset < 200; offset += 20) {
      await new Promise((r) => setTimeout(r, 4000)); // Himalayas rate-limits fast callers
      const url = `https://himalayas.app/jobs/api/search?q=${encodeURIComponent(q)}${offset ? `&offset=${offset}` : ''}`;
      let d = await getJson(url);
      if (!d) {
        await new Promise((r) => setTimeout(r, 20000));
        d = await getJson(url);
      }
      const jobs = d?.jobs || [];
      const fresh = jobs.filter((j) => !out.some((o) => o.url === j.applicationLink && o.title === j.title));
      if (!fresh.length) break; // offset not honoured, or no more results
      for (const j of jobs) out.push({ company: j.companyName, slug: j.companySlug, title: j.title, text: `${j.title} ${j.excerpt || ''} ${textOf(j.description).slice(0, 800)}`, url: j.applicationLink || j.guid, date: j.pubDate, source: 'himalayas' });
      seen += jobs.length;
    }
    log?.(`design jobs: himalayas "${q}": ${seen}`);
  }
  return out;
}

async function rssJobs(name, url, parse) {
  const r = await getText(url);
  if (!r.ok) return [];
  const $ = cheerio.load(r.text, { xmlMode: true });
  return $('item').toArray().map((it) => parse($, it)).filter(Boolean).map((x) => ({ ...x, source: name }));
}

async function remotive() {
  const d = await getJson('https://remotive.com/api/remote-jobs?category=design&limit=200');
  return (d?.jobs || []).map((j) => ({ company: j.company_name, title: j.title, text: `${j.title} ${textOf(j.description).slice(0, 800)}`, url: j.url, date: j.publication_date, source: 'remotive' }));
}

async function googleShopifyJobs(log) {
  const input = { queries: [...SHOPIFY_JOB_QUERIES, ...AI_BUILDER_JOB_QUERIES].join('\n'), maxPagesPerQuery: 2, resultsPerPage: 10, countryCode: 'us', mobileResults: false };
  const key = 'design-jobs-serp:' + JSON.stringify(input);
  let pages = await cacheGet(key);
  if (!pages) {
    pages = await runActor('apify/google-search-scraper', input, { log });
    await cachePut(key, pages);
  }
  const out = [];
  for (const p of pages) for (const r of p.organicResults || []) {
    const t = `${r.title} ${r.description || ''}`;
    if (!DESIGN_ROLE.test(t) && !/designer/i.test(t)) continue;
    if (/upwork|fiverr|freelancer\.com|indeed\.|glassdoor|linkedin\.com|ziprecruiter|reddit/i.test(r.url)) continue;
    // "Ecommerce Designer - Acme" / "Acme - Shopify Designer" / "Job at Acme"
    const parts = String(r.title || '').split(/\s[-|–@]\s|\sat\s/i).map((x) => x.trim());
    const company = parts.find((x) => x && !/designer|developer|job|hiring|careers|lever|ashby|greenhouse|workable|breezy/i.test(x)) || '';
    out.push({ company, title: parts.find((x) => /designer|developer/i.test(x)) || r.title, text: t, url: r.url, source: 'google-jobs' });
  }
  return out;
}

/** Website for a hiring company: Himalayas company page, else a verified domain guess. */
async function websiteFor(job) {
  if (job.slug) {
    const r = await getText(`https://himalayas.app/companies/${job.slug}`);
    if (r.ok) {
      const $ = cheerio.load(r.text);
      const href = $('a[href^="http"]').map((_, a) => $(a).attr('href')).get().find((h) => isCompanySite(h) && !/himalayas|linkedin|twitter|x\.com|facebook|instagram|glassdoor|crunchbase/i.test(h));
      if (href) return `https://${registrableDomain(href)}/`;
    }
  }
  return job.company ? guessSite(job.company) : null;
}

const BUILDER_MARK = /lovable-uploads|data-lovable|gpt-engineer|lovable\.app|@base44|base44\.app|bolt\.new|bolt\.host|stackblitz|replit\.app|v0\.dev|generated by v0/i;

/** 'C' (Shopify store), 'A' (built with an AI builder), 'B' (B2B SaaS) or null. */
export async function classifyCompany(row) {
  const r = await getText(row.website);
  if (!r.ok) return { icp: null, why: `site ${r.blocked || r.status || 'unreachable'}` };
  const html = r.text;
  if (/cdn\.shopify\.com|Shopify\.shop\s*=/.test(html)) return { icp: 'C', why: 'Shopify store' };
  if (BUILDER_MARK.test(html)) return { icp: 'A', why: `AI-builder fingerprint (${html.match(BUILDER_MARK)[0]})` };
  const $ = cheerio.load(html);
  const text = `${$('title').text()} ${$('meta[name="description"]').attr('content') || ''} ${$('h1,h2').slice(0, 6).text()} ${row.description || ''}`;
  const app = /\b(log ?in|sign ?in|sign ?up|get started|start (for )?free|book a demo|request a demo|pricing)\b/i.test($('a, button').text());
  const { isSaas } = await import('./saas.mjs');
  if (isSaas(text) && app) return { icp: 'B', why: 'B2B software with sign-in / pricing' };
  return { icp: null, why: 'not a store, AI-built app or SaaS' };
}

/** Hiring companies for one ICP ('A', 'B' or 'C'), classified once per process. */
export async function designJobsFor(icp, { log } = {}) {
  const rows = await designJobCompanies({ log });
  if (!designJobsFor.done) {
    await pool(rows, 6, async (row) => {
      row.icp = await classifyCompany(row).catch(() => ({ icp: null, why: 'error' }));
    });
    designJobsFor.done = true;
    const tally = rows.reduce((m, x) => ((m[x.icp?.icp || 'none'] = (m[x.icp?.icp || 'none'] || 0) + 1), m), {});
    log?.(`design jobs: companies by ICP ${JSON.stringify(tally)}`);
    for (const k of ['A', 'B', 'C']) count(`design_jobs_icp_${k}`, tally[k] || 0);
  }
  return rows.filter((x) => x.icp?.icp === icp);
}

/**
 * Companies hiring a designer, one row per company with its website and the role.
 * @param opts { google: true to include Shopify job-board searches (paid, small), log }
 */
export async function designJobCompanies({ google = true, log } = {}) {
  const mem = designJobCompanies.cache;
  if (mem) return mem;
  const jobs = [
    ...(await himalayas(log)),
    ...(await remotive()),
    ...(await rssJobs('wwr', 'https://weworkremotely.com/categories/remote-design-jobs.rss', ($, it) => {
      const title = $(it).find('title').first().text();
      const [company, role] = title.split(/:\s(.+)/);
      return { company: company?.trim(), title: role || title, text: `${title} ${textOf($(it).find('description').text()).slice(0, 800)}`, url: $(it).find('link').text() };
    })),
    ...(await rssJobs('dribbble', 'https://dribbble.com/jobs.rss', ($, it) => {
      const title = $(it).find('title').first().text();
      const m = title.match(/^(.*?) is hiring for a position of (.*?)(?: in .*)?$/i);
      return { company: $(it).find('dc\\:creator, creator').first().text().trim() || m?.[1], title: m?.[2] || title, text: title, url: $(it).find('link').text() };
    })),
    ...(google ? await googleShopifyJobs(log).catch((e) => (log?.(`design jobs: google skipped: ${e.message}`), [])) : []),
  ];
  count('design_jobs_read', jobs.length);
  const design = jobs.filter((j) => j.company && (DESIGN_ROLE.test(j.title) || DESIGN_ROLE.test(j.text)) && !NOT_A_COMPANY.test(j.company));
  count('design_jobs_design_roles', design.length);
  const byCompany = new Map();
  for (const j of design) if (!byCompany.has(j.company.toLowerCase())) byCompany.set(j.company.toLowerCase(), j);
  log?.(`design jobs: ${jobs.length} jobs read, ${design.length} design roles, ${byCompany.size} companies; finding websites`);
  const rows = [];
  await pool([...byCompany.values()], 6, async (j) => {
    const site = await websiteFor(j).catch(() => null);
    if (!site) return count('design_jobs_no_website');
    rows.push({ name: j.company, website: site, source: 'design-jobs', source_url: j.url, description: j.text.slice(0, 240), design_role: { title: (j.title.match(DESIGN_ROLE) || [j.title])[0].slice(0, 60), board: j.source, date: j.date || '' } });
  });
  // Plus companies with a design role on Ashby / Greenhouse / Lever and HN Who is hiring.
  for (const r of [...(await atsDesignRoles({ log }).catch(() => [])), ...(await hnDesignHiring().catch(() => []))]) {
    if (!rows.some((x) => registrableDomain(x.website) === registrableDomain(r.website))) rows.push({ ...r, source: 'design-jobs', design_role: { ...r.design_role, board: r.design_role?.board || r.source } });
  }
  count('design_jobs_companies', rows.length);
  designJobCompanies.cache = rows;
  return rows;
}
