# Vera

AI back office for mid-size Indian construction contractors.

- `app/`, `components/`, `content/`: the demo page (Next.js). It is at `/demo/<firm-slug>`. `?for=developer` now shows the same page as `/review`; the free-issue desk is not on the page (its n8n workflow is kept). `/review` is a short brief for a developer's teams: five problems and five fixes (leak check, daily and weekly reports, cross-site stock balance, supervisor-wise wastage, one-day site opening), and where AI is and is not used. No firm name, no offer. The contractor page shows leak check, site records, stock balance, wastage and plant & formwork. Which link shows a desk is set by its `audience` in `content/desks.ts`. The page carries no pricing. All copy and figures are in `content/desks.ts`, `content/runs.ts` and `content/chats.ts`. Contact details are in `content/site.ts`; empty fields are hidden.
- `n8n/`: builds and checks the demo workflows (`node n8n/vera-demo.mjs check|build|deploy|smoke`). See `n8n/FREE-ISSUE.md`.
- `infra/`: n8n server (Docker Compose + Caddy). See `infra/README.md`.
- `docs/`: notes, e.g. whether the plant and surplus-stock desks are worth building.

All names and figures on the demo page are fictional sample data.

```
npm install
npm run dev        # http://localhost:3000/demo/sharma-infra
npm run check:n8n
```
