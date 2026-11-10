"use client";

import sample from "@/n8n/desk-sample.json";
import { Camera, DownloadSimple, PaperPlaneRight, Play, Receipt } from "@phosphor-icons/react";
import { useState, type FormEvent, type ReactNode } from "react";
import { Arrive, ErrorNote, Pipeline, RunButton, useFlow } from "./DemoKit";
import { Bezel, Eyebrow, Reveal, Words, formatINR } from "./ui";

type Msg = { id: string; site: string; time: string; kind: string; text: string; en?: string; dur?: string };
type Site = {
  id: string;
  name: string;
  place: string;
  supervisor: string;
  reported: boolean;
  messages: number;
  first: string | null;
  last: string | null;
  labour: { contractor: string; trade: string; count: number }[];
  labourTotal: number;
  progress: { activity: string; unit: string; plan: number; done: number | null; pct: number | null }[];
  received: { material: string; qty: number; challan: string | null; weighed: number | null; noPo: boolean; time: string; supplier: string | null }[];
  stock: { material: string; qty: number; days: number | null }[];
  hindrances: { key: string; cause: string; party: string; hours: number | null; idle: number | null; time: string; photos: string[]; open: { ref: string; since: number } | null }[];
};
type Desk = {
  date: string;
  briefDate: string;
  stats: { messages: number; understood: number; sites: number; reported: number; labour: number };
  sites: Site[];
  tags: Record<string, string[]>;
  risks: { site: string; short: string; kind: string; title: string; amount: number | null; action: string }[];
  riskTotal: number;
  brief: string;
  tally: string;
};

const NODES = ["Site master", "Read messages", "Daily site reports", "Money at risk", "8 AM brief + Tally"];
const SITES: Record<string, { place: string; supervisor: string; tint: string }> = {
  kharadi: { place: "Kharadi", supervisor: "Vikas Patil", tint: "bg-[#ff5b1f]" },
  hinjewadi: { place: "Hinjewadi", supervisor: "Sandeep Yadav", tint: "bg-[#5fb3a1]" },
  nashik: { place: "Nashik", supervisor: "Rafiq Shaikh", tint: "bg-[#d9b44a]" },
  baner: { place: "Baner", supervisor: "Amit Kale", tint: "bg-[#8f8bd6]" },
};
// Things to type live, from the site that stayed silent.
const TRY = ["Shinde ke 14 mistri aaye", "बिजली 2 घंटे नहीं थी, 10 लोग खाली", "Villa 6 blockwork 45 sqm done"];
const UNIT: Record<string, string> = { cement: "bags", steel: "MT", rmc: "cum", aac: "nos" };
const MAT: Record<string, string> = { cement: "cement", steel: "steel", rmc: "RMC", aac: "AAC blocks" };

const istNow = (offsetDays = 0) => new Date(Date.now() + 5.5 * 36e5 - offsetDays * 864e5).toISOString();

