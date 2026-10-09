import Link from "next/link";
import { createCreditNote } from "@/app/actions";
import { requireRole } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import WorkspaceShell from "@/app/workspace-shell";

export default async function NewCreditNotePage() {
  const user = await requireRole([
    "OWNER",
    "ADMIN",
    "FINANCE",
    "ACCOUNTANT",
  ]);

  const [clients, invoices] = await Promise.all([
    prisma.client.findMany({
      where: {
        firmId: user.firmId,
        active: true,
      },
      orderBy: {
        displayName: "asc",
      },
    }),

    prisma.invoice.findMany({
      where: {
        firmId: user.firmId,
        status: {
          not: "VOID",
        },
      },
      include: {
        client: true,
      },
      orderBy: {
        issueDate: "desc",
      },
      take: 200,
    }),
  ]);

  return (
    <WorkspaceShell user={user}>
      <div className="page">
        <div className="page-header">
          <div>
            <p className="metric-label">BILLING</p>

            <h1 className="page-title">New credit note</h1>

            <p className="page-subtitle">
              Create a credit note against a client or existing invoice.
            </p>
          </div>

          <Link
            href="/credit-notes"
            className="secondary-button"
          >
            Cancel
          </Link>
        </div>

        <form action={createCreditNote}>
          <section
            className="card"
            style={{ marginTop: 24 }}
          >
            <div className="section-header">
              <div>
                <h2 className="section-title">
                  Credit note details
                </h2>

                <p className="page-subtitle">
                  Select the client, invoice and reason for the credit.
                </p>
              </div>
            </div>

            <div className="form-grid">
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
                    No active clients available.{" "}
                    <Link href="/clients/new">
                      Add a client
                    </Link>
                    .
                  </p>
                )}
              </label>

              <label>
                Invoice

                <select
                  name="invoiceId"
                  defaultValue=""
                >
                  <option value="">
                    No invoice
                  </option>

                  {invoices.map((invoice) => (
                    <option
                      key={invoice.id}
                      value={invoice.id}
                    >
                      {invoice.invoiceNumber} ·{" "}
                      {invoice.client.displayName} · R
                      {Number(invoice.balanceDue).toFixed(2)}
                    </option>
                  ))}
                </select>
              </label>

              <label className="full-width">
                Reason

                <input
                  name="reason"
                  required
                  placeholder="Reason for issuing the credit note"
                />
              </label>
            </div>
          </section>

          <section
            className="card"
            style={{ marginTop: 20 }}
          >
            <div className="section-header">
              <div>
                <h2 className="section-title">
                  Credit amount
                </h2>

                <p className="page-subtitle">
                  Enter the amount being credited.
                </p>
              </div>
            </div>

            <div className="form-grid">
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
                VAT amount (R)

                <input
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

          <div
            className="form-actions"
            style={{ marginTop: 24 }}
          >
            <Link
              href="/credit-notes"
              className="secondary-button"
            >
              Cancel
            </Link>

            <button
              type="submit"
              className="primary-button"
              disabled={clients.length === 0}
            >
              Create credit note
            </button>
          </div>
        </form>
      </div>
    </WorkspaceShell>
  );
}