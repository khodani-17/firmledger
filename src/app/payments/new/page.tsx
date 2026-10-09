import Link from "next/link";
import { requireRole } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { createPayment } from "@/app/actions";
import WorkspaceShell from "@/app/workspace-shell";

export default async function NewPayment() {
  const user = await requireRole([
    "OWNER",
    "ADMIN",
    "FINANCE",
    "ACCOUNTANT",
  ]);

  const [invoices, banks] = await Promise.all([
    prisma.invoice.findMany({
      where: {
        firmId: user.firmId,
        balanceDue: {
          gt: 0,
        },
        status: {
          not: "VOID",
        },
      },
      include: {
        client: true,
      },
      orderBy: {
        dueDate: "asc",
      },
    }),

    prisma.bankAccount.findMany({
      where: {
        firmId: user.firmId,
        active: true,
        isTrust: false,
      },
      orderBy: [
        {
          bankName: "asc",
        },
        {
          name: "asc",
        },
      ],
    }),
  ]);

  return (
    <WorkspaceShell user={user}>
      <div className="page">
        <div className="page-header">
          <div>
            <h1 className="page-title">Record payment</h1>

            <p className="page-subtitle">
              Allocate the receipt to an outstanding invoice. FirmLedger
              will update the invoice, post the double-entry journal and
              create the bank transaction together.
            </p>
          </div>

          <Link
            href="/payments"
            className="secondary-button"
          >
            Back to Payments
          </Link>
        </div>

        <div className="card form-card" style={{ marginTop: 24 }}>
          <form action={createPayment}>
            <label>
              Invoice

              <select
                name="invoiceId"
                required
                defaultValue=""
              >
                <option value="" disabled>
                  Select invoice
                </option>

                {invoices.map((invoice) => (
                  <option key={invoice.id} value={invoice.id}>
                    {invoice.invoiceNumber} — {invoice.client.displayName} —
                    R{Number(invoice.balanceDue).toFixed(2)} due
                  </option>
                ))}
              </select>

              {invoices.length === 0 && (
                <p className="field-help">
                  There are no outstanding invoices available for payment.
                </p>
              )}
            </label>

            <label>
              Bank account

              <select
                name="bankAccountId"
                required
                defaultValue=""
              >
                <option value="" disabled>
                  Select bank account
                </option>

                {banks.map((bank) => (
                  <option key={bank.id} value={bank.id}>
                    {bank.bankName
                      ? `${bank.bankName} — ${bank.name}`
                      : bank.name}
                  </option>
                ))}
              </select>

              {banks.length === 0 && (
                <p className="field-help">
                  No active business bank accounts have been added yet.{" "}
                  <Link href="/banking/new">
                    Add a bank account
                  </Link>
                  .
                </p>
              )}
            </label>

            <label>
              Amount

              <input
                name="amount"
                type="number"
                min="0.01"
                step="0.01"
                required
                placeholder="0.00"
              />
            </label>

            <label>
              Payment reference

              <input
                name="reference"
                required
                placeholder="EFT-CLIENT-001"
              />
            </label>

            <label>
              Method

              <select name="method" defaultValue="EFT">
                <option value="EFT">EFT</option>
                <option value="Card">Card</option>
                <option value="Cash">Cash</option>
                <option value="Other">Other</option>
              </select>
            </label>

            <div className="form-actions">
              <Link
                href="/payments"
                className="secondary-button"
              >
                Cancel
              </Link>

              <button
                className="primary-button"
                type="submit"
                disabled={banks.length === 0}
              >
                Post payment
              </button>
            </div>
          </form>
        </div>
      </div>
    </WorkspaceShell>
  );
}