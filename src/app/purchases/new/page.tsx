import Link from "next/link";
import { createPurchaseInvoice } from "@/app/actions";
import { requireRole } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import WorkspaceShell from "@/app/workspace-shell";

export default async function NewPurchase() {
  const user = await requireRole([
    "OWNER",
    "ADMIN",
    "FINANCE",
    "ACCOUNTANT",
  ]);

  const [suppliers, matters] = await Promise.all([
    prisma.supplier.findMany({
      where: {
        firmId: user.firmId,
        active: true,
      },
      orderBy: {
        name: "asc",
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
            <p className="metric-label">ACCOUNTS PAYABLE</p>

            <h1 className="page-title">
              New purchase invoice
            </h1>

            <p className="page-subtitle">
              Record a supplier invoice and create the accounts payable
              entry.
            </p>
          </div>

          <Link
            className="secondary-button"
            href="/purchases"
          >
            Cancel
          </Link>
        </div>

        <form action={createPurchaseInvoice}>
          <div
            className="card form-card"
            style={{
              marginTop: 24,
              maxWidth: 950,
            }}
          >
            {/* Invoice details */}
            <section>
              <h2 className="section-title">
                Invoice details
              </h2>

              <p className="page-subtitle">
                Enter the supplier and invoice information.
              </p>

              <div className="form-grid" style={{ marginTop: 20 }}>
                <label>
                  Supplier

                  <select
                    id="supplierId"
                    name="supplierId"
                    required
                    defaultValue=""
                  >
                    <option value="" disabled>
                      Select supplier
                    </option>

                    {suppliers.map((supplier) => (
                      <option
                        key={supplier.id}
                        value={supplier.id}
                      >
                        {supplier.name}
                      </option>
                    ))}
                  </select>

                  {suppliers.length === 0 && (
                    <p className="field-help">
                      No active suppliers are available.{" "}
                      <Link href="/suppliers/new">
                        Add a supplier
                      </Link>
                      .
                    </p>
                  )}
                </label>

                <label>
                  Supplier invoice number

                  <input
                    id="invoiceNumber"
                    name="invoiceNumber"
                    required
                    placeholder="e.g. INV-2026-001"
                  />
                </label>
              </div>

              <label style={{ display: "block", marginTop: 20 }}>
                Description

                <input
                  id="description"
                  name="description"
                  required
                  placeholder="e.g. Legal stationery supply"
                />
              </label>
            </section>

            <div className="section-divider" />

            {/* Allocation */}
            <section>
              <h2 className="section-title">
                Allocation
              </h2>

              <p className="page-subtitle">
                Link the supplier invoice to a matter, or record it as a
                firm expense.
              </p>

              <label style={{ display: "block", marginTop: 20 }}>
                Matter

                <select
                  id="matterId"
                  name="matterId"
                  defaultValue=""
                >
                  <option value="">
                    Firm expense
                  </option>

                  {matters.map((matter) => (
                    <option
                      key={matter.id}
                      value={matter.id}
                    >
                      {matter.matterNumber} ·{" "}
                      {matter.client.displayName}
                    </option>
                  ))}
                </select>
              </label>
            </section>

            <div className="section-divider" />

            {/* Financial details */}
            <section>
              <h2 className="section-title">
                Financial details
              </h2>

              <p className="page-subtitle">
                Enter the supplier invoice amounts.
              </p>

              <div className="form-grid" style={{ marginTop: 20 }}>
                <label>
                  Subtotal (R)

                  <input
                    id="subtotal"
                    name="subtotal"
                    type="number"
                    min="0.01"
                    step="0.01"
                    required
                    placeholder="0.00"
                  />
                </label>

                <label>
                  Input VAT (R)

                  <input
                    id="taxAmount"
                    name="taxAmount"
                    type="number"
                    min="0"
                    step="0.01"
                    defaultValue="0"
                    placeholder="0.00"
                  />
                </label>
              </div>
            </section>

            {/* Invoice total information */}
            <div
              className="card"
              style={{ marginTop: 24 }}
            >
              <p className="metric-label">
                INVOICE TOTAL
              </p>

              <p className="page-subtitle">
                The total is calculated when the purchase invoice is posted.
                It comprises the subtotal plus input VAT.
              </p>
            </div>

            {/* Form actions */}
            <div className="form-actions">
              <Link
                className="secondary-button"
                href="/purchases"
              >
                Cancel
              </Link>

              <button
                className="primary-button"
                type="submit"
                disabled={suppliers.length === 0}
              >
                Post purchase invoice
              </button>
            </div>
          </div>
        </form>
      </div>
    </WorkspaceShell>
  );
}