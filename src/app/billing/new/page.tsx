import Link from "next/link";
import { createInvoice } from "@/app/actions";
import { requireRole } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import WorkspaceShell from "@/app/workspace-shell";

export default async function NewInvoice() {
  const user = await requireRole([
    "OWNER",
    "ADMIN",
    "FINANCE",
    "LAWYER",
    "ACCOUNTANT",
  ]);

  const clients = await prisma.client.findMany({
    where: {
      firmId: user.firmId,
      active: true,
    },
    include: {
      matters: {
        where: {
          status: {
            in: ["OPEN", "ON_HOLD"],
          },
        },
        orderBy: {
          matterNumber: "asc",
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
            <h1 className="page-title">New invoice</h1>

            <p className="page-subtitle">
              Issue a simple invoice without making the lawyer think like an
              accountant.
            </p>
          </div>

          <Link
            href="/billing"
            className="secondary-button"
          >
            Back to Billing
          </Link>
        </div>

        <div className="card form-card">
          <form action={createInvoice}>
            <label>
              Client

              <select name="clientId" required defaultValue="">
                <option value="" disabled>
                  Select client
                </option>

                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.displayName}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Matter

              <select name="matterId" defaultValue="">
                <option value="">
                  No matter
                </option>

                {clients.flatMap((client) =>
                  client.matters.map((matter) => (
                    <option key={matter.id} value={matter.id}>
                      {client.displayName} — {matter.matterNumber} —{" "}
                      {matter.title}
                    </option>
                  )),
                )}
              </select>
            </label>

            <label>
              Description

              <input
                name="description"
                type="text"
                required
                placeholder="Professional legal services"
              />
            </label>

            <label>
              Amount before VAT

              <input
                name="subtotal"
                type="number"
                min="0.01"
                step="0.01"
                inputMode="decimal"
                required
              />
            </label>

            <label>
              VAT rate (%)

              <input
                name="taxRate"
                type="number"
                min="0"
                max="100"
                step="0.01"
                inputMode="decimal"
                defaultValue="15"
                required
              />
            </label>

            <div className="form-actions">
              <Link
                href="/billing"
                className="secondary-button"
              >
                Cancel
              </Link>

              <button
                type="submit"
                className="primary-button"
              >
                Issue invoice
              </button>
            </div>
          </form>
        </div>
      </div>
    </WorkspaceShell>
  );
}