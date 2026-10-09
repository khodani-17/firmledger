import Link from "next/link";
import { requireRole } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import WorkspaceShell from "@/app/workspace-shell";

export default async function SuppliersPage() {
  const user = await requireRole([
    "OWNER",
    "ADMIN",
    "FINANCE",
    "ACCOUNTANT",
  ]);

  const suppliers = await prisma.supplier.findMany({
    where: {
      firmId: user.firmId,
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
            <p className="metric-label">PURCHASING</p>

            <h1 className="page-title">Suppliers</h1>

            <p className="page-subtitle">
              Manage supplier information for your firm’s purchasing and
              accounts payable workflows.
            </p>
          </div>

          <Link
            href="/suppliers/new"
            className="primary-button"
          >
            + New supplier
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
              Supplier directory
            </h2>

            <span className="metric-label">
              {suppliers.length}{" "}
              {suppliers.length === 1 ? "SUPPLIER" : "SUPPLIERS"}
            </span>
          </div>

          {suppliers.length === 0 ? (
            <div
              style={{
                padding: "40px 16px",
                textAlign: "center",
              }}
            >
              <h3 className="section-title">
                No suppliers found
              </h3>

              <p className="page-subtitle">
                Create your first supplier to start building your supplier
                directory.
              </p>

              <div style={{ marginTop: 20 }}>
                <Link
                  href="/suppliers/new"
                  className="primary-button"
                >
                  Add your first supplier
                </Link>
              </div>
            </div>
          ) : (
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Supplier</th>
                    <th>VAT number</th>
                    <th>Email</th>
                    <th>Status</th>
                  </tr>
                </thead>

                <tbody>
                  {suppliers.map((supplier) => (
                    <tr key={supplier.id}>
                      <td>{supplier.supplierCode}</td>

                      <td>
                        <strong>{supplier.name}</strong>
                      </td>

                      <td>{supplier.vatNumber || "—"}</td>

                      <td>{supplier.email || "—"}</td>

                      <td>
                        <span className="badge">
                          {supplier.active ? "Active" : "Inactive"}
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