import { createHash, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { seed, type Doc, type HQData } from "@/components/hqData";

// Upstash Redis (Vercel → Storage) when it's connected; otherwise one JSON file on disk, for dev or a single box.
const REDIS = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;
const FILE = path.join(process.cwd(), "data", "hq.json");

async function redis(...cmd: (string | number)[]) {
  const res = await fetch(REDIS!, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}` },
    body: JSON.stringify(cmd),
    cache: "no-store",
  });
  const out = await res.json();
  if (!res.ok || out.error) throw new Error(`redis: ${out.error ?? res.status}`);
  return out.result;
}

// Check the rev and write in one atomic step, so two serverless instances can't both pass the check.
const CAS = `
if tonumber(redis.call('GET', KEYS[1]) or '0') ~= tonumber(ARGV[1]) then return 0 end
redis.call('INCR', KEYS[1])
redis.call('SET', KEYS[2], ARGV[2])
return 1`;

async function load(): Promise<Doc> {
  if (REDIS) {
    const [rev, data] = await redis("MGET", "hq:rev", "hq:data");
    return data ? { rev: Number(rev), data: JSON.parse(data) } : { rev: 0, data: seed() };
  }
  try {
    return JSON.parse(await readFile(FILE, "utf8"));
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return { rev: 0, data: seed() };
    throw e; // a corrupt file must not be silently replaced by the seed
  }
}

// File writes go one at a time so two saves can't both pass the rev check.
let queue: Promise<unknown> = Promise.resolve();
function serial<T>(fn: () => Promise<T>) {
  const run = queue.then(fn, fn);
  queue = run.catch(() => {});
  return run;
}

/** Saves if `rev` is still current. Returns the new rev, or null when a teammate saved first. */
async function save(rev: number, data: HQData): Promise<number | null> {
  if (REDIS) return (await redis("EVAL", CAS, 2, "hq:rev", "hq:data", rev, JSON.stringify(data))) ? rev + 1 : null;
  return serial(async () => {
    if ((await load()).rev !== rev) return null;
    await mkdir(path.dirname(FILE), { recursive: true });
    await writeFile(FILE + ".tmp", JSON.stringify({ rev: rev + 1, data }));
    await rename(FILE + ".tmp", FILE);
    return rev + 1;
  });
}

const sha = (s: string) => createHash("sha256").update(s).digest();

/** Header `x-hq-key` must match HQ_KEY. With no key set the API is open in dev and closed in production. */
function allowed(req: Request) {
  const key = process.env.HQ_KEY;
  if (!key) return process.env.NODE_ENV !== "production";
  return timingSafeEqual(sha(req.headers.get("x-hq-key") ?? ""), sha(key));
}

function valid(b: unknown): b is Doc {
  const d = (b as Doc | null)?.data;
  return Number.isInteger((b as Doc | null)?.rev) && !!d?.goal && [d.phases, d.hedges, d.todos].every(Array.isArray);
}

export async function GET(req: Request) {
  if (!allowed(req)) return new Response("Locked", { status: 401 });
  return Response.json(await load());
}

/** Body `{ rev, data }`. A stale rev gets 409 with the current doc, so nobody overwrites a teammate blind. */
export async function PUT(req: Request) {
  if (!allowed(req)) return new Response("Locked", { status: 401 });
  const body: unknown = await req.json().catch(() => null);
  if (!valid(body)) return new Response("Bad payload", { status: 400 });
  const rev = await save(body.rev, body.data);
  return rev === null ? Response.json(await load(), { status: 409 }) : Response.json({ rev });
}
