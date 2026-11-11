"""Generates the Kyre concept pages from one frame. Run: python3 build_pages.py (from kyre/concepts)."""
import html, pathlib

HERE = pathlib.Path(__file__).parent

CONCEPTS = [
    ("sieve", "The Sieve", [
        ("01 · Signals", "1,020", "are hiring right now", "Twelve thousand companies go in. Only the ones hiring this month get through the first gate."),
        ("02 · Replies", "51", "write back", "Every company that gets through hears from you personally. The ones who reply drop to the next gate."),
        ("03 · Interested", "15", "say yes", "Out of office, not now and unsubscribe slide off. Only real interest gets through."),
        ("04 · Your tray", "15", "leads, handed to you", "That's what lands with you, and that's all you pay for."),
    ]),
    ("inbox", "The Live Inbox", [
        ("01 · Sorted", "51", "replies, read for you", "Out of office, not now, unsubscribe: Kyre answers or clears them, so your inbox only holds conversations."),
        ("02 · In your name", "9", "mailboxes sending", "New mailboxes in your company's name, warmed for 2 to 4 weeks, each sending a careful 25 a day."),
        ("03 · Yours", "15", "interested leads", "Only replies that say yes reach you. You pay per lead, and only for these."),
    ]),
    ("letter", "The Letter", [
        ("01 · The signal", "1,020", "companies hiring now", "Every email starts from something real: a job post, a new hire, a team growing."),
        ("02 · Sent", "1", "email in your name", "Short and specific, sent from a warmed mailbox in your company's name."),
        ("03 · The reply", "51", "replies a month", "Kyre reads every reply. Not now, out of office and unsubscribes never reach you."),
        ("04 · The lead", "15", "interested, handed to you", "The ones who say yes come to you with the whole conversation. You pay for those."),
    ]),
    ("city", "Signal City", [
        ("01 · The scan", "1,020", "companies hiring now", "A scan across your market lights up every company with a reason to talk this month."),
        ("02 · Outreach", "1,020", "personal emails", "Sent from mailboxes in your name, each one about that company's own hiring."),
        ("03 · Replies", "51", "conversations start", "Kyre reads every reply and keeps the noise away from you."),
        ("04 · Interested", "15", "handed to you", "The companies that say yes rise to the top, with the full conversation. Billed per lead."),
    ]),
]

SWITCH = [("../?style=tiles", "Globe")] + [(f"{c[0]}.html", c[1]) for c in CONCEPTS] + [("index.html", "All options")]

PAGE = """<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Kyre | Concept: {title}</title>
<meta name="robots" content="noindex">
<link rel="icon" href="../favicon.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter+Tight:wght@400;500;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="../styles.css">
<link rel="stylesheet" href="concept.css">
<link rel="stylesheet" href="{name}.css">
</head>
<body class="concept-{name}">

<header class="nav">
  <div class="wrap nav-in">
    <a href="../" class="logo" aria-label="Kyre home">kyre<span>.</span></a>
    <nav class="nav-links" aria-label="Sections">
      <a href="../#how">How it works</a>
      <a href="../#pricing">Pricing</a>
      <a href="../#faq">FAQ</a>
    </nav>
    <a class="btn btn-dark btn-sm js-book" href="#">Book a call</a>
  </div>
</header>

<main id="top">
  <section class="cstory" id="cstory" style="height: {height}vh" aria-label="How Kyre finds your interested leads">
    <div class="cstage" id="cstage">
{visual}
      <div class="chero" id="chero">
        <div class="wrap">
          <div class="hero-copy">
            <p class="eyebrow"><span class="dot"></span>Pay-per-lead outbound for companies that hire</p>
            <h1>Interested leads, <em>or you don't pay.</em></h1>
            <p class="lede">Kyre runs cold outreach for recruitment agencies, staffing firms and companies that are hiring. You pay per interested lead. No retainer. No setup fee.</p>
            <div class="cta-row">
              <a class="btn btn-accent js-book" href="#">Book a 15-minute call</a>
              <a class="btn btn-ghost" href="../#how">How it works</a>
            </div>
            <ul class="proof"><li>No retainer</li><li>No upfront fee</li><li>Billed per interested lead</li></ul>
          </div>
        </div>
      </div>

      <div class="ccap" id="ccap" aria-hidden="true">
        <div class="cap-card" style="margin-left: max(24px, calc((100vw - 1160px) / 2 + 24px))">
          <div class="caps">
{caps}
          </div>
          <div class="seg">{segs}</div>
          <p class="cap-note">An illustrative month for one client.</p>
        </div>
      </div>
    </div>
  </section>

  <section class="cend">
    <div class="wrap">
      <h2>Your next hires and clients <em>are already out there.</em></h2>
      <div class="cta-row">
        <a class="btn btn-accent js-book" href="#">Book a 15-minute call</a>
        <a class="btn btn-ghost" href="index.html">See all concepts</a>
      </div>
    </div>
  </section>
</main>

<span class="concept-tag">Concept · {title}</span>
<nav class="look-switch" aria-label="Concepts"><span>Concept</span>{switch}</nav>

<script src="../contact.js"></script>
<script src="common.js"></script>
<script src="{name}.js"></script>
</body>
</html>
"""


def main():
    for name, title, caps in CONCEPTS:
        visual = (HERE / f"{name}.visual.html").read_text()
        cap_html = "\n".join(
            f'            <div class="cap"><span class="k">{html.escape(k)}</span><span class="n">{n}</span><h3>{html.escape(h)}</h3><p>{html.escape(p)}</p></div>'
            for k, n, h, p in caps
        )
        current = ' aria-current="true"'
        switch = "".join(
            '<a href="%s"%s>%s</a>' % (href, current if href == name + ".html" else "", html.escape(label)) for href, label in SWITCH
        )
        page = PAGE.format(
            name=name, title=html.escape(title), height=100 + 90 * len(caps), visual=visual, caps=cap_html,
            segs="<i></i>" * len(caps), switch=switch,
        )
        (HERE / f"{name}.html").write_text(page)
        print("wrote", f"{name}.html")


if __name__ == "__main__":
    main()
