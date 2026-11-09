# Vera AI — Site Structure

**Vera** (Latin: *true*). The true record of every site.
Buyer: promoter / MD of an Indian contractor doing ₹50–500 Cr a year.
Job of the page: get them to book the **free one-site Material Leak Check**.

## The flow (why this order)

The pitch doc says: lead with a rupee figure, then show the Site Record Desk as the way to stop the leak coming back. The page follows the same sales order.

| # | Section | Job | Signature interaction |
|---|---------|-----|-----------------------|
| 0 | Preloader | Set the tone | Counter 000→100, VERA letters decode in |
| 1 | Island nav | Always one tap from the CTA | Floating glass pill, hamburger morphs to X, full-screen staggered menu |
| 2 | **Hero** | "Your sites already talk. We make every rupee answer." | Live 3D construction site (tower assembling floor by floor, tower crane, WhatsApp data streaming in). Cursor steers the camera. **Hold to scan** — a scan plane sweeps the tower and lights up leaks with a running ₹ count |
| 3 | Material ticker | Speak their language | Infinite marquee: Cement · Fe500 steel · RMC · Challans · BOQ · Running bills · Tally |
| 4 | The leak (problem) | Put a number on the pain | Scroll-scrubbed word-by-word reveal + counting stats (2–5%, ₹1–2.5 Cr on ₹50 Cr) |
| 5 | The desks (solution) | Five products, one data spine | Pinned stacking cards, each with a live mini-UI: PO→challan match, WhatsApp→report, bill pack checklist, 13-week cash curve, claim timeline |
| 6 | 8 AM | Make the core product tangible | Phone with the owner's 8 AM WhatsApp summary typing in |
| 7 | How we work | Remove risk: free first, no new app | Horizontal scroll timeline (Week 1 → Month 3+), progress rail scrubbed by scroll |
| 8 | **Savings slider** | Turn it into their money | Sliders for annual work value, waste %, sites → leak, recoverable, Vera cost, net saving, ROI. Indian lakh/crore formatting, springy numbers |
| 9 | Pricing | Starter / Growth / Command | Double-bezel cards, Growth lifted, free leak check pinned on top |
| 10 | Straight answers | Trust: what we need, what we won't do | Accordion + "What Vera is not" (no ERP, no payroll, can't speed up a treasury) |
| 11 | Final CTA + footer | Close | Magnetic CTA, giant VERA wordmark revealed as footer slides up, live IST clock |

## 5 inspo sites (what we took)

1. **unseen.co** (Unseen Studio — Awwwards Studio of the Year, SOTM Feb 2023): enter gate + preloader, architecture as a 3D *world* not a picture, quiet type, film grain → our preloader, construction-world hero, grain overlay.
2. **lusion.co**: numeric counter preloader, cursor-reactive WebGL → hero camera follows the cursor.
3. **igloo.inc** (Awwwards Site of the Year 2024): scrambled-text decode, HUD-style labels over 3D → HUD cards in the hero decode in.
4. **linear.app**: blur-in headlines, product UI *as* the illustration, dark restraint → blur reveals, live mini-UIs inside the desk cards.
5. **apple.com product pages**: pinned scroll storytelling → stacking desk cards + horizontal "how we work" rail.

## Design system

- **Vibe:** dark "site at night" (warm OLED black `#0A0A09`) with a light "concrete" chapter (`#ECE9E3`) for the problem + calculator, back to dark for pricing/close.
- **Accent:** hi-vis safety orange `#FF5B1F` — used only for leaks, money and the primary CTA.
- **Type:** Geist (display/body, tight tracking), Instrument Serif italic for emphasis words, Geist Mono for HUD/data, Noto Sans Devanagari for Hindi voice notes.
- **Icons:** Phosphor, light weight only.
- **Cards:** double-bezel (outer shell + inner core, concentric radii).
- **Buttons:** pill with nested circular arrow that slides on hover; magnetic on desktop.
- **Motion:** Motion (Framer Motion) springs + `cubic-bezier(0.22,1,0.36,1)`; Lenis smooth scroll; every block enters with fade-up + blur; `prefers-reduced-motion` respected.
- **Local:** ₹ with lakh/crore formatting, Hindi voice notes, Indian city site names, WhatsApp-first.

## Stack

Next.js (App Router) · TypeScript · Tailwind v4 · Motion (`motion/react`, the current name of Framer Motion) · React Three Fiber for the hero · Lenis.
