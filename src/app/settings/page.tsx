import { requireUser } from "@/lib/permissions";
import WorkspaceShell from "@/app/workspace-shell";

export default async function SettingsPage() {
  const user = await requireUser();

  return (
    <WorkspaceShell user={user}>
      <div className="page">
        <div className="page-header">
          <div>
            <p className="metric-label">SYSTEM</p>

            <h1 className="page-title">Settings</h1>

            <p className="page-subtitle">
              Manage your FirmLedger workspace and its configuration.
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
          <p className="metric-label">SETTINGS MODULE</p>

          <h2 className="section-title">
            Module foundation ready
          </h2>

          <p className="page-subtitle">
            This module is part of the FirmLedger foundation and will be
            implemented in a future accounting workflow phase.
          </p>

          <p className="page-subtitle">
            Your workspace authentication, tenant security, and access
            permissions remain in place.
          </p>
        </section>
      </div>
    </WorkspaceShell>
  );
}