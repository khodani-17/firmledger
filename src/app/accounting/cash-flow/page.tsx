import Link from "next/link";
import { requireRole } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import WorkspaceShell from "@/app/workspace-shell";

type SearchParams = {
  startDate?: string;
  endDate?: string;
  bankAccountId?: string;
};

function money(value: number) {
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: "ZAR",
    minimumFractionDigits: 2,
  }).format(value);
}

function dateOnly(value: Date) {
  return value.toISOString().slice(0, 10);
}

export default async function CashFlowPage({
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
  const today = new Date();

  const startDate = params.startDate
    ? new Date(`${params.startDate}T00:00:00`)
    : new Date(
        today.getFullYear(),
        today.getMonth(),
        1,
      );

  const endDate = params.endDate
    ? new Date(`${params.endDate}T23:59:59.999`)
    : new Date(today);

  const bankAccountId = params.bankAccountId || "";

  const [
    bankAccounts,
    transactionsBeforePeriod,
    transactions,
  ] = await Promise.all([
    prisma.bankAccount.findMany({
      where: {
        firmId: user.firmId,
        active: true,
      },
      orderBy: {
        name: "asc",
      },
      select: {
        id: true,
        name: true,
        bankName: true,
        openingBalance: true,
        currency: true,
        isTrust: true,
      },
    }),

    prisma.bankTransaction.findMany({
      where: {
        firmId: user.firmId,
        transactionDate: {
          lt: startDate,
        },
        ...(bankAccountId ? { bankAccountId } : {}),
      },
      orderBy: {
        transactionDate: "asc",
      },
      select: {
        bankAccountId: true,
        type: true,
        amount: true,
      },
    }),

    prisma.bankTransaction.findMany({
      where: {
        firmId: user.firmId,
        transactionDate: {
          gte: startDate,
          lte: endDate,
        },
        ...(bankAccountId ? { bankAccountId } : {}),
      },
      orderBy: {
        transactionDate: "asc",
      },
      select: {
        id: true,
        bankAccountId: true,
        transactionDate: true,
        type: true,
        amount: true,
        description: true,
        reference: true,
        matched: true,
      },
    }),
  ]);

  const selectedAccounts = bankAccounts.filter(
    (account) =>
      !bankAccountId || account.id === bankAccountId,
  );

  const openingBalance = selectedAccounts.reduce(
    (total, account) =>
      total + Number(account.openingBalance),
    0,
  );

  const movementBeforePeriod =
    transactionsBeforePeriod.reduce(
      (total, transaction) => {
        const amount = Number(transaction.amount);

        return (
          total +
          (transaction.type === "CREDIT"
            ? amount
            : -amount)
        );
      },
      0,
    );

  const calculatedOpeningCash =
    openingBalance + movementBeforePeriod;

  const moneyIn = transactions
    .filter(
      (transaction) => transaction.type === "CREDIT",
    )
    .reduce(
      (total, transaction) =>
        total + Number(transaction.amount),
      0,
    );

  const moneyOut = transactions
    .filter(
      (transaction) => transaction.type === "DEBIT",
    )
    .reduce(
      (total, transaction) =>
        total + Number(transaction.amount),
      0,
    );

  const netCashMovement = moneyIn - moneyOut;

  const closingCash =
    calculatedOpeningCash + netCashMovement;

  const matchedIn = transactions
    .filter(
      (transaction) =>
        transaction.type === "CREDIT" &&
        transaction.matched,
    )
    .reduce(
      (total, transaction) =>
        total + Number(transaction.amount),
      0,
    );

  const matchedOut = transactions
    .filter(
      (transaction) =>
        transaction.type === "DEBIT" &&
        transaction.matched,
    )
    .reduce(
      (total, transaction) =>
        total + Number(transaction.amount),
      0,
    );

  const unmatchedCount = transactions.filter(
    (transaction) => !transaction.matched,
  ).length;

  const selectedAccountNames =
    selectedAccounts.length > 0
      ? selectedAccounts
          .map((account) => account.name)
          .join(", ")
      : "No active bank accounts";

  const hasFilters =
    Boolean(params.startDate) ||
    Boolean(params.endDate) ||
    Boolean(bankAccountId);

  return (
    <WorkspaceShell user={user}>
      <main className="page">
        <header className="page-header">
          <div>
            <div className="page-eyebrow">
              ACCOUNTING / FINANCIAL REPORTS
            </div>

            <h1 className="page-title">
              Cash Flow Statement
            </h1>

            <p className="page-subtitle">
              Cash movement across the firm&apos;s bank
              accounts for the selected period.
            </p>
          </div>

          <div className="page-actions">
            <Link
              href="/accounting"
              className="secondary-button"
            >
              Back to Accounting
            </Link>

            {hasFilters ? (
              <span className="status-badge">
                Filters applied
              </span>
            ) : null}
          </div>
        </header>

        <section className="card">
          <div className="section-header">
            <div>
              <h2 className="section-title">
                Cash flow filters
              </h2>

              <p className="section-description">
                Select the reporting period and bank
                account to include.
              </p>
            </div>
          </div>

          <form
            method="get"
            className="ledger-filter-grid"
          >
            <label className="ledger-filter-field">
              <span>From</span>

              <input
                id="startDate"
                name="startDate"
                type="date"
                defaultValue={dateOnly(startDate)}
              />
            </label>

            <label className="ledger-filter-field">
              <span>To</span>

              <input
                id="endDate"
                name="endDate"
                type="date"
                defaultValue={dateOnly(endDate)}
              />
            </label>

            <label className="ledger-filter-field">
              <span>Bank account</span>

              <select
                id="bankAccountId"
                name="bankAccountId"
                defaultValue={bankAccountId}
              >
                <option value="">
                  All active accounts
                </option>

                {bankAccounts.map((account) => (
                  <option
                    key={account.id}
                    value={account.id}
                  >
                    {account.name}
                    {account.isTrust ? " — Trust" : ""}
                  </option>
                ))}
              </select>
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
                  href="/accounting/cash-flow"
                  className="secondary-button"
                >
                  Clear
                </Link>
              ) : null}
            </div>
          </form>
        </section>

        <section className="grid grid-4">
          <article className="card compact-card">
            <div className="metric-label">
              Opening cash
            </div>

            <div className="metric-value">
              {money(calculatedOpeningCash)}
            </div>

            <div className="metric-caption">
              Cash available at period start
            </div>
          </article>

          <article className="card compact-card">
            <div className="metric-label">
              Cash received
            </div>

            <div className="metric-value">
              {money(moneyIn)}
            </div>

            <div className="metric-caption">
              Credit transactions
            </div>
          </article>

          <article className="card compact-card">
            <div className="metric-label">
              Cash paid
            </div>

            <div className="metric-value">
              {money(moneyOut)}
            </div>

            <div className="metric-caption">
              Debit transactions
            </div>
          </article>

          <article className="card compact-card">
            <div className="metric-label">
              Closing cash
            </div>

            <div className="metric-value">
              {money(closingCash)}
            </div>

            <div className="metric-caption">
              Calculated period-end balance
            </div>
          </article>
        </section>

        <section className="grid grid-4">
          <article className="card compact-card">
            <div className="metric-label">
              Net cash movement
            </div>

            <div className="metric-value">
              {money(netCashMovement)}
            </div>

            <div className="metric-caption">
              Cash received less cash paid
            </div>
          </article>

          <article className="card compact-card">
            <div className="metric-label">
              Matched cash
            </div>

            <div className="metric-value">
              {money(matchedIn - matchedOut)}
            </div>

            <div className="metric-caption">
              Net movement from matched transactions
            </div>
          </article>

          <article className="card compact-card">
            <div className="metric-label">
              Unmatched transactions
            </div>

            <div className="metric-value">
              {unmatchedCount}
            </div>

            <div className="metric-caption">
              Transactions requiring matching
            </div>
          </article>

          <article className="card compact-card">
            <div className="metric-label">
              Transactions
            </div>

            <div className="metric-value">
              {transactions.length}
            </div>

            <div className="metric-caption">
              Included in selected period
            </div>
          </article>
        </section>

        <section className="card">
          <div className="section-header">
            <div>
              <div className="page-eyebrow">
                CASH FLOW SUMMARY
              </div>

              <h2 className="section-title">
                {selectedAccountNames}
              </h2>

              <p className="section-description">
                {dateOnly(startDate)} to {dateOnly(endDate)}
              </p>
            </div>
          </div>

          <div className="table-scroll">
            <table className="table">
              <thead>
                <tr>
                  <th>Cash flow item</th>
                  <th className="numeric">Amount</th>
                </tr>
              </thead>

              <tbody>
                <FlowRow
                  label="Opening cash balance"
                  amount={calculatedOpeningCash}
                />

                <FlowRow
                  label="Cash received"
                  amount={moneyIn}
                  positive
                />

                <FlowRow
                  label="Cash paid"
                  amount={-moneyOut}
                  negative
                />

                <FlowRow
                  label="Net cash movement"
                  amount={netCashMovement}
                  emphasized
                />

                <FlowRow
                  label="Closing cash balance"
                  amount={closingCash}
                  emphasized
                />
              </tbody>
            </table>
          </div>
        </section>

        <section className="card">
          <div className="section-header">
            <div>
              <h2 className="section-title">
                Cash transactions
              </h2>

              <p className="section-description">
                Transactions included in the selected
                cash flow period.
              </p>
            </div>

            <span className="metric-caption">
              {transactions.length} transaction
              {transactions.length === 1 ? "" : "s"}
            </span>
          </div>

          {transactions.length === 0 ? (
            <div className="empty-state">
              <div>
                <div className="empty-state-title">
                  No bank transactions found
                </div>

                <div className="empty-state-text">
                  No transactions were found for the
                  selected period.
                </div>
              </div>
            </div>
          ) : (
            <div className="table-scroll">
              <table className="table">
                <thead>
                  <tr>
                    <th className="date">Date</th>
                    <th>Description</th>
                    <th>Reference</th>
                    <th>Type</th>
                    <th className="numeric">Amount</th>
                    <th>Matching</th>
                  </tr>
                </thead>

                <tbody>
                  {transactions.map((transaction) => {
                    const amount = Number(
                      transaction.amount,
                    );

                    const isInflow =
                      transaction.type === "CREDIT";

                    return (
                      <tr key={transaction.id}>
                        <td className="date nowrap">
                          {dateOnly(
                            transaction.transactionDate,
                          )}
                        </td>

                        <td>
                          {transaction.description || "—"}
                        </td>

                        <td>
                          {transaction.reference || "—"}
                        </td>

                        <td>
                          <span
                            className={
                              isInflow
                                ? "ar-status ar-status-paid"
                                : "ar-status ar-status-overdue"
                            }
                          >
                            {isInflow ? "Cash In" : "Cash Out"}
                          </span>
                        </td>

                        <td
                          className={`numeric amount ${
                            isInflow
                              ? "text-emerald-300"
                              : "text-rose-300"
                          }`}
                        >
                          {isInflow ? "+" : "-"}
                          {money(amount)}
                        </td>

                        <td>
                          <span
                            className={
                              transaction.matched
                                ? "ar-status ar-status-paid"
                                : "ar-status ar-status-overdue"
                            }
                          >
                            {transaction.matched
                              ? "Matched"
                              : "Unmatched"}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="card compact-card">
          <div className="section-title">
            Reporting note
          </div>

          <p className="section-description">
            Cash flow is currently based on FirmLedger
            bank transactions. Classification into
            operating, investing and financing
            activities can be added as the transaction
            and ledger workflows become more detailed.
          </p>
        </section>
      </main>
    </WorkspaceShell>
  );
}

function FlowRow({
  label,
  amount,
  positive,
  negative,
  emphasized,
}: {
  label: string;
  amount: number;
  positive?: boolean;
  negative?: boolean;
  emphasized?: boolean;
}) {
  const valueClass = positive
    ? "text-emerald-300"
    : negative
      ? "text-rose-300"
      : emphasized
        ? "text-slate-100"
        : "text-slate-300";

  return (
    <tr>
      <td
        className={
          emphasized ? "font-semibold" : undefined
        }
      >
        {label}
      </td>

      <td
        className={`numeric amount ${valueClass} ${
          emphasized ? "font-semibold" : ""
        }`}
      >
        {money(amount)}
      </td>
    </tr>
  );
}