# Vera

AI back office for mid-size Indian construction contractors.

- `app/`, `components/`, `content/`: the demo page (Next.js). It is at `/demo/<firm-slug>`. Add `?for=developer` for the developer version, which shows the free pilot and no fee box. All copy and figures are in `content/desks.ts`. Contact details are in `content/site.ts`; empty fields are hidden.
- `n8n/`: builds and checks the demo workflows (`node n8n/vera-demo.mjs check|build|deploy|smoke`). See `n8n/FREE-ISSUE.md`.
- `infra/`: n8n server (Docker Compose + Caddy). See `infra/README.md`.
- `docs/`: notes, e.g. whether the plant and surplus-stock desks are worth building.

All names and figures on the demo page are fictional sample data.

```
npm install
npm run dev        # http://localhost:3000/demo/sharma-infra
npm run check:n8n
```
