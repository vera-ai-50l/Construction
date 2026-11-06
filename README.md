# Vera

AI back office for mid-size Indian construction contractors.

- `app/`, `components/`, `content/`: the demo page (Next.js). It is at `/demo/<firm-slug>`. `?for=developer` now shows the same page as `/review`; the free-issue desk is not on the page (its n8n workflow is kept). `/review` is the version shared for feedback: built for contractors, no firm name, no offer. The page carries no pricing. All copy and figures are in `content/desks.ts`. Contact details are in `content/site.ts`; empty fields are hidden.
- `n8n/`: builds and checks the demo workflows (`node n8n/vera-demo.mjs check|build|deploy|smoke`). See `n8n/FREE-ISSUE.md`.
- `n8n/mobilise/`, `app/walk`, `docs/desk-05/`: Desk 05 One-day Mobilisation (10 n8n workflows, checklist, walk page, board). See `docs/desk-05/README.md`; `npm run check:mobilise`.
- `infra/`: n8n server (Docker Compose + Caddy). See `infra/README.md`.
- `docs/`: notes, e.g. whether the plant and surplus-stock desks are worth building.

All names and figures on the demo page are fictional sample data.

```
npm install
npm run dev        # http://localhost:3000/demo/sharma-infra
npm run check:n8n
```
