import Link from "next/link";
import { createClient } from "@/app/actions";
import { requireRole } from "@/lib/permissions";
import WorkspaceShell from "@/app/workspace-shell";

export default async function NewClientPage() {
  const user = await requireRole([
    "OWNER",
    "ADMIN",
    "FINANCE",
    "LAWYER",
    "STAFF",
  ]);

  return (
    <WorkspaceShell user={user}>
      <div className="page">
        <div className="page-header">
          <div>
            <p className="metric-label">WORK</p>

            <h1 className="page-title">New client</h1>

            <p className="page-subtitle">
              Capture only the information the firm needs.
            </p>
          </div>

          <Link
            href="/clients"
            className="secondary-button"
          >
            Cancel
          </Link>
        </div>

        <form action={createClient}>
          <section
            className="card"
            style={{
              marginTop: 24,
              maxWidth: 950,
              padding: 28,
            }}
          >
            <div style={{ marginBottom: 24 }}>
              <h2 className="section-title">
                Client details
              </h2>

              <p className="page-subtitle">
                Enter the client's contact information and classification.
              </p>
            </div>

            <div className="form-grid">
              <label>
                Client name

                <input
                  name="displayName"
                  type="text"
                  required
                  placeholder="Enter client or organisation name"
                />
              </label>

              <label>
                Client type

                <select
                  name="type"
                  defaultValue="INDIVIDUAL"
                >
                  <option value="INDIVIDUAL">Individual</option>
                  <option value="COMPANY">Company</option>
                  <option value="TRUST">Trust</option>
                  <option value="OTHER">Other</option>
                </select>
              </label>

              <label>
                Email

                <input
                  name="email"
                  type="email"
                  placeholder="client@example.com"
                />
              </label>

              <label>
                Phone

                <input
                  name="phone"
                  type="tel"
                  placeholder="Enter contact number"
                />
              </label>
            </div>

            <div
              className="form-actions"
              style={{
                marginTop: 30,
                paddingTop: 22,
                borderTop: "1px solid var(--border-color, #263449)",
              }}
            >
              <Link
                href="/clients"
                className="secondary-button"
              >
                Cancel
              </Link>

              <button
                className="primary-button"
                type="submit"
              >
                Create client
              </button>
            </div>
          </section>
        </form>
      </div>
    </WorkspaceShell>
  );
}