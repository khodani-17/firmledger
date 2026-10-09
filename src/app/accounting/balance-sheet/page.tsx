import Link from "next/link";
import { requireRole } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import WorkspaceShell from "@/app/workspace-shell";

type SearchParams = {
  asAt?: string;
  periodId?: string;
};

type BalanceAccount = {
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

function toDate(value?: string) {
  if (!value) return undefined;

  const date = new Date(`${value}T23:59:59.999`);

  return Number.isNaN(date.getTime()) ? undefined : date;
}

function dateInputValue(date: Date) {
  return date.toISOString().slice(0, 10);
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-ZA", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

export default async function BalanceSheetPage({
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

  const asAt =
    toDate(params.asAt) ??
    selectedPeriod?.endDate ??
    new Date();

  const journalLines = await prisma.journalLine.findMany({
    where: {
      ledgerAccount: {
        firmId: user.firmId,
        active: true,
      },
      journalEntry: {
        firmId: user.firmId,
        entryDate: {
          lte: asAt,
        },
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

  const assetMap = new Map<string, BalanceAccount>();
  const liabilityMap = new Map<string, BalanceAccount>();
  const equityMap = new Map<string, BalanceAccount>();

  let revenueBalance = 0;
  let expenseBalance = 0;

  for (const line of journalLines) {
    const account = line.ledgerAccount;

    const debit = decimal(line.debit);
    const credit = decimal(line.credit);

    const accountType = account.accountType ?? account.type;

    if (accountType === "ASSET") {
      const existing = assetMap.get(account.id);

      assetMap.set(account.id, {
        id: account.id,
        code: account.code,
        name: account.name,
        amount: (existing?.amount ?? 0) + debit - credit,
      });
    }

    if (accountType === "LIABILITY") {
      const existing = liabilityMap.get(account.id);

      liabilityMap.set(account.id, {
        id: account.id,
        code: account.code,
        name: account.name,
        amount: (existing?.amount ?? 0) + credit - debit,
      });
    }

    if (accountType === "EQUITY") {
      const existing = equityMap.get(account.id);

      equityMap.set(account.id, {
        id: account.id,
        code: account.code,
        name: account.name,
        amount: (existing?.amount ?? 0) + credit - debit,
      });
    }

    if (accountType === "REVENUE") {
      revenueBalance += credit - debit;
    }

    if (accountType === "EXPENSE") {
      expenseBalance += debit - credit;
    }
  }

  const assets = Array.from(assetMap.values())
    .filter((account) => Math.abs(account.amount) >= 0.005)
    .sort((a, b) => a.code.localeCompare(b.code));

  const liabilities = Array.from(liabilityMap.values())
    .filter((account) => Math.abs(account.amount) >= 0.005)
    .sort((a, b) => a.code.localeCompare(b.code));

  const equityAccounts = Array.from(equityMap.values())
    .filter((account) => Math.abs(account.amount) >= 0.005)
    .sort((a, b) => a.code.localeCompare(b.code));

  const totalAssets = assets.reduce(
    (sum, account) => sum + account.amount,
    0,
  );

  const totalLiabilities = liabilities.reduce(
    (sum, account) => sum + account.amount,
    0,
  );

  const totalEquityAccounts = equityAccounts.reduce(
    (sum, account) => sum + account.amount,
    0,
  );

  /*
   * Revenue - Expenses = Profit.
   * Profit increases equity.
   */
  const retainedResult = revenueBalance - expenseBalance;

  const totalEquity = totalEquityAccounts + retainedResult;

  const liabilitiesAndEquity = totalLiabilities + totalEquity;

  const difference = totalAssets - liabilitiesAndEquity;

  const isBalanced = Math.abs(difference) < 0.01;

  const currency = "ZAR";

  return (
    <WorkspaceShell user={user}>
      <main className="page">
        <div className="page-header">
          <div>
            <div className="page-eyebrow">
              ACCOUNTING
            </div>

            <h1 className="page-title">
              Balance Sheet
            </h1>

            <p className="page-subtitle">
              Financial position of the firm at a selected date.
            </p>
          </div>

          <div className="page-actions">
            <Link
              href="/accounting/profit-loss"
              className="secondary-button"
            >
              Profit &amp; Loss
            </Link>
          </div>
        </div>

        <form
          method="get"
          className="card compact-card"
        >
          <div className="section-header">
            <div>
              <h2 className="section-title">
                Report filters
              </h2>

              <p className="section-description">
                Select a financial period or specify a reporting date.
              </p>
            </div>
          </div>

          <div className="ledger-filter-grid">
            <label className="ledger-filter-field">
              <span>Financial period</span>

              <select
                id="periodId"
                name="periodId"
                defaultValue={selectedPeriod?.id ?? ""}
              >
                <option value="">
                  Custom / as-at date
                </option>

                {periods.map((period) => (
                  <option key={period.id} value={period.id}>
                    {period.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="ledger-filter-field">
              <span>As at</span>

              <input
                id="asAt"
                name="asAt"
                type="date"
                defaultValue={
                  params.asAt
                    ? params.asAt
                    : dateInputValue(asAt)
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
            </div>
          </div>
        </form>

        <section className="grid grid-3 compact-grid">
          <SummaryCard
            label="Total assets"
            value={money(totalAssets, currency)}
          />

          <SummaryCard
            label="Total liabilities"
            value={money(totalLiabilities, currency)}
          />

          <SummaryCard
            label="Total equity"
            value={money(totalEquity, currency)}
          />
        </section>

        <section
          className={`card compact-card ${
            isBalanced ? "" : "border border-amber-700"
          }`}
        >
          <div className="section-header">
            <div>
              <h2 className="section-title">
                Accounting equation
              </h2>

              <p className="section-description">
                Assets = Liabilities + Equity
              </p>
            </div>

            <div className="ledger-net-movement">
              <span>
                {isBalanced ? "Status" : "Difference"}
              </span>

              <strong>
                {isBalanced
                  ? "Balanced"
                  : money(Math.abs(difference), currency)}
              </strong>
            </div>
          </div>

          <div className="grid grid-3 compact-grid">
            <ResultLine
              label="Total assets"
              value={money(totalAssets, currency)}
            />

            <ResultLine
              label="Liabilities + equity"
              value={money(liabilitiesAndEquity, currency)}
            />

            <ResultLine
              label="Difference"
              value={money(Math.abs(difference), currency)}
            />
          </div>

          {!isBalanced ? (
            <p className="section-description">
              The accounting equation does not balance for this reporting date.
              Review the ledger and account classifications.
            </p>
          ) : null}
        </section>

        <section className="card compact-card">
          <div className="section-header">
            <div>
              <h2 className="section-title">
                Reporting date
              </h2>

              <p className="section-description">
                {formatDate(asAt)}
              </p>
            </div>

            {selectedPeriod ? (
              <div className="ledger-net-movement">
                <span>Financial period</span>

                <strong>
                  {selectedPeriod.name}
                </strong>

                <span>
                  {selectedPeriod.status}
                </span>
              </div>
            ) : null}
          </div>
        </section>

        <div className="grid grid-2 compact-grid">
          <ReportSection
            title="Assets"
            description="Resources controlled by the firm."
            accounts={assets}
            total={totalAssets}
            currency={currency}
          />

          <div className="grid compact-grid">
            <ReportSection
              title="Liabilities"
              description="Obligations owed by the firm."
              accounts={liabilities}
              total={totalLiabilities}
              currency={currency}
            />

            <section className="card compact-card">
              <div className="section-header">
                <div>
                  <h2 className="section-title">
                    Equity
                  </h2>

                  <p className="section-description">
                    Owners&apos; equity and accumulated financial result.
                  </p>
                </div>
              </div>

              {equityAccounts.length === 0 &&
              Math.abs(retainedResult) < 0.005 ? (
                <div className="empty-state">
                  <div className="empty-state-title">
                    No equity activity recorded
                  </div>

                  <div className="empty-state-text">
                    No equity or accumulated result was found for this date.
                  </div>
                </div>
              ) : (
                <>
                  <div className="table-scroll">
                    <table className="table">
                      <thead>
                        <tr>
                          <th>Account</th>
                          <th className="numeric">Balance</th>
                        </tr>
                      </thead>

                      <tbody>
                        {equityAccounts.map((account) => (
                          <tr key={account.id}>
                            <td>
                              <strong>{account.name}</strong>

                              <small className="table-secondary-text">
                                {account.code}
                              </small>
                            </td>

                            <td className="amount nowrap">
                              {money(account.amount, currency)}
                            </td>
                          </tr>
                        ))}

                        {Math.abs(retainedResult) >= 0.005 ? (
                          <tr>
                            <td>
                              <strong>Accumulated result</strong>

                              <small className="table-secondary-text">
                                Revenue less expenses
                              </small>
                            </td>

                            <td className="amount nowrap">
                              {money(retainedResult, currency)}
                            </td>
                          </tr>
                        ) : null}
                      </tbody>

                      <tfoot>
                        <tr>
                          <td className="total-label">
                            Total equity
                          </td>

                          <td className="amount nowrap">
                            <strong>
                              {money(totalEquity, currency)}
                            </strong>
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </>
              )}
            </section>
          </div>
        </div>

        <div className="section-description">
          This report is calculated from journal lines classified as Assets,
          Liabilities, Equity, Revenue, and Expenses. The accumulated result
          is included in equity so that the accounting equation can be tested
          against the ledger.
        </div>
      </main>
    </WorkspaceShell>
  );
}

function SummaryCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <article className="card compact-card">
      <div className="metric-label">
        {label}
      </div>

      <div className="metric-value metric-amount">
        {value}
      </div>
    </article>
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
  accounts: BalanceAccount[];
  total: number;
  currency: string;
}) {
  return (
    <section className="card compact-card">
      <div className="section-header">
        <div>
          <h2 className="section-title">
            {title}
          </h2>

          <p className="section-description">
            {description}
          </p>
        </div>
      </div>

      {accounts.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-title">
            No {title.toLowerCase()} recorded
          </div>

          <div className="empty-state-text">
            No posted journal activity was found for this date.
          </div>
        </div>
      ) : (
        <div className="table-scroll">
          <table className="table">
            <thead>
              <tr>
                <th>Account</th>
                <th className="numeric">Balance</th>
              </tr>
            </thead>

            <tbody>
              {accounts.map((account) => (
                <tr key={account.id}>
                  <td>
                    <strong>{account.name}</strong>

                    <small className="table-secondary-text">
                      {account.code}
                    </small>
                  </td>

                  <td className="amount nowrap">
                    {money(account.amount, currency)}
                  </td>
                </tr>
              ))}
            </tbody>

            <tfoot>
              <tr>
                <td className="total-label">
                  Total {title}
                </td>

                <td className="amount nowrap">
                  <strong>
                    {money(total, currency)}
                  </strong>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </section>
  );
}

function ResultLine({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div>
      <div className="metric-label">
        {label}
      </div>

      <div className="metric-value metric-amount">
        {value}
      </div>
    </div>
  );
}