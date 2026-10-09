import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import WorkspaceShell from "@/app/workspace-shell";

function money(value: number) {
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: "ZAR",
    minimumFractionDigits: 2,
  }).format(value);
}

function formatDate(value: Date | null) {
  return value
    ? new Intl.DateTimeFormat("en-ZA", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }).format(value)
    : "—";
}

function statusClass(status: string) {
  switch (status) {
    case "PAID":
      return "bg-emerald-500/10 text-emerald-300";

    case "PARTIALLY_PAID":
      return "bg-amber-500/10 text-amber-300";

    case "OVERDUE":
      return "bg-rose-500/10 text-rose-300";

    case "VOID":
      return "bg-slate-500/10 text-slate-400";

    case "DRAFT":
      return "bg-slate-500/10 text-slate-300";

    default:
      return "bg-sky-500/10 text-sky-300";
  }
}

export default async function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;

  const invoice = await prisma.invoice.findFirst({
    where: {
      id,
      firmId: user.firmId,
    },
    include: {
      client: true,
      matter: true,
      items: true,
    },
  });

  if (!invoice) {
    notFound();
  }

  return (
    <WorkspaceShell user={user}>
      <div className="page">
        <div className="page-header">
          <div>
            <p className="metric-label">BILLING / INVOICE</p>

            <h1 className="page-title">
              {invoice.invoiceNumber}
            </h1>

            <p className="page-subtitle">
              Client invoice and billing details.
            </p>
          </div>

          <div className="page-actions">
            <Link
              href="/billing"
              className="secondary-button"
            >
              Back to Billing
            </Link>

            <span
              className={`status-badge ${statusClass(
                invoice.status,
              )}`}
            >
              {invoice.status}
            </span>
          </div>
        </div>

        <div className="grid grid-2">
          <section className="card">
            <div className="section-header">
              <h2 className="section-title">
                Invoice Details
              </h2>
            </div>

            <div className="compact-grid">
              <InfoItem
                label="Invoice Number"
                value={invoice.invoiceNumber}
              />

              <InfoItem
                label="Issue Date"
                value={formatDate(invoice.issueDate)}
              />

              <InfoItem
                label="Due Date"
                value={formatDate(invoice.dueDate)}
              />
            </div>
          </section>

          <section className="card">
            <div className="section-header">
              <h2 className="section-title">
                Client &amp; Matter
              </h2>
            </div>

            <div className="compact-grid">
              <InfoItem
                label="Client"
                value={invoice.client?.displayName ?? "—"}
              />

              <InfoItem
                label="Matter"
                value={
                  invoice.matter
                    ? `${invoice.matter.matterNumber} — ${invoice.matter.title}`
                    : "—"
                }
              />
            </div>
          </section>
        </div>

        <section className="card">
          <div className="section-header">
            <div>
              <h2 className="section-title">
                Invoice Items
              </h2>

              <p className="section-description">
                Services and charges included on this invoice.
              </p>
            </div>
          </div>

          {invoice.items.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-title">
                No invoice items
              </div>

              <p className="empty-state-text">
                This invoice does not currently contain any line items.
              </p>
            </div>
          ) : (
            <div className="table-scroll">
              <table className="table">
                <thead>
                  <tr>
                    <th>Description</th>
                    <th className="numeric">Quantity</th>
                    <th className="numeric">Unit Price</th>
                    <th className="numeric">VAT</th>
                    <th className="numeric">Total</th>
                  </tr>
                </thead>

                <tbody>
                  {invoice.items.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <span className="font-medium">
                          {item.description}
                        </span>
                      </td>

                      <td className="numeric">
                        {Number(item.quantity)}
                      </td>

                      <td className="numeric amount">
                        {money(Number(item.unitPrice))}
                      </td>

                      <td className="numeric">
                        {Number(item.taxRate).toFixed(2)}%
                      </td>

                      <td className="numeric amount">
                        {money(Number(item.lineTotal))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="card">
          <div className="section-header">
            <h2 className="section-title">
              Invoice Summary
            </h2>
          </div>

          <div className="ledger-footer">
            <div className="invoice-summary">
              <SummaryRow
                label="Subtotal"
                value={money(Number(invoice.subtotal))}
              />

              <SummaryRow
                label="VAT"
                value={money(Number(invoice.taxAmount))}
              />

              <SummaryRow
                label="Total"
                value={money(Number(invoice.total))}
                emphasized
              />

              <div className="summary-divider" />

              <SummaryRow
                label="Amount Paid"
                value={money(Number(invoice.amountPaid))}
              />

              <SummaryRow
                label="Balance Due"
                value={money(Number(invoice.balanceDue))}
                emphasized
              />
            </div>
          </div>
        </section>
      </div>
    </WorkspaceShell>
  );
}

function InfoItem({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div>
      <div className="metric-label">{label}</div>

      <div className="metric-value">
        {value}
      </div>
    </div>
  );
}

function SummaryRow({
  label,
  value,
  emphasized,
}: {
  label: string;
  value: string;
  emphasized?: boolean;
}) {
  return (
    <div
      className={
        emphasized
          ? "summary-row summary-row-emphasized"
          : "summary-row"
      }
    >
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}