# Kyre website

Static one-page site (no build step for the page itself). Deployed on Vercel as the `kyre-website` project with root directory `kyre/`.

- `index.html`, `styles.css`: the page.
- `contact.js`: contact details (WhatsApp, email, booking link) and the booking window.
- `src/story.js`: the hero globe of company tiles and the scroll story (three.js). Edit this, not `story.js`.
- `story.js`: the bundled, minified build of `src/story.js` that the page loads.

The story has five looks for a company, chosen with `?style=`: `tiles` (default), `network`, `names`, `people`, `envelopes`. Adding `?compare` or any `?style=` shows a switcher bar at the bottom of the page.

Rebuild `story.js` after editing `src/story.js` (three.js is resolved from `website/node_modules`):

```bash
NODE_PATH=../website/node_modules npx esbuild@0.24.2 src/story.js --bundle --minify --format=esm --target=es2020 --legal-comments=none --outfile=story.js
```

If WebGL is unavailable, the page falls back to the plain hero and a text version of the story.

## Hero concepts (for choosing)

`concepts/index.html` is a gallery of every hero option, with thumbnails. Four standalone concepts live in `concepts/`:

| Option | Page | Technique |
| --- | --- | --- |
| A | `sieve.html` | 2D canvas physics: company chips fall through three gates |
| B | `inbox.html` | DOM product UI: a live reply inbox, nine warmed mailboxes |
| C | `letter.html` | Kinetic type: an email written live from a hiring signal |
| D | `city.html` | Isometric canvas: a city of companies, planes out and back |

Each concept is `name.visual.html` (stage markup) + `name.css` + `name.js`, assembled into `name.html` by `python3 build_pages.py` (run in `concepts/`; edit captions there). `common.js` holds the shared scroll/caption logic. Options E to I are the globe looks on the homepage (`?style=`).

**Chosen:** Signal City (Option D) is now the homepage (`index.html` loads `concepts/common.js` + `concepts/city.js`), with a fifth step where the 15 leads are forwarded to the client's inbox. The globe version lives on at `globe.html` (`?style=` still works there). Team photos are in `team/`.
