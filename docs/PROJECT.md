# Project passport

## Purpose

Redline Supply is a clickable prototype of one procurement loop: see a gap in supplier data, ask the suppliers who matter, compare their answers with the math visible, and approve every changed field before it touches master data.

## Audience

- Buyers and category managers who send requests and compare quotes.
- Compliance managers who watch REACH, RoHS, CBAM, EUDR and supply-chain due diligence coverage.
- Heads of procurement who give the second approval on sensitive changes.

## Status

First version. Local demo with seeded data. No login, no email, no ERP connection.

Live URL: [DENYS: paste the Vercel URL once the project is deployed]

## Stack

Next.js 15 (App Router), TypeScript, Tailwind CSS v4, shadcn-style components (owned source, Radix primitives), TanStack Table, Recharts, Zustand, Vitest, Playwright.

## Data

All data is fictional and generated from a fixed seed in `lib/mock`. 64 suppliers, 1,300 articles, five campaigns. The same records appear on every fresh load. Visitor decisions are kept in `localStorage` until "Reset demo".

The demo clock is 20 Nov 2026, Europe/Berlin, so expiry and due dates do not drift.

## Screens

| Route | What it shows |
|---|---|
| `/` | What needs the current role |
| `/suppliers`, `/articles` | Filterable directories |
| `/suppliers/[id]` | Profile, field history, activity |
| `/requests`, `/requests/[id]` | Campaigns and recipient states |
| `/requests/[id]/responses` | Raw answers and scenarios |
| `/requests/[id]/review` | Field-by-field approval |
| `/reports/[regulation]` | Coverage for CBAM, REACH, RoHS, EUDR, LkSG |

## Decisions

- A price change is sensitive when the current or the proposed value is at least €500. Bank details, REACH, RoHS, the LkSG self-assessment and CO₂e always need two approvers.
- The RoHS campaign and the CBAM campaign both start in review. One is the field-diff screen, the other is what moves the coverage numbers.
- "Unfinished" means recipients who have not fully answered.
- There is no phone number on a supplier. Streets are invented.
- The product name in the UI is Redline Supply until a final name is chosen.
- Sparklines are Recharts. The in-cell spend bar is a plain meter so 64 rows stay light.

## Open questions

- [DENYS: final product name, if it is not Redline Supply]
- [DENYS: whether the live demo should keep local changes or always reset]
- A real supplier form, document extraction and ERP import are out of this version. The seams are `lib/extract`, `lib/send` and the `erp_import` source.

## Owner

Denys Sergushkin
