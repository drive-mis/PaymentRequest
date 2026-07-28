# Drive Finance — Contract-to-Cheque Payment Request & Treasury Execution System

An internal web app that replaces the Sales → Operations → Finance email handoff for car-loan
contracts with a structured, auditable workflow: contract creation, operations review, payment
request, finance approval, cheque issuance, and delivery to the customer.

## Tech stack

- **Next.js 14 (App Router) + TypeScript + Tailwind CSS**
- **SQLite via Prisma**, single table (`CarLoanRequest`) as required by the brief
- No external services — file uploads are written to `public/uploads` on local disk

## Running it locally

```bash
npm install
npm run db:push    # creates prisma/dev.db from schema.prisma
npm run db:seed     # loads 20 sample requests spanning every stage
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000). `npm run db:reset` wipes and reseeds
in one step if you want to start over.

## Signing in — the role-switcher

There's no real authentication. `/login` shows a roster of six personas, two per role:

| Role | Personas |
|---|---|
| Sales | Mona Aziz, Karim Adel |
| Operations | Yara Hassan, Tarek Fathy |
| Finance | Nadia Salem, Omar Ibrahim |

Picking a persona sets an `httpOnly` cookie (`df_session`) with that person's name and role.
Every subsequent request is scoped to that role server-side — the UI hides actions a role
shouldn't see, but the **API routes re-check permissions independently**, so nothing is
enforced by hiding buttons alone. Use "Switch" in the top bar (or `/login`) to change persona
at any time; "Sign out" clears the cookie.

## Where the seed data lives

`prisma/seed.ts` builds 20 `CarLoanRequest` rows covering every stage in the lifecycle:
Drafts (Sales- and Operations-created), a plain Submitted/Under-Review pair, a request
Returned by Operations and left pending, a second one that was returned *and* already
fixed-and-resubmitted, a Rejected-by-Operations case, the same pair of scenarios on the
Finance side (Returned-by-Finance pending vs. fixed-and-resubmitted), a Rejected-by-Finance
case, an Approved-by-Finance case ready for cheque issuance, a Cheque Issued case, a Cheque
Delivered to Operations case, two fully completed Delivered-to-Customer cases, one Cancelled
case, and a duplicate-flagged pair (same customer + same vehicle, different loan amount).

The customer and vehicle "source system" records it draws from live in
`src/lib/mockSource.ts` — a stand-in for the real customer/inventory systems the brief asks
to simulate as a lookup.

## Data model

Everything lives in one Prisma model, `CarLoanRequest` (`prisma/schema.prisma`), matching the
exact field names from the brief. A handful of business field names contain spaces (e.g.
`Contract Type`) or the pre-existing typo `Benefciary Documents` — Prisma model fields can't
contain spaces, so those are declared under a Prisma-safe identifier and mapped back with
`@map(...)` to the real column name. `src/lib/serialize.ts` converts between the two so that
**every JSON payload the API sends or receives uses the exact business field names**, not the
internal Prisma identifiers.

`StatusHistoryLog` and `AuditTrail` are stored as JSON-stringified arrays in text columns —
SQLite has no native JSON type — and are only ever written server-side, appended to on every
mutation. The client never writes to them directly.

## Business rules — where they live

All of Section 5's rules are implemented as server-side, mostly-pure functions in
`src/lib/rules.ts` (transition table, stage-ownership/field-editability, duplicate detection,
cheque-issuance gate, delivery gate) and enforced in the API route handlers
(`src/app/api/requests/**`), never just in the UI:

- `POST /api/requests` — create a contract (Sales or Operations only); runs duplicate
  detection before insert.
- `PATCH /api/requests/[appId]` — save-as-draft field edits, restricted by role + current
  `STATUS` + who created the record.
- `POST /api/requests/[appId]/actions` — the lifecycle engine. Body is
  `{ action, reason?, fields?, acknowledgeSimilar? }`; validates the transition, gates, and
  duplicate check atomically with any bundled field updates, then appends one
  `StatusHistoryLog` entry and one or more `AuditTrail` entries.

`STATUS` is never an editable form field anywhere in the UI — it only changes as the return
value of a lifecycle action.

## Screens

Dashboard, New Contract (Sales & Operations), My Submissions (Sales), Operations Review Queue,
My Payment Requests (Operations), Finance Review Queue, Payment Execution / Cheque Issuance,
Cheque Handover, Request Detail (full read-only record + status history, visible to all three
roles), and Reporting & Monitoring are all present as their own routes. **Deviation:** the
brief's screen 5, "Create Payment Request," is not a separate route — it's folded into the
Request Detail page's action panel for a request that's `Under Operations Review`, alongside
the Operations-review decision (Return/Reject/Submit). This keeps the one screen that already
shows the full record as the single place Operations fills in Section 4.6/4.7 and transitions
the request in one atomic call, rather than duplicating the read-only panels on a second page.

## Known deviations / follow-ups

- **Next.js version**: pinned to the latest 14.x patch (`14.2.35`) rather than upgrading to
  Next 16, which would be a breaking migration. `npm audit` still flags a handful of advisories
  against the Next 14 branch (mostly Server-Actions/Edge-runtime issues that don't apply to how
  this app is used — no `next/image` remote patterns, no custom server, no Server Actions).
  Worth revisiting before this app is ever exposed outside a local/internal network.
- **Duplicate-detection audit trail**: the brief's Section 8 asks for "blocked outright vs.
  flagged-and-acknowledged" duplicate metrics. Only the flagged-and-acknowledged count is
  tracked (`IsPotentialDuplicate` on the saved row) — outright-blocked attempts are rejected
  before a row is ever created, so there's nothing to count them from. A blocked-attempt log
  table would need to be added if that metric matters in practice.
- **File uploads** are written straight to `public/uploads` on local disk with a
  timestamp-prefixed filename — fine for local/demo use per the brief's non-functional
  requirements, not a production storage strategy.

## Project structure

```
prisma/schema.prisma       single-table data model
prisma/seed.ts              seed script
src/lib/rules.ts            transition table, gates, duplicate detection (pure functions)
src/lib/serialize.ts        Prisma-field <-> exact-business-field-name mapping
src/lib/mockSource.ts       simulated customer/vehicle source-system lookup
src/lib/reports.ts          reporting/monitoring aggregation
src/app/api/**              API routes — all business-rule enforcement happens here
src/app/(app)/**            authenticated screens (behind src/middleware.ts)
src/app/login               role-switcher
```
