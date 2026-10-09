import Link from "next/link";
import { requireRole } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import WorkspaceShell from "@/app/workspace-shell";

export default async function Recurring() {
  const user = await requireRole([
    "OWNER",
    "ADMIN",
    "FINANCE",
    "LAWYER",
    "ACCOUNTANT",
  ]);

  const rows = await prisma.recurringInvoice.findMany({
    where: {
      firmId: user.firmId,
    },
    include: {
      client: true,
      matter: true,
    },
    orderBy: {
      nextRunDate: "asc",
    },
  });

  return (
    <WorkspaceShell user={user}>
      <div className="page">
        <div className="page-header">
          <div>
            <p className="metric-label">BILLING</p>

            <h1 className="page-title">Recurring billing</h1>

            <p className="page-subtitle">
              Manage scheduled invoices and upcoming billing dates.
            </p>
          </div>

          <Link
            href="/recurring/new"
            className="primary-button"
          >
            New recurring schedule
          </Link>
        </div>

        <section
          className="card"
          style={{ marginTop: 24 }}
        >
          <div className="section-header">
            <div>
              <h2 className="section-title">
                Recurring schedules
              </h2>

              <p className="page-subtitle">
                {rows.length}{" "}
                {rows.length === 1
                  ? "recurring schedule"
                  : "recurring schedules"}
              </p>
            </div>
          </div>

          {rows.length === 0 ? (
            <div className="empty-state">
              <p className="empty-state-title">
                No recurring billing schedules
              </p>

              <p className="empty-state-description">
                Create a schedule to see it listed here.
              </p>

              <div style={{ marginTop: 16 }}>
                <Link
                  href="/recurring/new"
                  className="primary-button"
                >
                  Create recurring schedule
                </Link>
              </div>
            </div>
          ) : (
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Client</th>
                    <th>Description</th>
                    <th>Frequency</th>
                    <th>Next run</th>
                    <th className="amount">Amount</th>
                    <th>Status</th>
                  </tr>
                </thead>

                <tbody>
                  {rows.map((recurring) => (
                    <tr key={recurring.id}>
                      <td>
                        <strong>
                          {recurring.client.displayName}
                        </strong>
                      </td>

                      <td>{recurring.description}</td>

                      <td>{recurring.frequency}</td>

                      <td>
                        {recurring.nextRunDate.toLocaleDateString(
                          "en-ZA"
                        )}
                      </td>

                      <td className="amount">
                        R{Number(recurring.subtotal).toFixed(2)} + VAT
                      </td>

                      <td>
                        <span className="badge">
                          {recurring.active ? "Active" : "Paused"}
                        </span>
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