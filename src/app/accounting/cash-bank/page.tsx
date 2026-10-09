
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/permissions";
import WorkspaceShell from "@/app/workspace-shell";

type SearchParams = {
  account?: string;
  type?: string;
  matched?: string;
};

const transactionTypes = ["CREDIT", "DEBIT"] as const;

function money(value: number, currency = "ZAR") {
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency,
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

function transactionTypeLabel(type: string) {
  return type === "CREDIT" ? "Credit" : "Debit";
}

function transactionTypeClass(type: string) {
  return type === "CREDIT"
    ? "ar-status ar-status-paid"
    : "ar-status ar-status-overdue";
}

function maskAccountNumber(accountNumber: string | null) {
  if (!accountNumber) {
    return "No account number";
  }

  if (accountNumber.length <= 4) {
    return accountNumber;
  }

  return `•••• ${accountNumber.slice(-4)}`;
}

export default async function CashBankPage({
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
  const type = params.type || "";
  const matched = params.matched || "";

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
      accountType: true,
      currency: true,
      openingBalance: true,
      isTrust: true,
    },
  });

  const transactions = await prisma.bankTransaction.findMany({
    where: {
      firmId: user.firmId,
      ...(accountId
        ? {
            bankAccountId: accountId,
          }
        : {}),
      ...(type
        ? {
            type: type as (typeof transactionTypes)[number],
          }
        : {}),
      ...(matched === "true"
        ? { matched: true }
        : matched === "false"
          ? { matched: false }
          : {}),
    },
    orderBy: [
      {
        transactionDate: "desc",
      },
      {
        createdAt: "desc",
      },
    ],
    select: {
      id: true,
      bankAccountId: true,
      paymentId: true,
      transactionDate: true,
      type: true,
      amount: true,
      description: true,
      reference: true,
      matched: true,
    },
  });

  const accountIds = [
    ...new Set(
      transactions.map(
        (transaction) => transaction.bankAccountId,
      ),
    ),
  ];

  const transactionAccounts =
    accountIds.length > 0
      ? await prisma.bankAccount.findMany({
          where: {
            firmId: user.firmId,
            id: {
              in: accountIds,
            },
          },
          select: {
            id: true,
            name: true,
            bankName: true,
            currency: true,
          },
        })
      : [];

  const accountMap = new Map(
    transactionAccounts.map((account) => [
      account.id,
      account,
    ]),
  );

  const selectedAccount = accountId
    ? accounts.find((account) => account.id === accountId) ?? null
    : null;

  const accountBalances = accounts.map((account) => {
    const openingBalance = Number(account.openingBalance ?? 0);

    const accountTransactions = transactions.filter(
      (transaction) =>
        transaction.bankAccountId === account.id,
    );

    const credits = accountTransactions
      .filter((transaction) => transaction.type === "CREDIT")
      .reduce(
        (sum, transaction) => sum + Number(transaction.amount),
        0,
      );

    const debits = accountTransactions
      .filter((transaction) => transaction.type === "DEBIT")
      .reduce(
        (sum, transaction) => sum + Number(transaction.amount),
        0,
      );

    return {
      id: account.id,
      name: account.name,
      bankName: account.bankName,
      accountNumber: account.accountNumber,
      accountType: account.accountType,
      currency: account.currency,
      openingBalance,
      credits,
      debits,
      balance: openingBalance + credits - debits,
      isTrust: account.isTrust,
    };
  });

  const totalOpeningBalance = accountBalances.reduce(
    (sum, account) => sum + account.openingBalance,
    0,
  );

  const totalCredits = transactions
    .filter((transaction) => transaction.type === "CREDIT")
    .reduce(
      (sum, transaction) => sum + Number(transaction.amount),
      0,
    );

  const totalDebits = transactions
    .filter((transaction) => transaction.type === "DEBIT")
    .reduce(
      (sum, transaction) => sum + Number(transaction.amount),
      0,
    );

  const totalBalance = selectedAccount
    ? (() => {
        const account = accountBalances.find(
          (item) => item.id === selectedAccount.id,
        );

        return account?.balance ?? 0;
      })()
    : totalOpeningBalance + totalCredits - totalDebits;

  const unmatchedCount = transactions.filter(
    (transaction) => !transaction.matched,
  ).length;

  const unmatchedAmount = transactions
    .filter((transaction) => !transaction.matched)
    .reduce(
      (sum, transaction) => sum + Number(transaction.amount),
      0,
    );

  const hasFilters =
    Boolean(accountId) ||
    Boolean(type) ||
    Boolean(matched);

  return (
    <WorkspaceShell user={user}>
      <main className="page">
        <header className="page-header">
          <div>
            <div className="page-eyebrow">ACCOUNTING</div>
            <h1 className="page-title">Cash &amp; Bank</h1>
            <p className="page-subtitle">
              Monitor bank accounts, cash movements and
              unreconciled transactions.
            </p>
          </div>

          <div className="page-actions">
            <span className="status-badge">Bank &amp; cash</span>
            {hasFilters ? (
              <span className="status-badge">Filters applied</span>
            ) : null}
          </div>
        </header>

        <section className="card compact-card">
          <div className="section-header">
            <div>
              <h2 className="section-title">Bank filters</h2>
              <p className="section-description">
                Filter transactions by account, type or
                reconciliation status.
              </p>
            </div>
          </div>

          <form method="get" className="ledger-filter-grid">
            <label className="ledger-filter-field">
              <span>Bank account</span>
              <select name="account" defaultValue={accountId}>
                <option value="">All accounts</option>
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name}
                    {account.bankName ? ` — ${account.bankName}` : ""}
                    {account.isTrust ? " — Trust" : ""}
                  </option>
                ))}
              </select>
            </label>

            <label className="ledger-filter-field">
              <span>Transaction type</span>
              <select name="type" defaultValue={type}>
                <option value="">All transactions</option>
                {transactionTypes.map((transactionType) => (
                  <option
                    key={transactionType}
                    value={transactionType}
                  >
                    {transactionTypeLabel(transactionType)}
                  </option>
                ))}
              </select>
            </label>

            <label className="ledger-filter-field">
              <span>Reconciliation</span>
              <select name="matched" defaultValue={matched}>
                <option value="">All transactions</option>
                <option value="true">Matched</option>
                <option value="false">Unmatched</option>
              </select>
            </label>

            <div className="ledger-filter-actions">
              <button type="submit" className="primary-button">
                Apply filters
              </button>
              {hasFilters ? (
                <Link
                  href="/accounting/cash-bank"
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
            <div className="metric-label">Bank balance</div>
            <div className="metric-value metric-amount">
              {money(totalBalance, selectedAccount?.currency ?? "ZAR")}
            </div>
            <div className="metric-caption">
              {selectedAccount
                ? selectedAccount.name
                : "All active bank accounts"}
            </div>
          </article>

          <article className="card compact-card">
            <div className="metric-label">Money in</div>
            <div className="metric-value metric-amount">
              {money(totalCredits)}
            </div>
            <div className="metric-caption">Credit transactions</div>
          </article>

          <article className="card compact-card">
            <div className="metric-label">Money out</div>
            <div className="metric-value metric-amount">
              {money(totalDebits)}
            </div>
            <div className="metric-caption">Debit transactions</div>
          </article>

          <article className="card compact-card">
            <div className="metric-label">Unmatched</div>
            <div className="metric-value">
              {unmatchedCount.toLocaleString("en-ZA")}
            </div>
            <div className="metric-caption">
              {money(unmatchedAmount)} awaiting matching
            </div>
          </article>
        </section>

        <section className="card compact-card">
          <div className="section-header">
            <div>
              <h2 className="section-title">Bank accounts</h2>
              <p className="section-description">
                Current balances calculated from opening balances
                and recorded transactions.
              </p>
            </div>
          </div>

          <div className="table-scroll">
            <table className="table">
              <thead>
                <tr>
                  <th>Account</th>
                  <th>Bank</th>
                  <th>Account number</th>
                  <th>Type</th>
                  <th className="numeric">Opening</th>
                  <th className="numeric">Money in</th>
                  <th className="numeric">Money out</th>
                  <th className="numeric">Balance</th>
                </tr>
              </thead>
              <tbody>
                {accountBalances.length > 0 ? (
                  accountBalances.map((account) => (
                    <tr key={account.id}>
                      <td>
                        <div className="nowrap">{account.name}</div>
                        {account.isTrust ? (
                          <small>Trust account</small>
                        ) : null}
                      </td>
                      <td>{account.bankName || "—"}</td>
                      <td className="nowrap">
                        {maskAccountNumber(account.accountNumber)}
                      </td>
                      <td>{account.accountType || "—"}</td>
                      <td className="numeric amount">
                        {money(account.openingBalance, account.currency)}
                      </td>
                      <td className="numeric amount">
                        {money(account.credits, account.currency)}
                      </td>
                      <td className="numeric amount">
                        {money(account.debits, account.currency)}
                      </td>
                      <td className="numeric amount">
                        <strong>
                          {money(account.balance, account.currency)}
                        </strong>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={8} className="empty-state">
                      <div>
                        <div className="empty-state-title">
                          No bank accounts found
                        </div>
                        <div className="empty-state-text">
                          Create an active bank account to begin
                          tracking cash movements.
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="card compact-card">
          <div className="section-header">
            <div>
              <h2 className="section-title">Bank transactions</h2>
              <p className="section-description">
                Recorded movements for the selected filters.
              </p>
            </div>
            <div className="metric-caption">
              {transactions.length} transaction
              {transactions.length === 1 ? "" : "s"}
            </div>
          </div>

          <div className="table-scroll">
            <table className="table">
              <thead>
                <tr>
                  <th className="date">Date</th>
                  <th>Account</th>
                  <th>Type</th>
                  <th>Description</th>
                  <th>Reference</th>
                  <th>Matching</th>
                  <th className="numeric">Amount</th>
                </tr>
              </thead>
              <tbody>
                {transactions.length > 0 ? (
                  transactions.map((transaction) => {
                    const account = accountMap.get(
                      transaction.bankAccountId,
                    );

                    return (
                      <tr key={transaction.id}>
                        <td className="date nowrap">
                          {formatDate(transaction.transactionDate)}
                        </td>
                        <td>{account?.name || "Unknown account"}</td>
                        <td>
                          <span
                            className={transactionTypeClass(
                              transaction.type,
                            )}
                          >
                            {transactionTypeLabel(transaction.type)}
                          </span>
                        </td>
                        <td>{transaction.description || "—"}</td>
                        <td>{transaction.reference || "—"}</td>
                        <td>
                          <span
                            className={
                              transaction.matched
                                ? "ar-status ar-status-paid"
                                : "ar-status ar-status-overdue"
                            }
                          >
                            {transaction.matched ? "Matched" : "Unmatched"}
                          </span>
                        </td>
                        <td className="numeric amount">
                          {money(
                            Number(transaction.amount),
                            account?.currency ?? "ZAR",
                          )}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={7} className="empty-state">
                      <div>
                        <div className="empty-state-title">
                          No bank transactions found
                        </div>
                        <div className="empty-state-text">
                          No transactions match the selected filters.
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="ledger-footer">
            <span>
              {transactions.length} transaction
              {transactions.length === 1 ? "" : "s"}
            </span>
            <span>•</span>
            <span>Money in {money(totalCredits)}</span>
            <span>•</span>
            <span>Money out {money(totalDebits)}</span>
            <span>•</span>
            <span>{unmatchedCount} unmatched</span>
          </div>
        </section>
      </main>
    </WorkspaceShell>
  );
}