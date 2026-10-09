import Link from "next/link";
import { requireRole } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import WorkspaceShell from "@/app/workspace-shell";

type SearchParams = {
  startDate?: string;
  endDate?: string;
  periodId?: string;
};

type ReportAccount = {
  id: string;
  code: string;
  name: string;
  amount: number;
};

function money(amount: number, currency = "ZAR") {
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(amount);
}

function decimal(value: unknown) {
  return Number(value ?? 0);
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-ZA", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function toDate(value?: string) {
  if (!value) return undefined;

  const date = new Date(`${value}T00:00:00`);

  return Number.isNaN(date.getTime()) ? undefined : date;
}

function dateInputValue(date: Date) {
  return date.toISOString().slice(0, 10);
}

export default async function ProfitLossPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const user = await requireRole([
    "OWNER",
    "ADMIN",
    "FINANCE",
  ]);

  const params = await searchParams;

  const periods = await prisma.financialPeriod.findMany({
    where: {
      firmId: user.firmId,
    },
    orderBy: {
      startDate: "desc",
    },
    select: {
      id: true,
      name: true,
      startDate: true,
      endDate: true,
      status: true,
    },
  });

  const selectedPeriod =
    periods.find((period) => period.id === params.periodId) ??
    null;

  const periodStart = selectedPeriod?.startDate;
  const periodEnd = selectedPeriod?.endDate;

  const startDate =
    toDate(params.startDate) ?? periodStart;

  const endDate =
    toDate(params.endDate) ?? periodEnd;

  const journalLines = await prisma.journalLine.findMany({
    where: {
      ledgerAccount: {
        firmId: user.firmId,
        active: true,
      },

      journalEntry: {
        firmId: user.firmId,

        ...(startDate || endDate
          ? {
              entryDate: {
                ...(startDate
                  ? {
                      gte: startDate,
                    }
                  : {}),

                ...(endDate
                  ? {
                      lte: new Date(
                        `${dateInputValue(
                          endDate,
                        )}T23:59:59.999`,
                      ),
                    }
                  : {}),
              },
            }
          : {}),
      },
    },

    select: {
      ledgerAccountId: true,
      debit: true,
      credit: true,

      ledgerAccount: {
        select: {
          id: true,
          code: true,
          name: true,
          accountType: true,
          type: true,
        },
      },
    },
  });

  const revenueMap = new Map<string, ReportAccount>();
  const expenseMap = new Map<string, ReportAccount>();

  for (const line of journalLines) {
    const account = line.ledgerAccount;

    const debit = decimal(line.debit);
    const credit = decimal(line.credit);

    /*
     * Revenue normally has a credit balance.
     * Expense normally has a debit balance.
     *
     * Revenue = credits - debits
     * Expense = debits - credits
     */

    if (
      account.accountType === "REVENUE" ||
      account.type === "REVENUE"
    ) {
      const existing = revenueMap.get(account.id);

      revenueMap.set(account.id, {
        id: account.id,
        code: account.code,
        name: account.name,
        amount:
          (existing?.amount ?? 0) +
          credit -
          debit,
      });
    }

    if (
      account.accountType === "EXPENSE" ||
      account.type === "EXPENSE"
    ) {
      const existing = expenseMap.get(account.id);

      expenseMap.set(account.id, {
        id: account.id,
        code: account.code,
        name: account.name,
        amount:
          (existing?.amount ?? 0) +
          debit -
          credit,
      });
    }
  }

  const revenueAccounts = Array.from(revenueMap.values())
    .filter((account) => Math.abs(account.amount) >= 0.005)
    .sort((a, b) => a.code.localeCompare(b.code));

  const expenseAccounts = Array.from(expenseMap.values())
    .filter((account) => Math.abs(account.amount) >= 0.005)
    .sort((a, b) => a.code.localeCompare(b.code));

  const totalRevenue = revenueAccounts.reduce(
    (sum, account) => sum + account.amount,
    0,
  );

  const totalExpenses = expenseAccounts.reduce(
    (sum, account) => sum + account.amount,
    0,
  );

  const netProfit = totalRevenue - totalExpenses;
  const currency = "ZAR";

  const hasFilter = Boolean(
    params.periodId ||
      params.startDate ||
      params.endDate,
  );

  const reportingPeriod =
    startDate && endDate
      ? `${formatDate(startDate)} — ${formatDate(endDate)}`
      : startDate
        ? `From ${formatDate(startDate)}`
        : endDate
          ? `Up to ${formatDate(endDate)}`
          : "All available journal entries";

  return (
    <WorkspaceShell user={user}>
      <main className="page">
        <div className="page-header">
          <div>
            <div className="page-eyebrow">
              ACCOUNTING
            </div>

            <h1 className="page-title">
              Profit &amp; Loss
            </h1>

            <p className="page-subtitle">
              Revenue and expenses generated from the general
              ledger.
            </p>
          </div>

          <div className="page-actions">
            <Link
              href="/accounting/trial-balance"
              className="secondary-button"
            >
              Trial Balance
            </Link>

            {hasFilter ? (
              <span className="status-badge">
                Filter applied
              </span>
            ) : null}
          </div>
        </div>

        <section className="card compact-card">
          <div className="section-header">
            <div>
              <div className="section-title">
                Reporting filters
              </div>

              <div className="section-description">
                Select a financial period or enter a custom
                reporting range.
              </div>
            </div>

            {selectedPeriod ? (
              <span className="status-badge">
                {selectedPeriod.name}
              </span>
            ) : null}
          </div>

          <form
            method="get"
            className="ledger-filter-grid"
          >
            <label className="ledger-filter-field">
              <span>Financial period</span>

              <select
                id="periodId"
                name="periodId"
                defaultValue={selectedPeriod?.id ?? ""}
              >
                <option value="">
                  Custom date range
                </option>

                {periods.map((period) => (
                  <option
                    key={period.id}
                    value={period.id}
                  >
                    {period.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="ledger-filter-field">
              <span>Start date</span>

              <input
                id="startDate"
                name="startDate"
                type="date"
                defaultValue={
                  params.startDate ??
                  (periodStart
                    ? dateInputValue(periodStart)
                    : "")
                }
              />
            </label>

            <label className="ledger-filter-field">
              <span>End date</span>

              <input
                id="endDate"
                name="endDate"
                type="date"
                defaultValue={
                  params.endDate ??
                  (periodEnd
                    ? dateInputValue(periodEnd)
                    : "")
                }
              />
            </label>

            <div className="ledger-filter-actions">
              <button
                type="submit"
                className="primary-button"
              >
                Apply
              </button>

              {hasFilter ? (
                <Link
                  href="/accounting/profit-loss"
                  className="secondary-button"
                >
                  Clear
                </Link>
              ) : null}
            </div>
          </form>
        </section>

        <div className="grid grid-3 compact-grid">
          <div className="card compact-card">
            <div className="metric-label">
              Total revenue
            </div>

            <div className="metric-value metric-amount">
              {money(totalRevenue, currency)}
            </div>

            <div className="metric-caption">
              Revenue recognised
            </div>
          </div>

          <div className="card compact-card">
            <div className="metric-label">
              Total expenses
            </div>

            <div className="metric-value metric-amount">
              {money(totalExpenses, currency)}
            </div>

            <div className="metric-caption">
              Expenses recognised
            </div>
          </div>

          <div className="card compact-card">
            <div className="metric-label">
              {netProfit >= 0 ? "Net profit" : "Net loss"}
            </div>

            <div
              className={
                netProfit >= 0
                  ? "metric-value metric-amount status-text-success"
                  : "metric-value metric-amount status-text-danger"
              }
            >
              {money(Math.abs(netProfit), currency)}
            </div>

            <div className="metric-caption">
              Revenue less expenses
            </div>
          </div>
        </div>

        <section className="card compact-card">
          <div className="section-header">
            <div>
              <div className="page-eyebrow">
                REPORTING PERIOD
              </div>

              <div className="section-title">
                {reportingPeriod}
              </div>
            </div>

            {selectedPeriod ? (
              <span className="status-badge">
                {selectedPeriod.status}
              </span>
            ) : null}
          </div>
        </section>

        <div className="profit-loss-report-grid">
          <ReportSection
            title="Revenue"
            description="Income recognised during the selected period."
            accounts={revenueAccounts}
            total={totalRevenue}
            currency={currency}
          />

          <ReportSection
            title="Expenses"
            description="Expenses recognised during the selected period."
            accounts={expenseAccounts}
            total={totalExpenses}
            currency={currency}
          />
        </div>

        <section className="card compact-card">
          <div className="section-header">
            <div>
              <div className="page-eyebrow">
                NET RESULT
              </div>

              <div className="section-title">
                Total revenue less total expenses
              </div>
            </div>

            <div className="ledger-net-movement">
              <span className="metric-label">
                {netProfit >= 0 ? "Net profit" : "Net loss"}
              </span>

              <strong
                className={
                  netProfit >= 0
                    ? "ledger-net-value status-text-success"
                    : "ledger-net-value status-text-danger"
                }
              >
                {money(Math.abs(netProfit), currency)}
              </strong>
            </div>
          </div>
        </section>

        <div className="section-description">
          This report is calculated from posted journal lines
          classified as Revenue and Expense accounts. It does not
          calculate profit directly from invoices, payments, or bank
          transactions.
        </div>
      </main>
    </WorkspaceShell>
  );
}

function ReportSection({
  title,
  description,
  accounts,
  total,
  currency,
}: {
  title: string;
  description: string;
  accounts: ReportAccount[];
  total: number;
  currency: string;
}) {
  return (
    <section className="card compact-card">
      <div className="section-header">
        <div>
          <div className="section-title">
            {title}
          </div>

          <div className="section-description">
            {description}
          </div>
        </div>

        <span className="status-badge">
          {accounts.length}
        </span>
      </div>

      {accounts.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-title">
            No {title.toLowerCase()} recorded
          </div>

          <div className="empty-state-text">
            No posted journal activity was found for this
            period.
          </div>
        </div>
      ) : (
        <div className="table-scroll">
          <table className="table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Account</th>
                <th className="numeric">
                  Amount
                </th>
              </tr>
            </thead>

            <tbody>
              {accounts.map((account) => (
                <tr key={account.id}>
                  <td className="nowrap">
                    {account.code}
                  </td>

                  <td>
                    {account.name}
                  </td>

                  <td className="numeric amount">
                    {money(account.amount, currency)}
                  </td>
                </tr>
              ))}
            </tbody>

            <tfoot>
              <tr>
                <td
                  colSpan={2}
                  className="total-label"
                >
                  Total {title}
                </td>

                <td className="numeric amount total-value">
                  {money(total, currency)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </section>
  );
}