import Link from "next/link";
import { requireUser } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import WorkspaceShell from "@/app/workspace-shell";

export default async function ClientsPage() {
  const user = await requireUser();

  const clients = await prisma.client.findMany({
    where: {
      firmId: user.firmId,
    },
    include: {
      _count: {
        select: {
          matters: true,
        },
      },
    },
    orderBy: {
      displayName: "asc",
    },
  });

  return (
    <WorkspaceShell user={user}>
      <div className="page">
        <div className="page-header">
          <div>
            <p className="metric-label">WORK</p>

            <h1 className="page-title">Clients</h1>

            <p className="page-subtitle">
              The people and organisations your firm acts for.
            </p>
          </div>

          <Link
            className="primary-button"
            href="/clients/new"
          >
            + New client
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
              Client directory
            </h2>

            <span className="metric-label">
              {clients.length}{" "}
              {clients.length === 1 ? "CLIENT" : "CLIENTS"}
            </span>
          </div>

          {clients.length === 0 ? (
            <div
              style={{
                padding: "40px 16px",
                textAlign: "center",
              }}
            >
              <h3 className="section-title">
                No clients found
              </h3>

              <p className="page-subtitle">
                Add your first client to start managing matters and billing.
              </p>

              <div style={{ marginTop: 20 }}>
                <Link
                  className="primary-button"
                  href="/clients/new"
                >
                  Add your first client
                </Link>
              </div>
            </div>
          ) : (
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Client</th>
                    <th>Code</th>
                    <th>Type</th>
                    <th>Matters</th>
                    <th>Contact</th>
                  </tr>
                </thead>

                <tbody>
                  {clients.map((client) => (
                    <tr key={client.id}>
                      <td>
                        <strong>{client.displayName}</strong>
                      </td>

                      <td>{client.clientCode}</td>

                      <td>{client.type}</td>

                      <td>{client._count.matters}</td>

                      <td>
                        {client.email ?? client.phone ?? "—"}
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