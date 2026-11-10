"use client";

import { ArrowUpRight, LinkedinLogo } from "@phosphor-icons/react";
import { Eyebrow, Reveal, Words } from "./ui";

type Member = {
  name: string;
  college: string;
  linkedin: string;
  /** Photo in /public/team. Initials show until it is added. */
  photo?: string;
};

const TEAM: Member[] = [
  {
    name: "Rishiraj Nath",
    college: "IIM Calcutta",
    linkedin: "https://www.linkedin.com/in/rishiraj-nath-964a29292/",
    photo: "/team/rishiraj-nath.webp",
  },
  {
    name: "Shivam Vatkar",
    college: "IIM Calcutta",
    linkedin: "https://www.linkedin.com/in/shivam-vatkar-a29405281/",
    photo: "/team/shivam-vatkar.webp",
  },
  {
    name: "Aditya Bhagat",
    college: "IIM Indore",
    linkedin: "https://www.linkedin.com/in/aditya-bhagat-3949073b1/",
    photo: "/team/aditya-bhagat.webp",
  },
];

const BELIEFS = [
  ["The record is the product", "Everything we build sits on one true daily record of each site."],
  ["Meet sites where they are", "WhatsApp and voice notes in the supervisor’s own language. No new app."],
  ["Show the rupees first", "We prove the leak on one site, free, before anyone signs anything."],
] as const;

const initials = (name: string) =>
  name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

export default function Team() {
  return (
    <section id="team" className="relative -mt-10 rounded-t-[2.5rem] bg-ink-2 px-4 py-28 md:px-10 md:py-40">
      <div className="mx-auto max-w-[1440px]">
        <div className="grid gap-12 lg:grid-cols-12">
          <div className="lg:col-span-6">
            <Eyebrow>About us</Eyebrow>
            <Words
              text="Built for the people | who *build India.*"
              className="mt-6 text-[clamp(2.5rem,5.5vw,5.5rem)] font-medium leading-[0.95] tracking-[-0.05em]"
            />
          </div>
          <Reveal className="lg:col-span-6 lg:pt-14" delay={0.15}>
            <p className="max-w-[52ch] text-bone/60 md:text-lg">
              Vera is Latin for “true”. We are building the true record of every site for India’s mid-size
              contractors: the ₹50–500 Cr firms whose numbers still live in WhatsApp chats, paper registers and one
              overworked accounts team.
            </p>
            <ul className="mt-10 grid gap-6 border-t border-white/[0.08] pt-8 sm:grid-cols-3">
              {BELIEFS.map(([k, v]) => (
                <li key={k}>
                  <p className="text-sm font-medium tracking-[-0.01em]">{k}</p>
                  <p className="mt-2 text-sm leading-relaxed text-bone/50">{v}</p>
                </li>
              ))}
            </ul>
          </Reveal>
        </div>

        <div className="mt-24 flex items-end justify-between gap-6 border-t border-white/[0.08] pt-10 md:mt-32">
          <h3 className="text-[clamp(2rem,3.6vw,3.25rem)] font-medium leading-none tracking-[-0.045em]">
            Meet the <span className="text-hivis">team</span>
          </h3>
          <p className="hidden text-[11px] uppercase tracking-[0.2em] text-bone/40 md:block">
            Tap a photo for LinkedIn
          </p>
        </div>

        <ul className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {TEAM.map((m, i) => (
            <Reveal key={m.linkedin} delay={i * 0.1}>
              <li>
                <a
                  href={m.linkedin}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`${m.name} on LinkedIn (opens in a new tab)`}
                  className="group block rounded-[2rem] bg-white/[0.035] p-1.5 ring-1 ring-white/10 transition-transform duration-700 ease-vera hover:-translate-y-1.5 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-hivis"
                >
                  <div className="relative aspect-[4/5] overflow-hidden rounded-[calc(2rem-0.375rem)] bg-ink-3">
                    {m.photo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={m.photo}
                        alt={m.name}
                        loading="lazy"
                        className="size-full object-cover object-top transition-transform duration-700 ease-vera group-hover:scale-[1.04]"
                      />
                    ) : (
                      <div className="flex size-full items-center justify-center bg-[radial-gradient(circle_at_30%_20%,rgba(255,91,31,0.18),transparent_60%)] transition-transform duration-700 ease-vera group-hover:scale-[1.04]">
                        <span className="text-[clamp(4rem,9vw,7rem)] font-medium tracking-[-0.06em] text-bone/80">
                          {initials(m.name)}
                        </span>
                      </div>
                    )}

                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-black/0 to-black/0 opacity-60 transition-opacity duration-500 group-hover:opacity-100" />
                    <span className="absolute right-4 top-4 flex size-10 items-center justify-center rounded-full bg-black/40 text-white ring-1 ring-white/20 backdrop-blur-md transition-colors duration-500 group-hover:bg-[#0A66C2]">
                      <LinkedinLogo size={18} weight="fill" />
                    </span>
                    <span className="absolute inset-x-4 bottom-4 flex translate-y-3 items-center justify-between rounded-full bg-white py-1.5 pl-4 pr-1.5 text-sm font-medium text-black opacity-0 transition-all duration-500 ease-vera group-hover:translate-y-0 group-hover:opacity-100 group-focus-visible:translate-y-0 group-focus-visible:opacity-100">
                      View on LinkedIn
                      <span className="flex size-8 items-center justify-center rounded-full bg-black/10">
                        <ArrowUpRight size={14} weight="light" />
                      </span>
                    </span>
                  </div>
                  <div className="px-4 pb-4 pt-5">
                    <p className="text-xl font-medium tracking-[-0.03em]">{m.name}</p>
                    <p className="mt-1 text-sm text-bone/50">{m.college}</p>
                  </div>
                </a>
              </li>
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  );
}
