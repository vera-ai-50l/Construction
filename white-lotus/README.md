# Vera for hospital HR: working demos

Demo site for a hospital HR team: four working tools on sample data. The pages carry no client name. Self-contained Next.js app; nothing here touches the construction demo in the repo root. Page copy speaks to HR directly (no proposal or idea numbers).

- `/staffing`: **Staffing summary**. Planned against present per ward and shift, checked against minimum-cover rules, and the 7:30 message to the duty manager. Sample week in `lib/staffing.ts` (staff IDs only). Visitors can tap a staff ID to change a mark, or load their own roster CSV (`date,shift,ward,staff_id,role,status`); the file stays in the browser.
- `/ask`: **HR assistant**. Retrieval-augmented: BM25 search over the approved HR sections in `content/policies.ts` (`lib/rag.ts`), then Claude writes a short answer from the matching sections with citations (`lib/answer.ts`). Below the score bar, or when Claude finds the documents don't cover it, the question is handed to the named HR contact and logged in the HR inbox.

- `/recruitment`: **Recruitment assistant**. The visitor plays a candidate on a WhatsApp-style chat: role, screening questions, registration number, document photos, interview slot. HR's applications sheet fills in live and raises an alert when an application is complete. It flags, never rejects. Roles, slots and the sample pipeline are in `lib/recruitment.ts`.
- `/reports`: **Weekly report**. Builds a one-page summary (email or 5-line WhatsApp) from the staffing week, the recruitment sheet and the HR assistant's log (`lib/report.ts`); printable as PDF.

The HR policies are **sample text** written for the demo. Replace `content/policies.ts` with the hospital's approved documents for a pilot.

## AI key

Set `ANTHROPIC_API_KEY` (Vercel: Project → Settings → Environment Variables, then redeploy). Without it the assistant still works: it shows the matching approved passages word for word, and the badge says "Passages mode". Model: `claude-opus-5-5` at low effort, with server-side refusal fallback enabled. `/api/ask` is limited to 30 questions per hour per IP per server instance.

```
npm install
npm run dev      # http://localhost:3000
npm run check    # retrieval and staffing checks, no network
```
