import Link from "next/link";
import { requireRole } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import WorkspaceShell from "@/app/workspace-shell";

export default async function CreditNotesPage() {
  const user = await requireRole([
    "OWNER",
    "ADMIN",
    "FINANCE",
    "ACCOUNTANT",
  ]);

  const creditNotes = await prisma.creditNote.findMany({
    where: {
      firmId: user.firmId,
    },
    include: {
      client: true,
    },
    orderBy: {
      issueDate: "desc",
    },
  });

  return (
    <WorkspaceShell user={user}>
      <div className="page">
        <div className="page-header">
          <div>
            <p className="metric-label">BILLING</p>

            <h1 className="page-title">Credit notes</h1>

            <p className="page-subtitle">
              Credit and adjust client invoices with an auditable record.
            </p>
          </div>

          <Link
            className="primary-button"
            href="/credit-notes/new"
          >
            + New credit note
          </Link>
        </div>

        <section
          className="card"
          style={{
            marginTop: 24,
          }}
        >
          <div className="section-header">
            <h2 className="section-title">
              Credit note register
            </h2>

            <span className="metric-label">
              {creditNotes.length}{" "}
              {creditNotes.length === 1
                ? "CREDIT NOTE"
                : "CREDIT NOTES"}
            </span>
          </div>

          {creditNotes.length === 0 ? (
            <div
              style={{
                padding: "40px 16px",
                textAlign: "center",
              }}
            >
              <h3 className="section-title">
                No credit notes found
              </h3>

              <p className="page-subtitle">
                Credit notes you create will appear here.
              </p>

              <div style={{ marginTop: 20 }}>
                <Link
                  className="primary-button"
                  href="/credit-notes/new"
                >
                  Create credit note
                </Link>
              </div>
            </div>
          ) : (
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Credit note</th>
                    <th>Client</th>
                    <th>Date</th>
                    <th>Reason</th>
                    <th>Total</th>
                  </tr>
                </thead>

                <tbody>
                  {creditNotes.map((creditNote) => (
                    <tr key={creditNote.id}>
                      <td>
                        <strong>{creditNote.creditNumber}</strong>
                      </td>

                      <td>
                        {creditNote.client?.displayName ?? "—"}
                      </td>

                      <td>
                        {creditNote.issueDate.toLocaleDateString("en-ZA")}
                      </td>

                      <td>{creditNote.reason}</td>

                      <td>
                        R{Number(creditNote.total).toFixed(2)}
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