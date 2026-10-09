import Link from "next/link";
import { createRecurringInvoice } from "@/app/actions";
import { requireRole } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import WorkspaceShell from "@/app/workspace-shell";

export default async function NewRecurring() {
  const user = await requireRole([
    "OWNER",
    "ADMIN",
    "FINANCE",
    "LAWYER",
    "ACCOUNTANT",
  ]);

  const [clients, matters] = await Promise.all([
    prisma.client.findMany({
      where: {
        firmId: user.firmId,
        active: true,
      },
      orderBy: {
        displayName: "asc",
      },
    }),

    prisma.matter.findMany({
      where: {
        firmId: user.firmId,
        status: {
          not: "ARCHIVED",
        },
      },
      include: {
        client: true,
      },
      orderBy: {
        matterNumber: "desc",
      },
    }),
  ]);

  return (
    <WorkspaceShell user={user}>
      <div className="page">
        <div className="page-header">
          <div>
            <p className="metric-label">BILLING</p>

            <h1 className="page-title">
              New recurring billing schedule
            </h1>

            <p className="page-subtitle">
              Set up a recurring invoice schedule for a client and optionally
              link it to a matter.
            </p>
          </div>

          <Link
            href="/recurring"
            className="secondary-button"
          >
            Cancel
          </Link>
        </div>

        <form
          action={createRecurringInvoice}
          className="card form-grid"
          style={{
            marginTop: 24,
            maxWidth: 950,
          }}
        >
          <label>
            Client

            <select
              name="clientId"
              required
              defaultValue=""
            >
              <option value="" disabled>
                Select client
              </option>

              {clients.map((client) => (
                <option
                  key={client.id}
                  value={client.id}
                >
                  {client.displayName}
                </option>
              ))}
            </select>

            {clients.length === 0 && (
              <p className="field-help">
                No active clients are available.{" "}
                <Link href="/clients/new">
                  Add a client
                </Link>
                .
              </p>
            )}
          </label>

          <label>
            Matter

            <select
              name="matterId"
              defaultValue=""
            >
              <option value="">
                No matter
              </option>

              {matters.map((matter) => (
                <option
                  key={matter.id}
                  value={matter.id}
                >
                  {matter.matterNumber} · {matter.client.displayName}
                </option>
              ))}
            </select>
          </label>

          <label>
            Description

            <input
              name="description"
              required
              placeholder="e.g. Monthly legal retainer"
            />
          </label>

          <label>
            Subtotal (R)

            <input
              name="subtotal"
              type="number"
              min="0.01"
              step="0.01"
              required
              placeholder="0.00"
            />
          </label>

          <label>
            VAT rate (%)

            <input
              name="taxRate"
              type="number"
              min="0"
              step="0.01"
              defaultValue="15"
            />
          </label>

          <label>
            Frequency

            <select
              name="frequency"
              defaultValue="MONTHLY"
            >
              <option value="MONTHLY">Monthly</option>
              <option value="WEEKLY">Weekly</option>
              <option value="QUARTERLY">Quarterly</option>
              <option value="ANNUALLY">Annually</option>
            </select>
          </label>

          <label>
            First run date

            <input
              name="nextRunDate"
              type="date"
              required
            />
          </label>

          <div className="form-actions">
            <Link
              href="/recurring"
              className="secondary-button"
            >
              Cancel
            </Link>

            <button
              className="primary-button"
              type="submit"
              disabled={clients.length === 0}
            >
              Save schedule
            </button>
          </div>
        </form>
      </div>
    </WorkspaceShell>
  );
}