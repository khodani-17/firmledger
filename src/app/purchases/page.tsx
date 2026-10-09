import Link from "next/link";
import { requireRole } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import WorkspaceShell from "@/app/workspace-shell";

export default async function Purchases() {
  const user = await requireRole([
    "OWNER",
    "ADMIN",
    "FINANCE",
    "ACCOUNTANT",
  ]);

  const rows = await prisma.purchaseInvoice.findMany({
    where: {
      firmId: user.firmId,
    },
    include: {
      supplier: true,
      matter: true,
    },
    orderBy: {
      invoiceDate: "desc",
    },
  });

  return (
    <WorkspaceShell user={user}>
      <div className="page">
        <div className="page-header">
          <div>
            <p className="metric-label">PURCHASING</p>

            <h1 className="page-title">Purchase invoices</h1>

            <p className="page-subtitle">
              Manage supplier invoices, outstanding balances and payments.
            </p>
          </div>

          <div className="page-actions">
            <Link
              href="/purchases/pay"
              className="secondary-button"
            >
              Pay supplier
            </Link>

            <Link
              href="/purchases/new"
              className="primary-button"
            >
              New purchase invoice
            </Link>
          </div>
        </div>

        <section
          className="card"
          style={{ marginTop: 24 }}
        >
          <div className="section-header">
            <div>
              <h2 className="section-title">
                Purchase register
              </h2>

              <p className="page-subtitle">
                {rows.length}{" "}
                {rows.length === 1
                  ? "purchase invoice"
                  : "purchase invoices"}
              </p>
            </div>
          </div>

          {rows.length === 0 ? (
            <div className="empty-state">
              <p className="empty-state-title">
                No purchase invoices
              </p>

              <p className="empty-state-description">
                Create a purchase invoice to see it listed here.
              </p>

              <div style={{ marginTop: 16 }}>
                <Link
                  href="/purchases/new"
                  className="primary-button"
                >
                  Create purchase invoice
                </Link>
              </div>
            </div>
          ) : (
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Supplier</th>
                    <th>Invoice</th>
                    <th>Date</th>
                    <th>Status</th>
                    <th className="amount">Total</th>
                    <th className="amount">Balance</th>
                  </tr>
                </thead>

                <tbody>
                  {rows.map((purchase) => (
                    <tr key={purchase.id}>
                      <td>{purchase.supplier.name}</td>

                      <td>
                        <strong>{purchase.invoiceNumber}</strong>
                      </td>

                      <td>
                        {purchase.invoiceDate.toLocaleDateString(
                          "en-ZA"
                        )}
                      </td>

                      <td>
                        <span className="badge">
                          {purchase.status}
                        </span>
                      </td>

                      <td className="amount">
                        R{Number(purchase.total).toFixed(2)}
                      </td>

                      <td className="amount">
                        R{Number(purchase.balanceDue).toFixed(2)}
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