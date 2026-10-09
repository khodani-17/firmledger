import Link from "next/link";
import { requireRole } from "@/lib/permissions";

const financialReports = [
  {
    title: "Trial Balance",
    description: "Review debit and credit balances across the general ledger.",
    href: "/accounting/trial-balance",
    label: "Open report",
  },
  {
    title: "General Ledger",
    description: "Review detailed journal activity by ledger account.",
    href: "/accounting/general-ledger",
    label: "Open report",
  },
  {
    title: "Profit & Loss",
    description: "Review revenue, expenses and the resulting financial performance.",
    href: "/accounting/profit-loss",
    label: "Open report",
  },
  {
    title: "Balance Sheet",
    description: "Review assets, liabilities and equity as at a selected date.",
    href: "/accounting/balance-sheet",
    label: "Open report",
  },
  {
    title: "Cash Flow",
    description: "Review cash inflows, outflows and the resulting cash movement.",
    href: "/accounting/cash-flow",
    label: "Open report",
  },
];

const taxReports = [
  {
    title: "VAT / Tax",
    description: "Review output VAT, input VAT and the calculated net VAT position.",
    href: "/accounting/vat-tax",
    label: "Open report",
  },
  {
    title: "Bank Reconciliation",
    description: "Compare bank activity with recorded ledger transactions and identify unmatched items.",
    href: "/accounting/bank-reconciliation",
    label: "Open report",
  },
];

const receivablesPayables = [
  {
    title: "Accounts Receivable",
    description: "Review client invoices, collections, outstanding balances and overdue amounts.",
    href: "/accounting/accounts-receivable",
    label: "Open report",
  },
  {
    title: "Accounts Payable",
    description: "Review supplier obligations, payments, outstanding balances and overdue amounts.",
    href: "/accounting/accounts-payable",
    label: "Open report",
  },
];

function ReportCard({
  title,
  description,
  href,
  label,
}: {
  title: string;
  description: string;
  href: string;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="group rounded-xl border border-slate-800 bg-slate-950/70 p-5 transition hover:border-slate-600 hover:bg-slate-900"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-white group-hover:text-slate-100">
            {title}
          </h3>

          <p className="mt-2 max-w-xl text-xs leading-5 text-slate-400">
            {description}
          </p>
        </div>

        <span className="shrink-0 text-slate-500 transition group-hover:translate-x-0.5 group-hover:text-slate-300">
          →
        </span>
      </div>

      <div className="mt-5 text-xs font-medium text-slate-300">
        {label}
      </div>
    </Link>
  );
}

function ReportSection({
  title,
  description,
  reports,
}: {
  title: string;
  description: string;
  reports: typeof financialReports;
}) {
  return (
    <section>
      <div className="mb-4">
        <h2 className="text-sm font-semibold text-white">{title}</h2>
        <p className="mt-1 text-xs text-slate-500">{description}</p>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {reports.map((report) => (
          <ReportCard key={report.href} {...report} />
        ))}
      </div>
    </section>
  );
}

export default async function AccountingReportsPage() {
  await requireRole(["OWNER", "ADMIN", "FINANCE"]);

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col gap-4 border-b border-slate-800 pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="mb-2 text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
              Accounting
            </div>

            <h1 className="text-2xl font-semibold tracking-tight text-white">
              Accounting Reports
            </h1>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
              Access FirmLedger&apos;s financial, tax, reconciliation,
              receivables and payables reports from one place.
            </p>
          </div>

          <Link
            href="/accounting"
            className="inline-flex w-fit items-center rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-medium text-slate-300 transition hover:border-slate-600 hover:bg-slate-800 hover:text-white"
          >
            ← Accounting
          </Link>
        </div>

        <div className="space-y-9">
          <ReportSection
            title="Financial Reports"
            description="Core reports used to review the firm's financial position and performance."
            reports={financialReports}
          />

          <ReportSection
            title="Tax & Reconciliation"
            description="Reports supporting tax review and bank reconciliation processes."
            reports={taxReports}
          />

          <ReportSection
            title="Receivables & Payables"
            description="Reports for amounts owed by clients and amounts owed to suppliers."
            reports={receivablesPayables}
          />
        </div>

        <div className="mt-6 border-t border-slate-800 pt-5">
          <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-500">
            <Link
              href="/accounting/financial-periods"
              className="transition hover:text-slate-300"
            >
              Financial Periods
            </Link>

            <Link
              href="/accounting/cash-bank"
              className="transition hover:text-slate-300"
            >
              Cash & Bank
            </Link>

            <Link
              href="/accounting/general-ledger"
              className="transition hover:text-slate-300"
            >
              General Ledger
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}