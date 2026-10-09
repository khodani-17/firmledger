
import Link from "next/link";
import { requireRole } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import WorkspaceShell from "@/app/workspace-shell";

type SearchParams = {
  accountId?: string;
  status?: string;
};

type TransactionRow = {
  id: string;
  transactionDate: Date;
  type: "DEBIT" | "CREDIT";
  amount: number;
  description: string | null;
  reference: string | null;
  matched: boolean;
};

function money(amount: number, currency = "ZAR") {
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(amount);
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-ZA", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function decimal(value: unknown) {
  return Number(value ?? 0);
}

function statusLabel(status: string) {
  switch (status) {
    case "RECONCILED":
      return "Reconciled";
    case "OUT_OF_BALANCE":
      return "Out of balance";
    default:
      return "In progress";
  }
}

export default async function BankReconciliationPage({
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
  const accountId = params.accountId ?? "";
  const requestedStatus = params.status ?? "ALL";

  const accounts = await prisma.bankAccount.findMany({
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
      accountNumber: true,
      currency: true,
      openingBalance: true,
    },
  });

  const selectedAccount =
    accounts.find((account) => account.id === accountId) ??
    accounts[0] ??
    null;

  const selectedAccountId = selectedAccount?.id ?? "";

  const allTransactions = selectedAccountId
    ? await prisma.bankTransaction.findMany({
        where: {
          firmId: user.firmId,
          bankAccountId: selectedAccountId,
        },
        orderBy: [
          { transactionDate: "desc" },
          { createdAt: "desc" },
        ],
        select: {
          id: true,
          transactionDate: true,
          type: true,
          amount: true,
          description: true,
          reference: true,
          matched: true,
        },
      })
    : [];

  const transactions: TransactionRow[] = allTransactions.map(
    (transaction) => ({
      id: transaction.id,
      transactionDate: transaction.transactionDate,
      type: transaction.type,
      amount: decimal(transaction.amount),
      description: transaction.description,
      reference: transaction.reference,
      matched: transaction.matched,
    }),
  );

  const openingBalance = decimal(selectedAccount?.openingBalance);

  const totalCredits = transactions
    .filter((transaction) => transaction.type === "CREDIT")
    .reduce((sum, transaction) => sum + transaction.amount, 0);

  const totalDebits = transactions
    .filter((transaction) => transaction.type === "DEBIT")
    .reduce((sum, transaction) => sum + transaction.amount, 0);

  const ledgerBalance = openingBalance + totalCredits - totalDebits;

  const matchedCount = transactions.filter(
    (transaction) => transaction.matched,
  ).length;

  const unmatchedCount = transactions.length - matchedCount;

  const matchedCredits = transactions
    .filter(
      (transaction) =>
        transaction.matched && transaction.type === "CREDIT",
    )
    .reduce((sum, transaction) => sum + transaction.amount, 0);

  const matchedDebits = transactions
    .filter(
      (transaction) =>
        transaction.matched && transaction.type === "DEBIT",
    )
    .reduce((sum, transaction) => sum + transaction.amount, 0);

  const reconciledBalance =
    openingBalance + matchedCredits - matchedDebits;

  const difference = ledgerBalance - reconciledBalance;

  let filteredTransactions = transactions;

  if (requestedStatus === "MATCHED") {
    filteredTransactions = transactions.filter(
      (transaction) => transaction.matched,
    );
  }

  if (requestedStatus === "UNMATCHED") {
    filteredTransactions = transactions.filter(
      (transaction) => !transaction.matched,
    );
  }

  const isReconciled =
    transactions.length > 0 &&
    unmatchedCount === 0 &&
    Math.abs(difference) < 0.01;

  const reconciliationStatus = isReconciled
    ? "RECONCILED"
    : unmatchedCount > 0
      ? "IN_PROGRESS"
      : "OUT_OF_BALANCE";

  return (
    <WorkspaceShell user={user}>
      <main className="page">
        <div className="page-header">
          <div>
            <div className="page-eyebrow">ACCOUNTING</div>
            <h1 className="page-title">Bank Reconciliation</h1>
            <p className="page-subtitle">
              Compare bank transactions with the FirmLedger bank
              ledger and identify outstanding items.
            </p>
          </div>

          <div className="page-actions">
            <Link
              href="/accounting/cash-bank"
              className="secondary-button"
            >
              Cash &amp; Bank
            </Link>
          </div>
        </div>

        <section className="card compact-card">
          <div className="section-header">
            <div>
              <div className="section-title">
                Reconciliation filters
              </div>
              <div className="section-description">
                Select a bank account and transaction matching status.
              </div>
            </div>

            {selectedAccount ? (
              <span className="status-badge">
                {selectedAccount.name}
              </span>
            ) : null}
          </div>

          <form method="get" className="ledger-filter-grid">
            <label className="ledger-filter-field">
              <span>Bank account</span>
              <select
                id="accountId"
                name="accountId"
                defaultValue={selectedAccountId}
              >
                {accounts.length === 0 ? (
                  <option value="">No bank accounts</option>
                ) : (
                  accounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name}
                      {account.bankName ? ` — ${account.bankName}` : ""}
                    </option>
                  ))
                )}
              </select>
            </label>

            <label className="ledger-filter-field">
              <span>Transactions</span>
              <select
                id="status"
                name="status"
                defaultValue={requestedStatus}
              >
                <option value="ALL">All transactions</option>
                <option value="MATCHED">Matched</option>
                <option value="UNMATCHED">Unmatched</option>
              </select>
            </label>

            <div className="ledger-filter-actions">
              <button type="submit" className="primary-button">
                Apply
              </button>
            </div>
          </form>
        </section>

        {!selectedAccount ? (
          <section className="card compact-card">
            <div className="empty-state">
              <div className="empty-state-title">
                No bank account available
              </div>
              <div className="empty-state-text">
                Create a bank account in Cash &amp; Bank before
                starting a reconciliation.
              </div>
              <div className="page-actions">
                <Link
                  href="/accounting/cash-bank"
                  className="secondary-button"
                >
                  Go to Cash &amp; Bank
                </Link>
              </div>
            </div>
          </section>
        ) : (
          <>
            <div className="grid grid-4 compact-grid">
              <div className="card compact-card">
                <div className="metric-label">Ledger balance</div>
                <div className="metric-value metric-amount">
                  {money(ledgerBalance, selectedAccount.currency ?? "ZAR")}
                </div>
                <div className="metric-caption">
                  Current calculated balance
                </div>
              </div>

              <div className="card compact-card">
                <div className="metric-label">Matched balance</div>
                <div className="metric-value metric-amount">
                  {money(
                    reconciledBalance,
                    selectedAccount.currency ?? "ZAR",
                  )}
                </div>
                <div className="metric-caption">
                  Balance from matched transactions
                </div>
              </div>

              <div className="card compact-card">
                <div className="metric-label">
                  Unmatched transactions
                </div>
                <div className="metric-value">
                  {unmatchedCount.toLocaleString("en-ZA")}
                </div>
                <div className="metric-caption">
                  Transactions requiring review
                </div>
              </div>

              <div className="card compact-card">
                <div className="metric-label">Difference</div>
                <div
                  className={
                    Math.abs(difference) < 0.01
                      ? "metric-value metric-amount status-text-success"
                      : "metric-value metric-amount status-text-danger"
                  }
                >
                  {money(
                    Math.abs(difference),
                    selectedAccount.currency ?? "ZAR",
                  )}
                </div>
                <div className="metric-caption">
                  Ledger less reconciled balance
                </div>
              </div>
            </div>

            <div className="grid grid-3 compact-grid">
              <div className="card compact-card">
                <div className="metric-label">Opening balance</div>
                <div className="metric-value metric-amount">
                  {money(openingBalance, selectedAccount.currency ?? "ZAR")}
                </div>
              </div>

              <div className="card compact-card">
                <div className="metric-label">Money in</div>
                <div className="metric-value metric-amount">
                  {money(totalCredits, selectedAccount.currency ?? "ZAR")}
                </div>
              </div>

              <div className="card compact-card">
                <div className="metric-label">Money out</div>
                <div className="metric-value metric-amount">
                  {money(totalDebits, selectedAccount.currency ?? "ZAR")}
                </div>
              </div>
            </div>

            <section className="card compact-card">
              <div className="section-header">
                <div>
                  <div className="section-title">
                    Reconciliation status
                  </div>
                  <div className="section-description">
                    {matchedCount} of {transactions.length} transactions
                    matched.
                  </div>
                </div>
                <StatusBadge status={reconciliationStatus} />
              </div>

              <div className="ledger-footer">
                <span>Account: {selectedAccount.name}</span>
                {selectedAccount.accountNumber ? (
                  <>
                    <span>•</span>
                    <span>
                      {maskAccountNumber(selectedAccount.accountNumber)}
                    </span>
                  </>
                ) : null}
              </div>
            </section>

            {reconciliationStatus === "OUT_OF_BALANCE" && (
              <section className="card compact-card">
                <div className="section-title">
                  Reconciliation requires attention
                </div>
                <div className="section-description">
                  All transactions are matched, but the reconciliation
                  difference is not zero. Review the opening balance and
                  bank transactions before treating the account as reconciled.
                </div>
              </section>
            )}

            {reconciliationStatus === "IN_PROGRESS" && (
              <section className="card compact-card">
                <div className="section-title">
                  Reconciliation in progress
                </div>
                <div className="section-description">
                  There are still unmatched bank transactions requiring review.
                </div>
              </section>
            )}

            {reconciliationStatus === "RECONCILED" && (
              <section className="card compact-card">
                <div className="section-title">Account is reconciled</div>
                <div className="section-description">
                  All current bank transactions are matched and the
                  reconciliation difference is zero.
                </div>
              </section>
            )}

            <section className="card compact-card">
              <div className="section-header">
                <div>
                  <div className="section-title">Bank transactions</div>
                  <div className="section-description">
                    {filteredTransactions.length.toLocaleString("en-ZA")}{" "}
                    transaction
                    {filteredTransactions.length === 1 ? "" : "s"} shown.
                  </div>
                </div>
                <div className="status-badge">
                  Matched {matchedCount} • Unmatched {unmatchedCount}
                </div>
              </div>

              {filteredTransactions.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-state-title">
                    No transactions found
                  </div>
                  <div className="empty-state-text">
                    There are no transactions matching the current filters.
                  </div>
                </div>
              ) : (
                <div className="table-scroll">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Description</th>
                        <th>Reference</th>
                        <th>Type</th>
                        <th className="numeric">Amount</th>
                        <th className="numeric">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredTransactions.map((transaction) => (
                        <tr key={transaction.id}>
                          <td className="date nowrap">
                            {formatDate(transaction.transactionDate)}
                          </td>
                          <td>
                            <div className="table-primary-text">
                              {transaction.description || "—"}
                            </div>
                          </td>
                          <td className="table-secondary-text">
                            {transaction.reference || "—"}
                          </td>
                          <td>
                            <span
                              className={
                                transaction.type === "CREDIT"
                                  ? "status-text-success"
                                  : "status-text-danger"
                              }
                            >
                              {transaction.type === "CREDIT"
                                ? "Credit"
                                : "Debit"}
                            </span>
                          </td>
                          <td className="numeric amount nowrap">
                            {money(
                              transaction.amount,
                              selectedAccount.currency ?? "ZAR",
                            )}
                          </td>
                          <td className="numeric">
                            <MatchBadge matched={transaction.matched} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <div className="section-description">
              Reconciliation currently uses the bank transaction matching
              status already stored in FirmLedger. A dedicated reconciliation
              record and statement-import workflow can be added later without
              changing this screen&apos;s core calculations.
            </div>
          </>
        )}
      </main>
    </WorkspaceShell>
  );
}

function StatusBadge({ status }: { status: string }) {
  const statusClass =
    status === "RECONCILED"
      ? "status-success"
      : status === "OUT_OF_BALANCE"
        ? "status-warning"
        : "";

  return (
    <span className={`status-badge ${statusClass}`.trim()}>
      {statusLabel(status)}
    </span>
  );
}

function MatchBadge({ matched }: { matched: boolean }) {
  return (
    <span
      className={
        matched
          ? "status-badge status-success"
          : "status-badge status-warning"
      }
    >
      {matched ? "Matched" : "Unmatched"}
    </span>
  );
}

function maskAccountNumber(accountNumber: string) {
  if (accountNumber.length <= 4) {
    return accountNumber;
  }

  return `${"•".repeat(Math.max(0, accountNumber.length - 4))}${accountNumber.slice(-4)}`;
}