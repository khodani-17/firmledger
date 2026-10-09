import Link from "next/link";
import { requireUser } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import WorkspaceShell from "@/app/workspace-shell";

export default async function Payments() {
  const user = await requireUser();

  const rows = await prisma.payment.findMany({
    where: {
      firmId: user.firmId,
    },
    include: {
      client: true,
      invoice: true,
    },
    orderBy: {
      paymentDate: "desc",
    },
  });

  return (
    <WorkspaceShell user={user}>
      <div className="page">
        <div className="page-header">
          <div>
            <p className="metric-label">BILLING</p>

            <h1 className="page-title">Payments</h1>

            <p className="page-subtitle">
              View and manage payments received by your firm.
            </p>
          </div>

          <Link
            href="/payments/new"
            className="primary-button"
          >
            Record payment
          </Link>
        </div>

        <section
          className="card"
          style={{ marginTop: 24 }}
        >
          <div className="section-header">
            <div>
              <h2 className="section-title">
                Payment register
              </h2>

              <p className="page-subtitle">
                {rows.length}{" "}
                {rows.length === 1 ? "payment" : "payments"} recorded
              </p>
            </div>
          </div>

          {rows.length === 0 ? (
            <div className="empty-state">
              <p className="empty-state-title">
                No payments recorded
              </p>

              <p className="empty-state-description">
                Record a payment to see it listed here.
              </p>

              <div style={{ marginTop: 16 }}>
                <Link
                  href="/payments/new"
                  className="primary-button"
                >
                  Record your first payment
                </Link>
              </div>
            </div>
          ) : (
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Client</th>
                    <th>Invoice</th>
                    <th>Status</th>
                    <th className="amount">Amount</th>
                  </tr>
                </thead>

                <tbody>
                  {rows.map((payment) => (
                    <tr key={payment.id}>
                      <td>
                        {payment.paymentDate.toLocaleDateString(
                          "en-ZA"
                        )}
                      </td>

                      <td>
                        {payment.client?.displayName ?? "—"}
                      </td>

                      <td>
                        {payment.invoice?.invoiceNumber ??
                          "Unallocated"}
                      </td>

                      <td>
                        <span className="badge">
                          {payment.status}
                        </span>
                      </td>

                      <td className="amount">
                        R{Number(payment.amount).toFixed(2)}
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