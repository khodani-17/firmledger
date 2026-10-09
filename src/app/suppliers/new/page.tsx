import Link from "next/link";
import { createSupplier } from "@/app/actions";
import { requireRole } from "@/lib/permissions";
import WorkspaceShell from "@/app/workspace-shell";

export default async function NewSupplierPage() {
  const user = await requireRole([
    "OWNER",
    "ADMIN",
    "FINANCE",
    "ACCOUNTANT",
  ]);

  return (
    <WorkspaceShell user={user}>
      <div className="page">
        <div className="page-header">
          <div>
            <p className="metric-label">PURCHASING</p>

            <h1 className="page-title">New supplier</h1>

            <p className="page-subtitle">
              Add a supplier to your accounts payable records.
            </p>
          </div>

          <Link
            href="/suppliers"
            className="secondary-button"
          >
            Cancel
          </Link>
        </div>

        <form action={createSupplier}>
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
                Supplier details
              </h2>

              <p className="page-subtitle">
                Enter the supplier's basic business information.
              </p>
            </div>

            <div className="form-grid">
              <label>
                Supplier name

                <input
                  id="name"
                  name="name"
                  required
                  placeholder="e.g. ABC Legal Supplies"
                />
              </label>

              <label>
                Supplier type

                <select
                  id="type"
                  name="type"
                  defaultValue="COMPANY"
                >
                  <option value="COMPANY">Company</option>
                  <option value="INDIVIDUAL">Individual</option>
                  <option value="OTHER">Other</option>
                </select>
              </label>
            </div>

            <div
              style={{
                borderTop: "1px solid var(--border-color, #263449)",
                margin: "28px 0",
              }}
            />

            <div style={{ marginBottom: 20 }}>
              <h2 className="section-title">
                Registration details
              </h2>

              <p className="page-subtitle">
                Optional tax information for the supplier.
              </p>
            </div>

            <div style={{ maxWidth: 450 }}>
              <label>
                VAT number

                <input
                  id="vatNumber"
                  name="vatNumber"
                  placeholder="Optional"
                />
              </label>
            </div>

            <div
              style={{
                borderTop: "1px solid var(--border-color, #263449)",
                margin: "28px 0",
              }}
            />

            <div style={{ marginBottom: 20 }}>
              <h2 className="section-title">
                Contact information
              </h2>

              <p className="page-subtitle">
                Add contact details for supplier communication.
              </p>
            </div>

            <div className="form-grid">
              <label>
                Email

                <input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="supplier@example.com"
                />
              </label>

              <label>
                Phone

                <input
                  id="phone"
                  name="phone"
                  type="tel"
                  placeholder="e.g. 012 345 6789"
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
                href="/suppliers"
                className="secondary-button"
              >
                Cancel
              </Link>

              <button
                className="primary-button"
                type="submit"
              >
                Save supplier
              </button>
            </div>
          </section>
        </form>
      </div>
    </WorkspaceShell>
  );
}