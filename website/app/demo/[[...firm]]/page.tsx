import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import DemoDesk from "@/components/DemoDesk";
import DemoLeak from "@/components/DemoLeak";
import { Clock } from "@/components/ui";

export const metadata: Metadata = {
  title: "Vera AI | Live demo",
  robots: { index: false, follow: false },
};

/** "/demo/sharma-infra" → "Sharma Infra". Anything odd in the slug is dropped. */
function firmName(slug?: string) {
  const s = decodeURIComponent(slug ?? "")
    .replace(/[^a-z0-9& -]/gi, " ")
    .replace(/[-\s]+/g, " ")
    .trim()
    .slice(0, 40);
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function Demo({ params }: PageProps<"/demo/[[...firm]]">) {
  return (
    <>
      <header className="px-4 pt-6 md:px-10">
        <div className="mx-auto flex max-w-[1280px] items-center justify-between gap-4 rounded-full bg-white/[0.04] py-2 pl-5 pr-2 ring-1 ring-white/10">
          <Link href="/" className="text-sm font-semibold tracking-[0.3em]">
            VERA
          </Link>
          <p className="hidden text-[10px] uppercase tracking-[0.2em] text-bone/45 sm:block">
            <Clock withSeconds={false} />
          </p>
          <span className="inline-flex items-center gap-2 rounded-full bg-hivis/10 px-3 py-1.5 text-[10px] uppercase tracking-[0.2em] text-hivis">
            <span className="size-1.5 animate-pulse rounded-full bg-hivis" /> Live on n8n
          </span>
        </div>
      </header>

      <main>
        <section className="px-4 pb-4 pt-20 md:px-10 md:pt-28">
          <div className="mx-auto max-w-[1280px]">
            <Suspense fallback={null}>
              {params.then(({ firm }) => {
                const name = firmName(firm?.[0]);
                return name ? <p className="text-[11px] uppercase tracking-[0.2em] text-bone/50">Prepared for {name}</p> : null;
              })}
            </Suspense>
            <h1 className="mt-4 max-w-[16ch] text-[clamp(2.8rem,7vw,6.5rem)] font-medium leading-[0.92] tracking-[-0.05em]">
              Find the leak. <span className="text-hivis">Then stop it coming back.</span>
            </h1>
            <p className="mt-6 max-w-[58ch] text-lg leading-relaxed text-bone/60">
              Two things Vera does, running live on our n8n server with sample data from a mid-size contractor. First the free
              one-site leak check, then the daily record that keeps it shut.
            </p>
            <nav className="mt-8 flex flex-wrap gap-2 text-sm">
              <a href="#leak" className="rounded-full bg-white/[0.06] px-4 py-2 ring-1 ring-white/10 hover:bg-white/10">
                01 Material Leak Check
              </a>
              <a href="#desk" className="rounded-full bg-white/[0.06] px-4 py-2 ring-1 ring-white/10 hover:bg-white/10">
                02 Site Record Desk
              </a>
            </nav>
          </div>
        </section>
        <DemoLeak />
        <DemoDesk />
      </main>
    </>
  );
}
