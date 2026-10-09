import Link from "next/link";
import { requireUser } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import WorkspaceShell from "@/app/workspace-shell";

export default async function Expenses() {
  const user = await requireUser();

  const rows = await prisma.expense.findMany({
    where: {
      firmId: user.firmId,
    },
    include: {
      matter: true,
      client: true,
    },
    orderBy: {
      expenseDate: "desc",
    },
  });

  return (
    <WorkspaceShell user={user}>
      <div className="page">
        <div className="page-header">
          <div>
            <p className="metric-label">FINANCIAL MANAGEMENT</p>

            <h1 className="page-title">Expenses</h1>

            <p className="page-subtitle">
              View and manage your firm's recorded expenses.
            </p>
          </div>

          <Link
            href="/expenses/new"
            className="primary-button"
          >
            Record expense
          </Link>
        </div>

        <section
          className="card"
          style={{ marginTop: 24 }}
        >
          <div className="section-header">
            <div>
              <h2 className="section-title">
                Expense register
              </h2>

              <p className="page-subtitle">
                {rows.length}{" "}
                {rows.length === 1 ? "expense" : "expenses"} recorded
              </p>
            </div>
          </div>

          {rows.length === 0 ? (
            <div className="empty-state">
              <p className="empty-state-title">
                No expenses recorded
              </p>

              <p className="empty-state-description">
                Record an expense to see it listed here.
              </p>

              <div style={{ marginTop: 16 }}>
                <Link
                  href="/expenses/new"
                  className="primary-button"
                >
                  Record your first expense
                </Link>
              </div>
            </div>
          ) : (
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Description</th>
                    <th>Matter</th>
                    <th>Status</th>
                    <th className="amount">Amount</th>
                  </tr>
                </thead>

                <tbody>
                  {rows.map((expense) => (
                    <tr key={expense.id}>
                      <td>
                        {expense.expenseDate.toLocaleDateString(
                          "en-ZA"
                        )}
                      </td>

                      <td>{expense.description}</td>

                      <td>
                        {expense.matter?.matterNumber ?? "—"}
                      </td>

                      <td>
                        <span className="badge">
                          {expense.status}
                        </span>
                      </td>

                      <td className="amount">
                        R{Number(expense.amount).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </WorkspaceShell>
  );
}