export default function DemoDesk() {
  const flow = useFlow<Desk>("vera/site-desk", NODES.length + 2);
  const [msgs, setMsgs] = useState<Msg[]>(sample);
  const [site, setSite] = useState("baner");
  const [draft, setDraft] = useState("");
  const d = flow.data;

  function send(e: FormEvent) {
    e.preventDefault();
    const text = draft.trim();
    if (!text) return;
    setMsgs((m) => [...m, { id: `u${m.length + 1}`, site, time: istNow().slice(11, 16), kind: "text", text }]);
    setDraft("");
  }

  return (
    <section id="desk" className="relative rounded-t-[2.5rem] bg-ink-2 px-4 py-24 ring-1 ring-white/[0.06] md:px-10 md:py-32">
      <div className="mx-auto max-w-[1280px]">
        <Eyebrow>Site Record Desk: the monthly product</Eyebrow>
        <Words
          text="Your sites already talk on WhatsApp. | *Vera writes the record.*"
          className="mt-6 max-w-[18ch] text-[clamp(2.4rem,5vw,4.6rem)] font-medium leading-[0.98] tracking-[-0.045em] md:max-w-none"
        />
        <Reveal delay={0.15}>
          <p className="mt-6 max-w-[62ch] text-lg leading-relaxed text-bone/60">
            Yesterday on four sites: voice notes in Hindi and Marathi, Hinglish texts, photos and challans to one number. No new
            app. At night n8n reads all of it and writes the daily record, the hindrance register, the money at risk and the
            owner’s 8 AM brief.
          </p>
        </Reveal>

        <div className="mt-12 grid grid-cols-1 gap-6 lg:grid-cols-12">
          <Reveal className="lg:col-span-5">
            <Feed msgs={msgs} tags={d?.tags}>
              <form onSubmit={send} className="border-t border-white/[0.07] p-3">
                <div className="flex gap-2">
                  <select
                    value={site}
                    onChange={(e) => setSite(e.target.value)}
                    aria-label="Send as the supervisor of"
                    className="rounded-full bg-white/[0.06] px-3 text-[12px] text-bone ring-1 ring-white/10"
                  >
                    {Object.entries(SITES).map(([id, s]) => (
                      <option key={id} value={id} className="bg-ink">
                        {s.place}
                      </option>
                    ))}
                  </select>
                  <input
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder="Type like a supervisor…"
                    aria-label="Message"
                    className="min-w-0 flex-1 rounded-full bg-white/[0.06] px-4 py-2.5 text-sm text-bone ring-1 ring-white/10 placeholder:text-bone/35 focus:outline-none focus:ring-hivis/60"
                  />
                  <button type="submit" aria-label="Send" className="flex size-10 shrink-0 items-center justify-center rounded-full bg-hivis text-ink">
                    <PaperPlaneRight size={16} weight="light" />
                  </button>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {TRY.map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => {
                        setSite("baner");
                        setDraft(t);
                      }}
                      className="rounded-full bg-white/[0.04] px-2.5 py-1 font-deva text-[11px] text-bone/55 ring-1 ring-white/[0.08] hover:text-bone"
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </form>
            </Feed>
          </Reveal>

          <div className="flex flex-col gap-6 lg:col-span-7">
            <Reveal delay={0.1}>
              <Bezel inner="p-5 md:p-7">
                <Pipeline nodes={NODES} step={flow.step} workflow="veraDemoSiteDsk1" />
                <div className="mt-6 flex flex-wrap items-center gap-4">
                  <RunButton busy={flow.busy} onClick={() => flow.run({ date: istNow(1).slice(0, 10), messages: msgs })}>
                    {d ? "Run the close again" : "Run tonight’s close"}
                  </RunButton>
                  <p className="text-[13px] text-bone/45">{msgs.length} messages from yesterday</p>
                </div>
                <ErrorNote error={flow.error} />
              </Bezel>
            </Reveal>

            <div className="grid grid-cols-1 gap-6 sm:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
              <Phone brief={d && !flow.busy ? d.brief : null} />
              {d && !flow.busy ? (
                <Arrive className="flex flex-col gap-4">
                  <div className="grid grid-cols-2 gap-3">
                    <Stat k={`${d.stats.understood}/${d.stats.messages}`} v="messages turned into records" />
                    <Stat k={`${d.stats.reported}/${d.stats.sites}`} v="supervisors reported" />
                    <Stat k={String(d.stats.labour)} v="people on site" />
                    <Stat k={formatINR(d.riskTotal)} v="money at risk" hot />
                  </div>
                  <Risks risks={d.risks} />
                </Arrive>
              ) : (
                <div className="flex items-center rounded-[2rem] border border-dashed border-white/10 p-6 text-[15px] leading-relaxed text-bone/45">
                  Press run. n8n reads every message, writes each site’s daily record, prices what is at risk and sends the owner
                  one WhatsApp at 8 AM.
                </div>
              )}
            </div>
          </div>
        </div>

        {d && !flow.busy && <Reports d={d} />}
      </div>
    </section>
  );
}

