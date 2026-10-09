import Link from "next/link";
import { requireUser } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import WorkspaceShell from "@/app/workspace-shell";

export default async function MattersPage() {
  const user = await requireUser();

  const matters = await prisma.matter.findMany({
    where: {
      firmId: user.firmId,
    },
    include: {
      client: true,
    },
    orderBy: {
      matterNumber: "desc",
    },
  });

  return (
    <WorkspaceShell user={user}>
      <div className="page">
        <div className="page-header">
          <div>
            <p className="metric-label">WORK MANAGEMENT</p>

            <h1 className="page-title">Matters</h1>

            <p className="page-subtitle">
              Manage your firm's matters and associated clients.
            </p>
          </div>

          <Link
            className="primary-button"
            href="/matters/new"
          >
            New matter
          </Link>
        </div>

        <section
          className="card"
          style={{ marginTop: 24 }}
        >
          <div className="section-header">
            <div>
              <h2 className="section-title">
                Matter register
              </h2>

              <p className="page-subtitle">
                {matters.length}{" "}
                {matters.length === 1 ? "matter" : "matters"} recorded
              </p>
            </div>
          </div>

          {matters.length === 0 ? (
            <div className="empty-state">
              <p className="empty-state-title">
                No matters found
              </p>

              <p className="empty-state-description">
                Create a matter to see it listed here.
              </p>

              <div style={{ marginTop: 16 }}>
                <Link
                  href="/matters/new"
                  className="primary-button"
                >
                  Create your first matter
                </Link>
              </div>
            </div>
          ) : (
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Matter</th>
                    <th>Client</th>
                    <th>Status</th>
                    <th>Opened</th>
                  </tr>
                </thead>

                <tbody>
                  {matters.map((matter) => (
                    <tr key={matter.id}>
                      <td>
                        <strong>{matter.matterNumber}</strong>

                        <p className="metric-label">
                          {matter.title}
                        </p>
                      </td>

                      <td>{matter.client.displayName}</td>

                      <td>
                        <span className="badge">
                          {matter.status}
                        </span>
                      </td>

                      <td>
                        {matter.openedAt.toLocaleDateString(
                          "en-ZA"
                        )}
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