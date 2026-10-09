import Link from "next/link";
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

export default async function BillingPage() {
  const user = await requireUser();

  const invoices = await prisma.invoice.findMany({
    where: {
      firmId: user.firmId,
    },
    include: {
      client: true,
      matter: true,
    },
    orderBy: {
      issueDate: "desc",
    },
  });

  const totalInvoiced = invoices.reduce(
    (total, invoice) => total + Number(invoice.total),
    0,
  );

  const totalOutstanding = invoices.reduce(
    (total, invoice) => total + Number(invoice.balanceDue),
    0,
  );

  const paidInvoices = invoices.filter(
    (invoice) => invoice.status === "PAID",
  ).length;

  const outstandingInvoices = invoices.filter(
    (invoice) =>
      Number(invoice.balanceDue) > 0 &&
      invoice.status !== "VOID",
  ).length;

  return (
    <WorkspaceShell user={user}>
      <div className="page">
        <div className="page-header">
          <div>
            <p className="metric-label">BILLING / INVOICES</p>

            <h1 className="page-title">Billing</h1>

            <p className="page-subtitle">
              Invoices, balances and client billing.
            </p>
          </div>

          <div className="page-actions">
            <Link
              className="primary-button"
              href="/billing/new"
            >
              New invoice
            </Link>
          </div>
        </div>

        <div className="grid grid-4">
          <div className="compact-card">
            <div className="metric-label">Invoices</div>

            <div className="metric-value">
              {invoices.length}
            </div>
          </div>

          <div className="compact-card">
            <div className="metric-label">Total invoiced</div>

            <div className="metric-amount">
              {money(totalInvoiced)}
            </div>
          </div>

          <div className="compact-card">
            <div className="metric-label">Outstanding</div>

            <div className="metric-amount">
              {money(totalOutstanding)}
            </div>
          </div>

          <div className="compact-card">
            <div className="metric-label">Paid invoices</div>

            <div className="metric-value">
              {paidInvoices}
            </div>

            <div className="metric-caption">
              {outstandingInvoices} outstanding
            </div>
          </div>
        </div>

        <section className="card">
          <div className="section-header">
            <div>
              <h2 className="section-title">Invoices</h2>

              <p className="section-description">
                Review client invoices, payment status and outstanding
                balances.
              </p>
            </div>
          </div>

          {invoices.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-title">
                No invoices found
              </div>

              <p className="empty-state-text">
                Create a new invoice to begin billing a client.
              </p>

              <div className="page-actions">
                <Link
                  href="/billing/new"
                  className="primary-button"
                >
                  New invoice
                </Link>
              </div>
            </div>
          ) : (
            <div className="table-scroll">
              <table className="table">
                <thead>
                  <tr>
                    <th>Invoice</th>
                    <th>Client</th>
                    <th>Matter</th>
                    <th>Status</th>
                    <th className="numeric">Total</th>
                    <th className="numeric">Balance</th>
                  </tr>
                </thead>

                <tbody>
                  {invoices.map((invoice) => (
                    <tr key={invoice.id}>
                      <td>
                        <div>
                          <Link
                            href={`/billing/${invoice.id}`}
                            className="font-medium text-slate-200 underline decoration-slate-600 underline-offset-4 transition hover:text-white hover:decoration-slate-300"
                          >
                            {invoice.invoiceNumber}
                          </Link>
                        </div>

                        <div className="metric-caption">
                          Due {formatDate(invoice.dueDate)}
                        </div>
                      </td>

                      <td>
                        {invoice.client?.displayName ?? "—"}
                      </td>

                      <td>
                        <span className="nowrap">
                          {invoice.matter?.matterNumber ?? "—"}
                        </span>
                      </td>

                      <td>
                        <span
                          className={`status-badge ${statusClass(
                            invoice.status,
                          )}`}
                        >
                          {invoice.status}
                        </span>
                      </td>

                      <td className="numeric amount">
                        {money(Number(invoice.total))}
                      </td>

                      <td className="numeric amount">
                        {money(Number(invoice.balanceDue))}
                      </td>
                    </tr>
                  ))}
                </tbody>

                <tfoot>
                  <tr>
                    <td colSpan={4}>Total</td>

                    <td className="numeric amount">
                      {money(totalInvoiced)}
                    </td>

                    <td className="numeric amount">
                      {money(totalOutstanding)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </section>
      </div>
    </WorkspaceShell>
  );
}