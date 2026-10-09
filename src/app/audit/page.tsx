import { requireUser } from "@/lib/permissions";
import WorkspaceShell from "@/app/workspace-shell";

export default async function AuditPage() {
  const user = await requireUser();

  return (
    <WorkspaceShell user={user}>
      <div className="page">
        <div className="page-header">
          <div>
            <p className="metric-label">SYSTEM</p>

            <h1 className="page-title">Audit</h1>

            <p className="page-subtitle">
              Review and monitor activity within your FirmLedger workspace.
            </p>
          </div>
        </div>

        <section
          className="card"
          style={{
            marginTop: 24,
            maxWidth: 950,
          }}
        >
          <p className="metric-label">AUDIT MODULE</p>

          <h2 className="section-title">
            Module foundation ready
          </h2>

          <p className="page-subtitle">
            This module is part of the FirmLedger foundation and is planned
            for implementation in a future accounting workflow phase.
          </p>

          <p className="page-subtitle">
            Workspace authentication and tenant access controls remain
            enforced.
          </p>
        </section>
      </div>
    </WorkspaceShell>
  );
}