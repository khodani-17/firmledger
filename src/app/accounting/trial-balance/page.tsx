import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/permissions";
import WorkspaceShell from "@/app/workspace-shell";

type SearchParams = {
  period?: string;
  asAt?: string;
};

function money(value: number) {
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: "ZAR",
    minimumFractionDigits: 2,
  }).format(value);
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("en-ZA", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(value);
}

function parseDate(value?: string) {
  if (!value) return undefined;

  const date = new Date(`${value}T23:59:59.999`);

  return Number.isNaN(date.getTime()) ? undefined : date;
}

export default async function TrialBalancePage({
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

  const periodId = params.period || "";

  const [accounts, periods] = await Promise.all([
    prisma.ledgerAccount.findMany({
      where: {
        firmId: user.firmId,
        active: true,
      },
      orderBy: [
        {
          code: "asc",
        },
        {
          name: "asc",
        },
      ],
      select: {
        id: true,
        code: true,
        name: true,
      },
    }),

    prisma.financialPeriod.findMany({
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
      },
    }),
  ]);

  const selectedPeriod =
    periods.find((period) => period.id === periodId) ?? null;

  let startDate: Date | undefined;
  let endDate: Date | undefined;

  if (selectedPeriod) {
    startDate = selectedPeriod.startDate;
    endDate = selectedPeriod.endDate;
  } else if (params.asAt) {
    endDate = parseDate(params.asAt);
  }

  const journalLines = await prisma.journalLine.findMany({
    where: {
      ledgerAccount: {
        firmId: user.firmId,
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
                      lte: endDate,
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
    },
  });

  const balances = new Map<
    string,
    {
      debit: number;
      credit: number;
    }
  >();

  for (const line of journalLines) {
    const debit = Number(line.debit ?? 0);
    const credit = Number(line.credit ?? 0);

    const existing = balances.get(line.ledgerAccountId) ?? {
      debit: 0,
      credit: 0,
    };

    existing.debit += debit;
    existing.credit += credit;

    balances.set(line.ledgerAccountId, existing);
  }

  const rows = accounts
    .map((account) => {
      const totals = balances.get(account.id) ?? {
        debit: 0,
        credit: 0,
      };

      const netBalance = totals.debit - totals.credit;

      return {
        id: account.id,
        code: account.code,
        name: account.name,
        debitBalance:
          netBalance > 0 ? netBalance : 0,
        creditBalance:
          netBalance < 0 ? Math.abs(netBalance) : 0,
      };
    })
    .filter(
      (account) =>
        account.debitBalance !== 0 ||
        account.creditBalance !== 0,
    );

  const totalDebits = rows.reduce(
    (total, row) => total + row.debitBalance,
    0,
  );

  const totalCredits = rows.reduce(
    (total, row) => total + row.creditBalance,
    0,
  );

  const difference = totalDebits - totalCredits;

  const isBalanced = Math.abs(difference) < 0.005;

  const asAtDate = params.asAt
    ? parseDate(params.asAt)
    : undefined;

  const hasFilter = Boolean(periodId || params.asAt);

  return (
    <WorkspaceShell user={user}>
      <main className="page">
        <div className="page-header">
          <div>
            <div className="page-eyebrow">
              ACCOUNTING
            </div>

            <h1 className="page-title">
              Trial Balance
            </h1>

            <p className="page-subtitle">
              Review account balances and verify that total debit
              balances equal total credit balances.
            </p>
          </div>

          <div className="page-actions">
            <span
              className={
                isBalanced
                  ? "status-badge status-success"
                  : "status-badge status-danger"
              }
            >
              <span className="status-dot" />
              {isBalanced ? "Balanced" : "Out of balance"}
            </span>

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
                Trial balance filters
              </div>

              <div className="section-description">
                Select a financial period or calculate balances as
                at a specific date.
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
                name="period"
                defaultValue={periodId}
              >
                <option value="">
                  All posted activity
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
              <span>As at</span>

              <input
                type="date"
                name="asAt"
                defaultValue={params.asAt || ""}
                disabled={Boolean(selectedPeriod)}
              />
            </label>

            <div className="ledger-filter-actions">
              <button
                type="submit"
                className="primary-button"
              >
                Apply filters
              </button>

              {hasFilter ? (
                <Link
                  href="/accounting/trial-balance"
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
              Total debits
            </div>

            <div className="metric-value metric-amount">
              {money(totalDebits)}
            </div>

            <div className="metric-caption">
              Debit balances
            </div>
          </div>

          <div className="card compact-card">
            <div className="metric-label">
              Total credits
            </div>

            <div className="metric-value metric-amount">
              {money(totalCredits)}
            </div>

            <div className="metric-caption">
              Credit balances
            </div>
          </div>

          <div className="card compact-card">
            <div className="metric-label">
              Accounts
            </div>

            <div className="metric-value">
              {rows.length}
            </div>

            <div className="metric-caption">
              Accounts with balances
            </div>
          </div>
        </div>

        <section className="card compact-card">
          <div className="section-header">
            <div>
              <div className="section-title">
                Trial balance
              </div>

              <div className="section-description">
                {selectedPeriod
                  ? `${selectedPeriod.name} account balances.`
                  : asAtDate
                    ? `Account balances as at ${formatDate(asAtDate)}.`
                    : "Account balances from all posted journal activity."}
              </div>
            </div>

            <div className="ledger-net-movement">
              <span className="metric-label">
                Difference
              </span>

              <strong
                className={
                  isBalanced
                    ? "ledger-net-value"
                    : "ledger-net-value ledger-negative"
                }
              >
                {money(Math.abs(difference))}
              </strong>
            </div>
          </div>

          <div className="table-scroll">
            <table className="table">
              <thead>
                <tr>
                  <th>Account</th>
                  <th>Description</th>
                  <th className="numeric">
                    Debit
                  </th>
                  <th className="numeric">
                    Credit
                  </th>
                </tr>
              </thead>

              <tbody>
                {rows.length > 0 ? (
                  rows.map((row) => (
                    <tr key={row.id}>
                      <td>
                        <div className="ledger-account-cell">
                          <span className="status-badge">
                            {row.code}
                          </span>

                          <span className="nowrap">
                            {row.name}
                          </span>
                        </div>
                      </td>

                      <td className="table-secondary-text">
                        {row.name}
                      </td>

                      <td className="numeric amount">
                        {row.debitBalance > 0
                          ? money(row.debitBalance)
                          : "—"}
                      </td>

                      <td className="numeric amount">
                        {row.creditBalance > 0
                          ? money(row.creditBalance)
                          : "—"}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan={4}
                      className="ledger-empty-cell"
                    >
                      <div className="empty-state">
                        <div className="empty-state-title">
                          No account balances found
                        </div>

                        <div className="empty-state-text">
                          There is no posted journal activity for
                          the selected period or date.
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>

              {rows.length > 0 ? (
                <tfoot>
                  <tr>
                    <td
                      colSpan={2}
                      className="total-label"
                    >
                      Totals
                    </td>

                    <td className="numeric amount total-value">
                      {money(totalDebits)}
                    </td>

                    <td className="numeric amount total-value">
                      {money(totalCredits)}
                    </td>
                  </tr>
                </tfoot>
              ) : null}
            </table>
          </div>

          <div className="ledger-footer">
            <span>
              {rows.length} account
              {rows.length === 1 ? "" : "s"}
            </span>

            <span>•</span>

            <span>
              Debits {money(totalDebits)}
            </span>

            <span>•</span>

            <span>
              Credits {money(totalCredits)}
            </span>

            <span>•</span>

            <span
              className={
                isBalanced
                  ? "status-text-success"
                  : "status-text-danger"
              }
            >
              {isBalanced ? "Balanced" : "Out of balance"}
            </span>
          </div>
        </section>
      </main>
    </WorkspaceShell>
  );
}