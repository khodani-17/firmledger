import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/permissions";
import WorkspaceShell from "@/app/workspace-shell";

type SearchParams = {
  account?: string;
  period?: string;
  from?: string;
  to?: string;
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

  const date = new Date(`${value}T00:00:00`);

  return Number.isNaN(date.getTime()) ? undefined : date;
}

export default async function GeneralLedgerPage({
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

  const accountId = params.account || "";
  const periodId = params.period || "";

  let startDate = parseDate(params.from);
  let endDate = parseDate(params.to);

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

  const selectedPeriod = periods.find(
    (period) => period.id === periodId,
  );

  /*
   * A selected financial period takes precedence over manual dates.
   */
  if (selectedPeriod) {
    startDate = selectedPeriod.startDate;
    endDate = selectedPeriod.endDate;
  }

  const journalLines = await prisma.journalLine.findMany({
    where: {
      ledgerAccount: {
        firmId: user.firmId,
      },

      ...(accountId
        ? {
            ledgerAccountId: accountId,
          }
        : {}),

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

    orderBy: [
      {
        journalEntry: {
          entryDate: "asc",
        },
      },
      {
        journalEntryId: "asc",
      },
    ],

    include: {
      ledgerAccount: {
        select: {
          id: true,
          code: true,
          name: true,
        },
      },

      journalEntry: {
        select: {
          id: true,
          entryDate: true,
          reference: true,
          description: true,
          sourceType: true,
          sourceId: true,
        },
      },
    },
  });

  let totalDebits = 0;
  let totalCredits = 0;

  const accountBalances = new Map<string, number>();

  const rows = journalLines.map((line) => {
    const debit = Number(line.debit ?? 0);
    const credit = Number(line.credit ?? 0);

    totalDebits += debit;
    totalCredits += credit;

    const previousBalance =
      accountBalances.get(line.ledgerAccountId) ?? 0;

    const balance =
      previousBalance + debit - credit;

    accountBalances.set(
      line.ledgerAccountId,
      balance,
    );

    return {
      id: line.id,
      date: line.journalEntry.entryDate,
      accountId: line.ledgerAccountId,
      accountCode: line.ledgerAccount.code,
      accountName: line.ledgerAccount.name,
      reference: line.journalEntry.reference,
      description:
        line.description ||
        line.journalEntry.description ||
        "—",
      debit,
      credit,
      balance,
    };
  });

  const netMovement = totalDebits - totalCredits;

  const selectedAccount = accounts.find(
    (account) => account.id === accountId,
  );

  const hasFilters =
    Boolean(accountId) ||
    Boolean(periodId) ||
    Boolean(params.from) ||
    Boolean(params.to);

  return (
    <WorkspaceShell user={user}>
      <main className="page">
        <div className="page-header">
          <div>
            <div className="page-eyebrow">
              ACCOUNTING
            </div>

            <h1 className="page-title">
              General Ledger
            </h1>

            <p className="page-subtitle">
              Review posted journal activity, account
              movements, debits, credits and running
              balances.
            </p>
          </div>

          <div className="page-actions">
            <span className="status-badge">
              Posted entries
            </span>

            {hasFilters ? (
              <span className="status-badge">
                Filters applied
              </span>
            ) : null}
          </div>
        </div>

        <section className="card compact-card">
          <div className="section-header">
            <div>
              <h2 className="section-title">
                Ledger filters
              </h2>

              <p className="section-description">
                Narrow the ledger by account, financial
                period or transaction date.
              </p>
            </div>

            {selectedAccount ? (
              <span className="status-badge">
                {selectedAccount.code} —{" "}
                {selectedAccount.name}
              </span>
            ) : null}
          </div>

          <form
            method="get"
            className="ledger-filter-grid"
          >
            <label className="ledger-filter-field">
              <span>Account</span>

              <select
                name="account"
                defaultValue={accountId}
              >
                <option value="">
                  All accounts
                </option>

                {accounts.map((account) => (
                  <option
                    key={account.id}
                    value={account.id}
                  >
                    {account.code} — {account.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="ledger-filter-field">
              <span>Financial period</span>

              <select
                name="period"
                defaultValue={periodId}
              >
                <option value="">
                  All periods
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
              <span>From</span>

              <input
                type="date"
                name="from"
                defaultValue={params.from || ""}
                disabled={Boolean(selectedPeriod)}
              />
            </label>

            <label className="ledger-filter-field">
              <span>To</span>

              <input
                type="date"
                name="to"
                defaultValue={params.to || ""}
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

              {hasFilters ? (
                <Link
                  href="/accounting/general-ledger"
                  className="secondary-button"
                >
                  Clear
                </Link>
              ) : null}
            </div>
          </form>
        </section>

        <section className="grid grid-4 compact-grid">
          <article className="card compact-card">
            <div className="metric-label">
              Total debits
            </div>

            <div className="metric-value metric-amount">
              {money(totalDebits)}
            </div>

            <div className="metric-caption">
              Posted debit activity
            </div>
          </article>

          <article className="card compact-card">
            <div className="metric-label">
              Total credits
            </div>

            <div className="metric-value metric-amount">
              {money(totalCredits)}
            </div>

            <div className="metric-caption">
              Posted credit activity
            </div>
          </article>

          <article className="card compact-card">
            <div className="metric-label">
              Entries
            </div>

            <div className="metric-value">
              {journalLines.length}
            </div>

            <div className="metric-caption">
              Journal lines
            </div>
          </article>

          <article className="card compact-card">
            <div className="metric-label">
              Net movement
            </div>

            <div className="metric-value metric-amount">
              {money(netMovement)}
            </div>

            <div className="metric-caption">
              Debits less credits
            </div>
          </article>
        </section>

        <section className="card compact-card">
          <div className="section-header">
            <div>
              <h2 className="section-title">
                Ledger activity
              </h2>

              <p className="section-description">
                Posted journal lines matching the selected
                filters.
              </p>
            </div>

            <div className="ledger-net-movement">
              <span>Net movement</span>

              <strong>{money(netMovement)}</strong>
            </div>
          </div>

          <div className="table-scroll">
            <table className="table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Account</th>
                  <th>Reference</th>
                  <th>Description</th>
                  <th className="numeric">Debit</th>
                  <th className="numeric">Credit</th>
                  <th className="numeric">Balance</th>
                </tr>
              </thead>

              <tbody>
                {rows.length > 0 ? (
                  rows.map((row) => (
                    <tr key={row.id}>
                      <td className="date nowrap">
                        {formatDate(row.date)}
                      </td>

                      <td>
                        <div>
                          <strong>{row.accountCode}</strong>

                          <small className="table-secondary-text">
                            {row.accountName}
                          </small>
                        </div>
                      </td>

                      <td className="nowrap">
                        {row.reference || "—"}
                      </td>

                      <td>{row.description}</td>

                      <td className="amount nowrap">
                        {row.debit > 0
                          ? money(row.debit)
                          : "—"}
                      </td>

                      <td className="amount nowrap">
                        {row.credit > 0
                          ? money(row.credit)
                          : "—"}
                      </td>

                      <td
                        className={`amount nowrap ${
                          row.balance < 0
                            ? "ledger-negative"
                            : ""
                        }`}
                      >
                        {money(row.balance)}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="empty-state">
                      <div>
                        <div className="empty-state-title">
                          No journal activity found
                        </div>

                        <div className="empty-state-text">
                          Try changing the account, financial
                          period or date filters.
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>

              {rows.length > 0 ? (
                <tfoot>
                  <tr>
                    <td colSpan={4} className="total-label">
                      Totals
                    </td>

                    <td className="amount nowrap">
                      <strong>{money(totalDebits)}</strong>
                    </td>

                    <td className="amount nowrap">
                      <strong>{money(totalCredits)}</strong>
                    </td>

                    <td className="amount nowrap">
                      <strong>{money(netMovement)}</strong>
                    </td>
                  </tr>
                </tfoot>
              ) : null}
            </table>
          </div>

          <div className="ledger-footer">
            <span>
              {journalLines.length} journal line
              {journalLines.length === 1 ? "" : "s"}
            </span>

            <span>•</span>

            <span>Debits {money(totalDebits)}</span>

            <span>•</span>

            <span>Credits {money(totalCredits)}</span>
          </div>
        </section>
      </main>
    </WorkspaceShell>
  );
}