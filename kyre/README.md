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
