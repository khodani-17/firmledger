# FirmLedger by Manzima

FirmLedger is a South African law-firm financial management and bookkeeping platform designed for small and growing practices. It keeps lawyer-facing workflows simple while giving finance/accounting users a controlled double-entry accounting workspace.

## Current platform scope

- Multi-tenant firms and role-based access
- Clients and matters
- Client billing and VAT
- Client payments and invoice allocation
- Double-entry journals and trial balance
- Business bank accounts and reconciliation
- Expenses and disbursements
- Suppliers and purchase invoices
- Accounts payable and supplier payments
- Accountant review queue and audit trail
- Financial periods and month-end close controls
- VAT/tax working-paper preparation from posted journals
- Recurring billing schedules
- Credit notes
- Dedicated trust accounts, client/matter trust ledgers and trust reconciliation records
- Management financial reports

## Accounting controls

System-generated postings are balanced before they are saved. Business banking is separated from trust accounting. Trust transactions are held in their own subsystem and require client allocation. Closed periods and accountant review are intended to support month-end control.

FirmLedger does not claim to replace professional accounting or statutory responsibility. VAT/tax outputs are prepared as working figures and should be reviewed and submitted by the responsible professional/firm process.

## Demo credentials

- owner@example.com / ChangeMe123!
- finance@example.com / ChangeMe123!
- accountant@example.com / ChangeMe123!
- lawyer@example.com / ChangeMe123!

Change or remove demo credentials before production.

## Stack

- Next.js 16
- React 19
- TypeScript
- Prisma 7
- PostgreSQL / Neon

## Setup

1. Copy `.env.example` to `.env`.
2. Set `DATABASE_URL` and a strong `AUTH_SECRET`.
3. Install dependencies with `npm install`.
4. Generate Prisma client: `npm run db:generate`.
5. Push the schema: `npm run db:push`.
6. Seed development data: `npm run db:seed`.
7. Run: `npm run dev`.

## Important development note

The source was expanded to the full accounting workflow, but dependency installation/build verification still needs to be completed in an environment where npm package installation can finish successfully. The project intentionally excludes `node_modules` and `.next` from the package.