function Feed({ msgs, tags, children }: { msgs: Msg[]; tags?: Record<string, string[]>; children: ReactNode }) {
  return (
    <div className="flex h-[760px] flex-col overflow-hidden rounded-[2rem] bg-[#0f0e0c] ring-1 ring-white/10">
      <div className="flex items-center gap-3 border-b border-white/[0.06] px-5 py-4">
        <span className="flex size-9 items-center justify-center rounded-full bg-hivis font-semibold text-ink">V</span>
        <div>
          <p className="text-sm font-medium">Vera · Site Desk</p>
          <p className="text-[11px] text-bone/45">4 supervisors · one WhatsApp number</p>
        </div>
      </div>
      <div data-lenis-prevent className="flex-1 space-y-3 overflow-y-auto px-4 py-5">
        <span className="mx-auto block w-fit rounded-full bg-white/[0.06] px-3 py-1 text-[10px] text-bone/50">Yesterday</span>
        {msgs.map((m) => {
          const s = SITES[m.site];
          const t = tags?.[m.id];
          return (
            <div key={m.id} className="flex gap-2.5">
              <span className={`mt-1 flex size-7 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-ink ${s.tint}`}>
                {s.supervisor.split(" ").map((w) => w[0]).join("")}
              </span>
              <div className="min-w-0 max-w-[88%] rounded-2xl rounded-tl-md bg-white/[0.07] p-3">
                <p className="text-[11px] text-bone/50">
                  <span className="font-medium text-bone/80">{s.supervisor}</span> · {s.place}
                </p>
                <Body m={m} />
                <p className="mt-1 text-right text-[9px] text-bone/35">{m.time}</p>
                {t && (
                  <div className="mt-1.5 flex flex-wrap gap-1 border-t border-white/[0.06] pt-2">
                    {t.length ? (
                      t.map((x) => (
                        <span key={x} className="rounded-md bg-hivis/15 px-1.5 py-0.5 text-[10px] text-hivis">
                          {x}
                        </span>
                      ))
                    ) : (
                      <span className="text-[10px] text-bone/40">{m.kind === "photo" ? "photo logged as evidence" : "kept as a note"}</span>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {children}
    </div>
  );
}

function Body({ m }: { m: Msg }) {
  if (m.kind === "voice")
    return (
      <div className="mt-2">
        <div className="flex items-center gap-2.5">
          <span className="flex size-8 items-center justify-center rounded-full bg-bone text-ink">
            <Play size={12} weight="fill" />
          </span>
          <span aria-hidden className="flex h-6 flex-1 items-center gap-[2px]">
            {Array.from({ length: 28 }, (_, i) => (
              <span key={i} className="w-[3px] rounded-full bg-bone/40" style={{ height: `${25 + ((i * 37 + m.id.length * 11) % 70)}%` }} />
            ))}
          </span>
          <span className="text-[10px] text-bone/50">{m.dur}</span>
        </div>
        <p className="mt-2 font-deva text-[13px] leading-relaxed text-bone/90">{m.text}</p>
        {m.en && <p className="mt-1 text-[12px] leading-snug text-bone/45">{m.en}</p>}
      </div>
    );
  if (m.kind === "photo" || m.kind === "challan") {
    const Icon = m.kind === "photo" ? Camera : Receipt;
    return (
      <div className="mt-2">
        <div className="flex aspect-[16/9] items-center justify-center rounded-xl bg-[repeating-linear-gradient(135deg,rgba(244,241,236,0.05)_0_8px,rgba(244,241,236,0.02)_8px_16px)] ring-1 ring-white/[0.06]">
          <span className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-bone/45">
            <Icon size={16} weight="light" /> {m.kind === "photo" ? "Site photo" : "Challan photo"}
          </span>
        </div>
        <p className="mt-2 text-[13px] leading-relaxed text-bone/90">{m.text}</p>
      </div>
    );
  }
  return <p className="mt-1 font-deva text-[13px] leading-relaxed text-bone/90">{m.text}</p>;
}

/** The owner's phone, rendering WhatsApp's *bold* markup line by line. */
function Phone({ brief }: { brief: string | null }) {
  return (
    <div className="mx-auto w-full max-w-[320px] rounded-[3rem] bg-white/[0.04] p-2 ring-1 ring-white/10">
      <div className="overflow-hidden rounded-[calc(3rem-0.5rem)] bg-[#0f0e0c]">
        <div className="flex items-center gap-3 border-b border-white/[0.06] px-5 pb-3 pt-6">
          <span className="flex size-8 items-center justify-center rounded-full bg-hivis text-sm font-semibold text-ink">V</span>
          <div>
            <p className="text-[13px] font-medium">Vera · Site Desk</p>
            <p className="text-[10px] text-bone/45">to the owner</p>
          </div>
        </div>
        <div data-lenis-prevent className="h-[520px] overflow-y-auto px-3 py-4">
          {brief ? (
            <Arrive className="rounded-2xl rounded-tl-md bg-white/[0.07] p-3 text-[12px] leading-[1.55] text-bone/85">
              {brief.split("\n").map((line, i) => (
                <p key={i} className={line ? "" : "h-2"}>
                  {line.split(/(\*[^*]+\*)/).map((part, j) =>
                    part.startsWith("*") && part.endsWith("*") ? (
                      <strong key={j} className="font-semibold text-bone">
                        {part.slice(1, -1)}
                      </strong>
                    ) : (
                      part
                    ),
                  )}
                </p>
              ))}
              <p className="mt-1 text-right text-[9px] text-bone/35">08:00</p>
            </Arrive>
          ) : (
            <p className="mt-40 text-center text-[12px] text-bone/35">The 8 AM brief lands here.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({ k, v, hot }: { k: string; v: string; hot?: boolean }) {
  return (
    <div className="rounded-2xl bg-white/[0.035] p-4 ring-1 ring-white/[0.08]">
      <p className={`text-2xl font-medium tracking-[-0.04em] tabular-nums ${hot ? "text-hivis" : ""}`}>{k}</p>
      <p className="mt-1 text-[12px] leading-snug text-bone/50">{v}</p>
    </div>
  );
}

function Risks({ risks }: { risks: Desk["risks"] }) {
  return (
    <div className="rounded-2xl bg-white/[0.035] p-4 ring-1 ring-white/[0.08]">
      <p className="text-[10px] uppercase tracking-[0.2em] text-bone/45">Money at risk · do today</p>
      <ul data-lenis-prevent className="mt-2 max-h-[300px] divide-y divide-white/[0.06] overflow-y-auto">
        {risks.map((r) => (
          <li key={r.title} className="py-2.5">
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-[13px] leading-snug">
                <span className="text-bone/45">{r.short} · </span>
                {r.title}
              </p>
              <p className="shrink-0 text-[13px] font-medium tabular-nums text-hivis">{r.amount ? formatINR(r.amount) : "–"}</p>
            </div>
            <p className="mt-0.5 text-[12px] text-bone/45">→ {r.action}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

const PARTY: Record<string, string> = {
  Client: "bg-hivis text-ink",
  Supplier: "bg-bone/15 text-bone",
  Weather: "bg-white/[0.06] text-bone/60",
  Utility: "bg-white/[0.06] text-bone/60",
  Own: "bg-white/[0.06] text-bone/60",
};

function Reports({ d }: { d: Desk }) {
  return (
    <Arrive delay={0.15} className="mt-14">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[10px] uppercase tracking-[0.2em] text-bone/45">Daily site record · {d.date}</p>
          <p className="mt-2 text-2xl font-medium tracking-[-0.03em]">What each site did, who was there, what stopped work</p>
        </div>
        <a
          href={`data:text/csv;charset=utf-8,${encodeURIComponent(d.tally)}`}
          download={`vera-tally-${d.date}.csv`}
          className="inline-flex items-center gap-2 rounded-full bg-white/[0.06] px-4 py-2.5 text-sm ring-1 ring-white/15 hover:bg-white/10"
        >
          <DownloadSimple size={16} weight="light" /> Tally import file
        </a>
      </div>
      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
        {d.sites.map((s) => (
          <Bezel key={s.id} inner="p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-medium">{s.name}</p>
                <p className="text-[12px] text-bone/45">
                  {s.place} · {s.supervisor}
                </p>
              </div>
              <span
                className={`rounded-full px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.15em] ${
                  s.reported ? "bg-white/[0.06] text-bone/60" : "bg-hivis text-ink"
                }`}
              >
                {s.reported ? `${s.messages} msgs · ${s.first}–${s.last}` : "No report"}
              </span>
            </div>
            {s.reported && (
              <div className="mt-4 space-y-4 text-[13px]">
                {s.progress.map((p) => (
                  <div key={p.activity}>
                    <div className="flex justify-between">
                      <span>{p.activity}</span>
                      <span className="tabular-nums text-bone/60">
                        {p.done ?? "–"} / {p.plan} {p.unit}
                      </span>
                    </div>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/[0.07]">
                      <div className={`h-full rounded-full ${(p.pct ?? 0) >= 1 ? "bg-bone" : "bg-hivis"}`} style={{ width: `${Math.min(1, p.pct ?? 0) * 100}%` }} />
                    </div>
                  </div>
                ))}
                {s.labour.length > 0 && (
                  <Line label="Labour">
                    {s.labourTotal} · {s.labour.map((l) => `${l.contractor.split(" ")[0]} ${l.count} ${l.trade.toLowerCase()}`).join(", ")}
                  </Line>
                )}
                {s.received.map((r) => (
                  <Line key={r.time + r.material} label="Received">
                    {r.qty} {UNIT[r.material]} {MAT[r.material]}
                    {r.challan && ` · ${r.challan}`}
                    {r.weighed && <span className="text-hivis"> · weighed {r.weighed}</span>}
                    {r.noPo && <span className="text-hivis"> · no PO</span>}
                  </Line>
                ))}
                {s.stock.map((st) => (
                  <Line key={st.material} label="Stock">
                    {st.qty} {UNIT[st.material]} {MAT[st.material]}
                    {st.days !== null && ` ≈ ${st.days.toFixed(1)} days`}
                  </Line>
                ))}
                {s.hindrances.length > 0 && (
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.18em] text-bone/40">Hindrance register</p>
                    <ul className="mt-1.5 space-y-1.5">
                      {s.hindrances.map((h) => (
                        <li key={h.key} className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <span className="text-[11px] text-bone/45">{h.time}</span>
                          <span>{h.cause}</span>
                          {h.hours && <span className="text-bone/50">{h.hours} h</span>}
                          {h.idle && <span className="text-bone/50">{h.idle} idle</span>}
                          {h.photos.length > 0 && <Camera size={13} weight="light" className="text-bone/50" />}
                          <span className={`rounded-full px-2 py-0.5 text-[10px] ${PARTY[h.party]}`}>
                            {h.party === "Client" ? "Client · claimable" : h.party}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </Bezel>
        ))}
      </div>
    </Arrive>
  );
}

function Line({ label, children }: { label: string; children: ReactNode }) {
  return (
    <p className="flex gap-3">
      <span className="w-16 shrink-0 text-[10px] uppercase leading-5 tracking-[0.15em] text-bone/40">{label}</span>
      <span className="text-bone/80">{children}</span>
    </p>
  );
}
