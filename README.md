# Vera

AI back office for mid-size Indian construction contractors.

- `app/`, `components/`, `content/`: the demo page (Next.js). It is at `/demo/<firm-slug>`. `?for=developer` now shows the same page as `/review`; the free-issue desk is not on the page (its n8n workflow is kept). `/review` is a short brief for a developer's teams: five problems and five fixes (leak check, daily and weekly reports, cross-site stock balance, supervisor-wise wastage, one-day site opening), and where AI is and is not used. No firm name, no offer. The contractor page shows leak check, site records, stock balance, wastage and plant & formwork. Which link shows a desk is set by its `audience` in `content/desks.ts`. The page carries no pricing. All copy and figures are in `content/desks.ts`, `content/runs.ts` and `content/chats.ts`. Contact details are in `content/site.ts`; empty fields are hidden.
- `/ipc` (health, first flow): **IPC Compliance Kit** for an infection-control adviser's care homes. One month of returns (4 audits per home, symptom log, training register) goes through 6 steps: collect returns, score & action plan, outbreak watch (2+ D&V cases in 48 h), training check, CQC evidence pack against the Code of Practice's 10 criteria, hours & £. The step code is `lib/ipc-flow.mjs`; the page runs it in the browser on Run the flow, and `n8n/flows/ipc.mjs` turns the same functions into n8n Code nodes. Sample month: `lib/ipc-sample.json` (6 fictional homes). Copy, assumptions and sources: `content/ipc.ts`.
- `n8n/`: builds and checks the demo workflows (`node n8n/vera-demo.mjs check|build|deploy|smoke`). See `n8n/FREE-ISSUE.md`.
- `infra/`: n8n server (Docker Compose + Caddy). See `infra/README.md`.
- `docs/`: notes, e.g. whether the plant and surplus-stock desks are worth building.

All names and figures on the demo page are fictional sample data.

```
npm install
npm run dev        # http://localhost:3000/demo/sharma-infra
npm run check:n8n
```
