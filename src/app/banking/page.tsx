
import Link from "next/link";
import { requireUser } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import WorkspaceShell from "@/app/workspace-shell";

export default async function Page() {
  const user = await requireUser();

  const accounts = await prisma.bankAccount.findMany({
    where: {
      firmId: user.firmId,
    },
    include: {
      transactions: {
        orderBy: {
          transactionDate: "desc",
        },
        take: 20,
      },
    },
    orderBy: {
      name: "asc",
    },
  });

  return (
    <WorkspaceShell user={user}>
      <div className="page">
        <div className="page-header">
          <div>
            <h1 className="page-title">Banking</h1>
            <p className="page-subtitle">
              Bank accounts and system-generated receipts.
            </p>
          </div>

          <div className="page-actions">
            <Link className="secondary-button" href="/banking/new">
              Add bank
            </Link>

            <Link className="primary-button" href="/payments/new">
              Record payment
            </Link>
          </div>
        </div>

        {accounts.length > 0 ? (
          accounts.map((account) => (
            <div
              className="card"
              style={{ marginTop: 20 }}
              key={account.id}
            >
              <div className="section-header">
                <div className="section-title">
                  {account.name}
                  {account.bankName ? ` · ${account.bankName}` : ""}
                </div>

                <Link
                  className="secondary-button"
                  href="/banking/reconciliation"
                >
                  Reconciliation
                </Link>
              </div>

              {account.transactions.length > 0 ? (
                <div className="table-scroll">
                  <table className="table">
                    <thead>
                      <tr>
                        <th className="date">Date</th>
                        <th>Description</th>
                        <th>Reference</th>
                        <th>Type</th>
                        <th className="amount">Amount</th>
                        <th>Match</th>
                      </tr>
                    </thead>

                    <tbody>
                      {account.transactions.map((transaction) => (
                        <tr key={transaction.id}>
                          <td className="date">
                            {transaction.transactionDate.toLocaleDateString(
                              "en-ZA"
                            )}
                          </td>

                          <td>{transaction.description}</td>

                          <td>{transaction.reference || "—"}</td>

                          <td>{transaction.type}</td>

                          <td className="amount">
                            R{Number(transaction.amount).toFixed(2)}
                          </td>

                          <td>
                            <span className="badge">
                              {transaction.matched
                                ? "Matched"
                                : "Unmatched"}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="empty-state">
                  No transactions have been recorded for this account.
                </div>
              )}
            </div>
          ))
        ) : (
          <div className="card empty-state" style={{ marginTop: 20 }}>
            <div className="empty-state-title">
              No bank accounts yet
            </div>

            <p className="page-subtitle">
              Add a bank account to start viewing its transactions.
            </p>

            <div style={{ marginTop: 14 }}>
              <Link className="primary-button" href="/banking/new">
                Add bank account
              </Link>
            </div>
          </div>
        )}
      </div>
    </WorkspaceShell>
  );
}