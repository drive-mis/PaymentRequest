# Drive Finance — Contract-to-Cheque Payment Request & Treasury Execution System

An internal web app that replaces the Sales → Operations → Finance email handoff for car-loan
contracts with a structured, auditable workflow: contract creation, operations review, payment
request, finance approval, cheque issuance, and delivery to the customer.

**This is a frontend-only build.** There is no database, no API layer, and no server-side code.
Everything runs in the browser.

## Tech stack

- **Next.js 14 (App Router) + TypeScript + Tailwind CSS**
- **Data lives in the browser's `localStorage`** — no database, no backend services
- Recharts for the reporting charts

## Running it locally

```bash
npm install
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000). Nothing else to set up — no `.env`,
no database, no migrations.

## How the data works

On first visit the app writes 20 sample requests into `localStorage` under the key
`df_requests_v1`. From then on it reads and writes that same key, so **anything you do —
submitting, returning, approving, issuing a cheque, confirming delivery — persists across page
refreshes**.

Two consequences worth knowing:

- Data is **per-browser and per-device**. Two people opening the app see their own independent
  copy; nothing is shared between them.
- Clearing site data (or using a private window) starts you over from the sample data.

There's a **Reset data** button in the top-right header that restores the original 20 sample
requests at any time — handy for re-running a demo from a clean slate.

Sample data is generated in [`src/lib/seedData.ts`](src/lib/seedData.ts). It's built at runtime
rather than stored as a static blob so timestamps are always relative to today, which keeps the
aging buckets and average-time-per-stage charts meaningful.

## Signing in — the role-switcher

There's no real authentication. `/login` shows a roster of six personas, two per role:

| Role | Personas |
|---|---|
| Sales | Mona Aziz, Karim Adel |
| Operations | Yara Hassan, Tarek Fathy |
| Finance | Nadia Salem, Omar Ibrahim |

Picking a persona stores `{name, role}` in `localStorage` (`df_session_v1`) and sets the acting
role for the session. Use **Switch** in the top bar to change persona at any time, or **Sign
out** to clear it.

## Data model

One record type, `CarLoanRequest`, defined in [`src/lib/types.ts`](src/lib/types.ts). It uses
the **exact field names** from the brief, including the ones containing spaces (`Contract Type`,
`Payment Request Status`, `Cheque Number`) and the business's pre-existing spelling of
`Benefciary Documents`. Nothing renames them anywhere in the app — no mapping layer.

`StatusHistoryLog` and `AuditTrail` are embedded arrays on the record, exactly as the brief's
"history table inside the same row" requires. They're append-only and are only ever written by
the store, never by a screen.

## Where the business rules live

All of Section 5's rules are pure functions in [`src/lib/rules.ts`](src/lib/rules.ts) — the
transition table, stage/field ownership, duplicate detection, and the payment-request,
cheque-issuance, and delivery gates.

[`src/lib/store.tsx`](src/lib/store.tsx) is the **single choke point** for every mutation, and
it always runs those rules before writing. Screens never modify a record directly; they call
`createRequest`, `patchRequest`, or `performAction`. So a button rendered by mistake still can't
bypass a transition rule or a gate — the same guarantee the server-side API gave in the earlier
full-stack version of this app, just relocated to the client.

`STATUS` is never an editable input anywhere in the UI. It only changes as the result of a
lifecycle action.

## Screens

Dashboard, New Contract (Sales & Operations), My Submissions (Sales), Operations Review Queue,
My Payment Requests (Operations), Finance Review Queue, Payment Execution / Cheque Issuance,
Cheque Handover, Request Detail (full record + status history visible to all three roles), and
Reporting & Monitoring.

**Deviation:** the brief's screen 5, "Create Payment Request," is not a separate route — it's
folded into the Request Detail action panel for a request that's `Under Operations Review`,
alongside the Operations review decision. This keeps the one screen that already shows the full
record as the single place Operations fills in Sections 4.6/4.7 and transitions the request,
rather than duplicating the read-only panels on a second page.

## Known limitations of a frontend-only build

These are inherent to having no backend, not oversights:

- **No shared state.** Each browser has its own copy of the data. This is a UI prototype /
  single-user demo, not a multi-user system.
- **File uploads are names only.** Picking a file records its filename against the record (which
  is enough to exercise the document gates and show what was attached), but file *contents* are
  never read or stored. Swapping in real uploads later only requires `FileField`'s `onChange` to
  receive a URL instead of a filename.
- **Rules are enforced client-side.** Fine for a prototype. If this ever becomes a real
  multi-user system, `src/lib/rules.ts` is deliberately pure and framework-free so it can be
  moved to a server and reused unchanged — the rules would need to run there, since anything in
  the browser can be tampered with.
- **Duplicate metrics count flagged-and-acknowledged only.** Outright-blocked attempts never
  create a record, so there's nothing to count them from.
- `/requests/[appId]` is a dynamic route, so the app runs via `next dev` / `next start`. Making
  it deployable as fully static files (`output: 'export'`) would require switching that route to
  a query parameter, since request IDs aren't knowable at build time.

## Project structure

```
src/lib/types.ts         the single CarLoanRequest record type (exact business field names)
src/lib/rules.ts         transitions, stage ownership, gates, duplicate detection (pure)
src/lib/store.tsx        localStorage store — the only place records are written
src/lib/seedData.ts      the 20 sample requests, built at runtime
src/lib/mockSource.ts    simulated customer / vehicle source-system lookup
src/lib/reports.ts       reporting aggregation (pure)
src/lib/personas.ts      the six role-switcher personas
src/components/Guard.tsx client-side route guard (replaces server middleware)
src/app/(app)/**         the authenticated screens
src/app/login            role-switcher
```
