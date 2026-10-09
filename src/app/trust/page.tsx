import Link from "next/link";
import { requireRole } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import WorkspaceShell from "@/app/workspace-shell";

function clientName(client: {
  displayName: string | null;
  companyName: string | null;
  name: string | null;
  surname: string | null;
}) {
  return (
    client.displayName ||
    client.companyName ||
    [client.name, client.surname].filter(Boolean).join(" ") ||
    "Unallocated"
  );
}

function transactionEffect(type: string) {
  switch (type) {
    case "RECEIPT":
    case "INTEREST":
    case "REVERSAL":
      return 1;
    case "PAYMENT":
    case "REFUND":
    case "FEE":
      return -1;
    case "TRANSFER":
    case "ADJUSTMENT":
    default:
      return 0;
  }
}

function money(value: number) {
  return `R ${value.toLocaleString("en-ZA", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export default async function Trust() {
  const user = await requireRole([
    "OWNER",
    "ADMIN",
    "FINANCE",
    "ACCOUNTANT",
  ]);

  const [accounts, transactions, reconciliations] = await Promise.all([
    prisma.trustAccount.findMany({
      where: { firmId: user.firmId },
      orderBy: { name: "asc" },
    }),

    prisma.trustTransaction.findMany({
      where: {
        firmId: user.firmId,
        status: "POSTED",
      },
      include: {
        client: {
          select: {
            displayName: true,
            companyName: true,
            name: true,
            surname: true,
          },
        },
        matter: {
          select: {
            matterNumber: true,
            title: true,
          },
        },
        trustAccount: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { transactionDate: "desc" },
    }),

    prisma.trustReconciliation.findMany({
      where: { firmId: user.firmId },
      include: {
        trustAccount: {
          select: { name: true },
        },
      },
      orderBy: { reconciliationDate: "desc" },
      take: 10,
    }),
  ]);

  const accountBalances = accounts.map((account) => {
    const accountTransactions = transactions.filter(
      (transaction) => transaction.trustAccountId === account.id
    );

    const balance = accountTransactions.reduce(
      (sum, transaction) =>
        sum +
        Number(transaction.amount) * transactionEffect(transaction.type),
      0
    );

    return {
      ...account,
      balance,
      transactionCount: accountTransactions.length,
    };
  });

  const totalTrustBalance = accountBalances.reduce(
    (sum, account) => sum + account.balance,
    0
  );

  const clientMap = new Map<string, { name: string; balance: number }>();

  for (const transaction of transactions) {
    const key =
      transaction.client?.displayName ||
      transaction.client?.companyName ||
      transaction.client?.name ||
      transaction.client?.surname ||
      "unallocated";

    const name = clientName(
      transaction.client ?? {
        displayName: null,
        companyName: null,
        name: null,
        surname: null,
      }
    );

    const current = clientMap.get(key) ?? { name, balance: 0 };

    current.balance +=
      Number(transaction.amount) * transactionEffect(transaction.type);

    clientMap.set(key, current);
  }

  const clientBalances = Array.from(clientMap.values())
    .filter((client) => Math.abs(client.balance) > 0.009)
    .sort((a, b) => b.balance - a.balance);

  const postedCount = transactions.length;

  const openReconciliations = reconciliations.filter(
    (reconciliation) =>
      reconciliation.status === "OPEN" ||
      reconciliation.status === "IN_PROGRESS"
  ).length;

  return (
    <WorkspaceShell user={user}>
      <main className="page">
        <div className="page-header">
          <div>
            <h1 className="page-title">Trust Accounting</h1>
            <p className="page-subtitle">
              Monitor trust accounts, client balances and reconciliations.
            </p>
          </div>

          <div className="page-actions">
            <Link
              href="/trust/reconciliation"
              className="button-secondary"
            >
              Reconcile
            </Link>
            <Link href="/trust/new" className="button-primary">
              New Transaction
            </Link>
          </div>
        </div>

        <section className="grid grid-4 compact-grid">
          <div className="card compact-card">
            <div className="metric-label">Trust Balance</div>
            <div className="metric-value">
              {money(totalTrustBalance)}
            </div>
          </div>

          <div className="card compact-card">
            <div className="metric-label">Trust Accounts</div>
            <div className="metric-value">{accounts.length}</div>
          </div>

          <div className="card compact-card">
            <div className="metric-label">Posted Transactions</div>
            <div className="metric-value">{postedCount}</div>
          </div>

          <div className="card compact-card">
            <div className="metric-label">Open Reconciliations</div>
            <div className="metric-value">{openReconciliations}</div>
          </div>
        </section>

        <section className="card compact-card">
          <div className="section-heading">
            <h2 className="section-title">Trust Bank Accounts</h2>
            <span className="muted">
              {accountBalances.length}{" "}
              {accountBalances.length === 1 ? "account" : "accounts"}
            </span>
          </div>

          {accountBalances.length === 0 ? (
            <div className="empty-state">
              <p>No trust accounts</p>
              <span>
                Create a trust account to begin recording trust transactions.
              </span>
            </div>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Account</th>
                    <th>Bank</th>
                    <th>Currency</th>
                    <th className="text-right">Transactions</th>
                    <th className="text-right">Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {accountBalances.map((account) => (
                    <tr key={account.id}>
                      <td className="font-medium">{account.name}</td>
                      <td>{account.bankName || "—"}</td>
                      <td>{account.currency}</td>
                      <td className="text-right tabular-nums">
                        {account.transactionCount}
                      </td>
                      <td className="text-right tabular-nums font-medium">
                        {money(account.balance)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="card compact-card">
          <div className="section-heading">
            <h2 className="section-title">Client Trust Balances</h2>
            <span className="muted">
              {clientBalances.length}{" "}
              {clientBalances.length === 1 ? "client" : "clients"}
            </span>
          </div>

          {clientBalances.length === 0 ? (
            <div className="empty-state">
              <p>No client trust balances</p>
            </div>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Client</th>
                    <th className="text-right">Trust Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {clientBalances.map((client) => (
                    <tr key={client.name}>
                      <td className="font-medium">{client.name}</td>
                      <td className="text-right tabular-nums font-medium">
                        {money(client.balance)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="card compact-card">
          <div className="section-heading">
            <h2 className="section-title">Recent Trust Transactions</h2>
            <Link href="/trust/new" className="text-link">
              Record Transaction →
            </Link>
          </div>

          {transactions.length === 0 ? (
            <div className="empty-state">
              <p>No posted trust transactions</p>
            </div>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Account</th>
                    <th>Client</th>
                    <th>Matter</th>
                    <th>Type</th>
                    <th>Reference</th>
                    <th className="text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.slice(0, 25).map((transaction) => (
                    <tr key={transaction.id}>
                      <td>
                        {new Date(
                          transaction.transactionDate
                        ).toLocaleDateString("en-ZA")}
                      </td>
                      <td>{transaction.trustAccount.name}</td>
                      <td>
                        {clientName(
                          transaction.client ?? {
                            displayName: null,
                            companyName: null,
                            name: null,
                            surname: null,
                          }
                        )}
                      </td>
                      <td>
                        {transaction.matter
                          ? `${transaction.matter.matterNumber} — ${transaction.matter.title}`
                          : "—"}
                      </td>
                      <td>
                        <span className="badge">{transaction.type}</span>
                      </td>
                      <td>{transaction.reference || "—"}</td>
                      <td className="text-right tabular-nums font-medium">
                        {money(Number(transaction.amount))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="card compact-card">
          <div className="section-heading">
            <h2 className="section-title">Recent Reconciliations</h2>
            <Link href="/trust/reconciliation" className="text-link">
              View Reconciliations →
            </Link>
          </div>

          {reconciliations.length === 0 ? (
            <div className="empty-state">
              <p>No trust reconciliations</p>
            </div>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Account</th>
                    <th className="text-right">Statement</th>
                    <th className="text-right">Ledger</th>
                    <th className="text-right">Difference</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {reconciliations.map((reconciliation) => (
                    <tr key={reconciliation.id}>
                      <td>
                        {new Date(
                          reconciliation.reconciliationDate
                        ).toLocaleDateString("en-ZA")}
                      </td>
                      <td>{reconciliation.trustAccount.name}</td>
                      <td className="text-right tabular-nums">
                        {money(Number(reconciliation.statementBalance))}
                      </td>
                      <td className="text-right tabular-nums">
                        {money(Number(reconciliation.ledgerBalance))}
                      </td>
                      <td className="text-right tabular-nums font-medium">
                        {money(Number(reconciliation.difference))}
                      </td>
                      <td>
                        <span className="badge">
                          {reconciliation.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </WorkspaceShell>
  );
}