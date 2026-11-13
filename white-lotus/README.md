# White Lotus × Vera: pilot demos

Demo site for two ideas from the Vera AI proposal to White Lotus International Hospital. Self-contained Next.js app; nothing here touches the construction demo in the repo root.

- `/staffing`: **Staff roster and attendance summary** (idea 2). Planned against present per ward and shift, checked against minimum-cover rules, and the 7:30 message to the duty manager. Sample week in `lib/staffing.ts` (staff IDs only). Visitors can tap a staff ID to change a mark, or load their own roster CSV (`date,shift,ward,staff_id,role,status`); the file stays in the browser.
- `/ask`: **Employee questions assistant** (idea 3). Retrieval-augmented: BM25 search over the approved HR sections in `content/policies.ts` (`lib/rag.ts`), then Claude writes a short answer from the matching sections with citations (`lib/answer.ts`). Below the score bar, or when Claude finds the documents don't cover it, the question is handed to the named HR contact and logged in the HR inbox.

The HR policies are **sample text** written for the demo. Replace `content/policies.ts` with White Lotus's approved documents for a pilot.

## AI key

Set `ANTHROPIC_API_KEY` (Vercel: Project → Settings → Environment Variables, then redeploy). Without it the assistant still works: it shows the matching approved passages word for word, and the badge says "Passages mode". Model: `claude-opus-5-5` at low effort, with server-side refusal fallback enabled. `/api/ask` is limited to 30 questions per hour per IP per server instance.

```
npm install
npm run dev      # http://localhost:3000
npm run check    # retrieval and staffing checks, no network
```
