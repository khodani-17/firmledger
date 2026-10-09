import Link from "next/link";
import { createSupplierPayment } from "@/app/actions";
import { requireRole } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import WorkspaceShell from "@/app/workspace-shell";

export default async function PayPurchase() {
  const user = await requireRole([
    "OWNER",
    "ADMIN",
    "FINANCE",
    "ACCOUNTANT",
  ]);

  const [suppliers, invoices, banks] = await Promise.all([
    prisma.supplier.findMany({
      where: {
        firmId: user.firmId,
        active: true,
      },
      orderBy: {
        name: "asc",
      },
    }),

    prisma.purchaseInvoice.findMany({
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
        supplier: true,
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
      orderBy: {
        name: "asc",
      },
    }),
  ]);

  return (
    <WorkspaceShell user={user}>
      <div className="page">
        <div className="page-header">
          <div>
            <p className="metric-label">ACCOUNTS PAYABLE</p>

            <h1 className="page-title">Pay supplier</h1>

            <p className="page-subtitle">
              Record a payment against a supplier invoice or make an
              unallocated supplier payment.
            </p>
          </div>

          <Link
            className="secondary-button"
            href="/purchases"
          >
            Cancel
          </Link>
        </div>

        <form action={createSupplierPayment}>
          <div
            className="card form-card"
            style={{
              marginTop: 24,
              maxWidth: 950,
            }}
          >
            {/* Payment details */}
            <section>
              <h2 className="section-title">
                Payment details
              </h2>

              <p className="page-subtitle">
                Select the supplier, invoice and bank account used for the
                payment.
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
                  Purchase invoice

                  <select
                    id="purchaseInvoiceId"
                    name="purchaseInvoiceId"
                    defaultValue=""
                  >
                    <option value="">
                      Unallocated supplier payment
                    </option>

                    {invoices.map((invoice) => (
                      <option
                        key={invoice.id}
                        value={invoice.id}
                      >
                        {invoice.invoiceNumber} · {invoice.supplier.name} ·
                        R{Number(invoice.balanceDue).toFixed(2)}
                      </option>
                    ))}
                  </select>

                  {invoices.length === 0 && (
                    <p className="field-help">
                      No outstanding purchase invoices are available.
                      You can still record an unallocated supplier payment.
                    </p>
                  )}
                </label>
              </div>

              <label style={{ display: "block", marginTop: 20 }}>
                Business bank account

                <select
                  id="bankAccountId"
                  name="bankAccountId"
                  required
                  defaultValue=""
                >
                  <option value="" disabled>
                    Select bank account
                  </option>

                  {banks.map((bank) => (
                    <option
                      key={bank.id}
                      value={bank.id}
                    >
                      {bank.name}
                    </option>
                  ))}
                </select>

                {banks.length === 0 && (
                  <p className="field-help">
                    No active business bank accounts are available.{" "}
                    <Link href="/banking/new">
                      Add a bank account
                    </Link>
                    .
                  </p>
                )}
              </label>
            </section>

            <div className="section-divider" />

            {/* Payment amount */}
            <section>
              <h2 className="section-title">
                Payment amount
              </h2>

              <p className="page-subtitle">
                Enter the amount paid to the supplier.
              </p>

              <div className="form-grid" style={{ marginTop: 20 }}>
                <label>
                  Amount (R)

                  <input
                    id="amount"
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
                    id="reference"
                    name="reference"
                    required
                    placeholder="e.g. SUP-PAY-001"
                  />
                </label>
              </div>
            </section>

            {/* Payment summary */}
            <div
              className="card"
              style={{ marginTop: 24 }}
            >
              <p className="metric-label">
                PAYMENT SUMMARY
              </p>

              <p className="page-subtitle">
                The payment will be posted to the supplier&apos;s accounts
                payable balance and the selected business bank account.
              </p>
            </div>

            {/* Actions */}
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
                disabled={suppliers.length === 0 || banks.length === 0}
              >
                Record supplier payment
              </button>
            </div>
          </div>
        </form>
      </div>
    </WorkspaceShell>
  );
}