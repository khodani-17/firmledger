import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/permissions";
import WorkspaceShell from "@/app/workspace-shell";

type SearchParams = {
  client?: string;
  status?: string;
  overdue?: string;
};

const invoiceStatuses = [
  "DRAFT",
  "SENT",
  "PARTIALLY_PAID",
  "PAID",
  "OVERDUE",
  "VOID",
] as const;

function money(value: number) {
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: "ZAR",
    minimumFractionDigits: 2,
  }).format(value);
}

function formatDate(value: Date | null | undefined) {
  if (!value) return "—";

  return new Intl.DateTimeFormat("en-ZA", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(value);
}

function getClientName(client: {
  displayName: string | null;
  companyName: string | null;
  name: string | null;
  surname: string | null;
}) {
  return (
    client.displayName ||
    client.companyName ||
    [client.name, client.surname].filter(Boolean).join(" ") ||
    "Unnamed client"
  );
}

function statusLabel(status: string) {
  switch (status) {
    case "DRAFT":
      return "Draft";
    case "SENT":
      return "Sent";
    case "PARTIALLY_PAID":
      return "Partially paid";
    case "PAID":
      return "Paid";
    case "OVERDUE":
      return "Overdue";
    case "VOID":
      return "Void";
    default:
      return status;
  }
}

function statusClass(status: string) {
  switch (status) {
    case "PAID":
      return "ar-status ar-status-paid";
    case "PARTIALLY_PAID":
      return "ar-status ar-status-partial";
    case "OVERDUE":
      return "ar-status ar-status-overdue";
    case "SENT":
      return "ar-status ar-status-sent";
    case "VOID":
      return "ar-status ar-status-void";
    default:
      return "ar-status ar-status-draft";
  }
}

function isOverdue(
  dueDate: Date | null,
  balanceDue: number,
  status: string,
) {
  if (!dueDate || balanceDue <= 0) return false;

  if (status === "PAID" || status === "VOID") {
    return false;
  }

  return dueDate.getTime() < Date.now();
}

export default async function AccountsReceivablePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const user = await requireRole([
    "OWNER",
    "ADMIN",
    "FINANCE",
  ]);

  const params = await searchParams;

  const clientId = params.client || "";
  const status = params.status || "";
  const overdueOnly = params.overdue === "true";

  const clients = await prisma.client.findMany({
    where: {
      firmId: user.firmId,
      active: true,
    },
    orderBy: [
      { displayName: "asc" },
      { companyName: "asc" },
      { surname: "asc" },
      { name: "asc" },
    ],
    select: {
      id: true,
      displayName: true,
      companyName: true,
      name: true,
      surname: true,
    },
  });

  const invoices = await prisma.invoice.findMany({
    where: {
      firmId: user.firmId,
      ...(clientId ? { clientId } : {}),
      ...(status
        ? {
            status: status as (typeof invoiceStatuses)[number],
          }
        : {}),
    },
    orderBy: [
      { dueDate: "asc" },
      { issueDate: "desc" },
    ],
    select: {
      id: true,
      invoiceNumber: true,
      issueDate: true,
      dueDate: true,
      subtotal: true,
      taxAmount: true,
      total: true,
      amountPaid: true,
      balanceDue: true,
      status: true,
      client: {
        select: {
          id: true,
          displayName: true,
          companyName: true,
          name: true,
          surname: true,
        },
      },
      matter: {
        select: {
          id: true,
          matterNumber: true,
          title: true,
        },
      },
    },
  });

  const rows = invoices
    .map((invoice) => {
      const total = Number(invoice.total ?? 0);
      const amountPaid = Number(invoice.amountPaid ?? 0);
      const balanceDue = Number(invoice.balanceDue ?? 0);

      const overdue = isOverdue(
        invoice.dueDate,
        balanceDue,
        invoice.status,
      );

      return {
        id: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        issueDate: invoice.issueDate,
        dueDate: invoice.dueDate,
        total,
        amountPaid,
        balanceDue,
        status: invoice.status,
        overdue,
        clientName: getClientName(invoice.client),
        clientId: invoice.client.id,
        matterNumber: invoice.matter?.matterNumber ?? null,
        matterTitle: invoice.matter?.title ?? null,
      };
    })
    .filter((invoice) =>
      overdueOnly ? invoice.overdue : true,
    );

  const totalInvoiced = rows.reduce(
    (sum, invoice) => sum + invoice.total,
    0,
  );

  const totalReceived = rows.reduce(
    (sum, invoice) => sum + invoice.amountPaid,
    0,
  );

  const totalOutstanding = rows.reduce(
    (sum, invoice) => sum + invoice.balanceDue,
    0,
  );

  const overdueAmount = rows
    .filter((invoice) => invoice.overdue)
    .reduce(
      (sum, invoice) => sum + invoice.balanceDue,
      0,
    );

  const overdueCount = rows.filter(
    (invoice) => invoice.overdue,
  ).length;

  const hasFilters =
    Boolean(clientId) ||
    Boolean(status) ||
    overdueOnly;

  return (
    <WorkspaceShell user={user}>
      <main className="page">
        <div className="page-header">
          <div>
            <div className="page-eyebrow">
              ACCOUNTING
            </div>

            <h1 className="page-title">
              Accounts Receivable
            </h1>

            <p className="page-subtitle">
              Track client invoices, payments received and
              outstanding balances.
            </p>
          </div>

          <div className="page-actions">
            <span className="status-badge">
              Client receivables
            </span>

            {hasFilters ? (
              <span className="status-badge">
                Filters applied
              </span>
            ) : null}
          </div>
        </div>

        <section className="card compact-card">
          <div className="section-header">
            <div>
              <h2 className="section-title">
                Receivables filters
              </h2>

              <p className="section-description">
                Narrow receivables by client, invoice status or
                overdue invoices.
              </p>
            </div>
          </div>

          <form
            method="get"
            className="ledger-filter-grid"
          >
            <label className="ledger-filter-field">
              <span>Client</span>

              <select
                name="client"
                defaultValue={clientId}
              >
                <option value="">
                  All clients
                </option>

                {clients.map((client) => (
                  <option
                    key={client.id}
                    value={client.id}
                  >
                    {getClientName(client)}
                  </option>
                ))}
              </select>
            </label>

            <label className="ledger-filter-field">
              <span>Invoice status</span>

              <select
                name="status"
                defaultValue={status}
              >
                <option value="">
                  All statuses
                </option>

                {invoiceStatuses.map(
                  (invoiceStatus) => (
                    <option
                      key={invoiceStatus}
                      value={invoiceStatus}
                    >
                      {statusLabel(invoiceStatus)}
                    </option>
                  ),
                )}
              </select>
            </label>

            <label className="ledger-filter-field">
              <span>Overdue</span>

              <select
                name="overdue"
                defaultValue={overdueOnly ? "true" : ""}
              >
                <option value="">
                  All invoices
                </option>

                <option value="true">
                  Overdue only
                </option>
              </select>
            </label>

            <div className="ledger-filter-actions">
              <button
                type="submit"
                className="primary-button"
              >
                Apply filters
              </button>

              {hasFilters ? (
                <Link
                  href="/accounting/accounts-receivable"
                  className="secondary-button"
                >
                  Clear
                </Link>
              ) : null}
            </div>
          </form>
        </section>

        <section className="grid grid-4 compact-grid">
          <article className="card compact-card">
            <div className="metric-label">
              Total invoiced
            </div>

            <div className="metric-value metric-amount">
              {money(totalInvoiced)}
            </div>

            <div className="metric-caption">
              Invoice value
            </div>
          </article>

          <article className="card compact-card">
            <div className="metric-label">
              Total received
            </div>

            <div className="metric-value metric-amount">
              {money(totalReceived)}
            </div>

            <div className="metric-caption">
              Payments allocated to invoices
            </div>
          </article>

          <article className="card compact-card">
            <div className="metric-label">
              Outstanding
            </div>

            <div className="metric-value metric-amount">
              {money(totalOutstanding)}
            </div>

            <div className="metric-caption">
              Amount still owed
            </div>
          </article>

          <article className="card compact-card">
            <div className="metric-label">
              Overdue
            </div>

            <div className="metric-value metric-amount">
              {money(overdueAmount)}
            </div>

            <div className="metric-caption">
              {overdueCount} overdue invoice
              {overdueCount === 1 ? "" : "s"}
            </div>
          </article>
        </section>

        <section className="card compact-card">
          <div className="section-header">
            <div>
              <h2 className="section-title">
                Client receivables
              </h2>

              <p className="section-description">
                Invoices and balances for the selected
                filters.
              </p>
            </div>

            <div className="ledger-net-movement">
              <span>Outstanding</span>

              <strong>
                {money(totalOutstanding)}
              </strong>
            </div>
          </div>

          <div className="table-scroll">
            <table className="table">
              <thead>
                <tr>
                  <th>Invoice</th>
                  <th>Client</th>
                  <th>Matter</th>
                  <th>Date</th>
                  <th>Due</th>
                  <th>Status</th>
                  <th className="numeric">Amount</th>
                  <th className="numeric">Paid</th>
                  <th className="numeric">Balance</th>
                </tr>
              </thead>

              <tbody>
                {rows.length > 0 ? (
                  rows.map((row) => (
                    <tr key={row.id}>
                      <td className="nowrap">
                        <Link
                          href={`/billing/${row.id}`}
                          className="ledger-reference"
                        >
                          {row.invoiceNumber}
                        </Link>
                      </td>

                      <td>
                        <strong>{row.clientName}</strong>
                      </td>

                      <td>
                        {row.matterNumber ? (
                          <div>
                            <strong>
                              {row.matterNumber}
                            </strong>

                            {row.matterTitle ? (
                              <span>
                                {" "}
                                — {row.matterTitle}
                              </span>
                            ) : null}
                          </div>
                        ) : (
                          "—"
                        )}
                      </td>

                      <td className="date nowrap">
                        {formatDate(row.issueDate)}
                      </td>

                      <td
                        className={`date nowrap ${
                          row.overdue ? "ledger-negative" : ""
                        }`}
                      >
                        {formatDate(row.dueDate)}
                      </td>

                      <td>
                        <div className="status-stack">
                          <span
                            className={statusClass(row.status)}
                          >
                            {statusLabel(row.status)}
                          </span>

                          {row.overdue &&
                          row.status !== "OVERDUE" ? (
                            <span className="ar-status ar-status-overdue">
                              Overdue
                            </span>
                          ) : null}
                        </div>
                      </td>

                      <td className="amount nowrap">
                        {money(row.total)}
                      </td>

                      <td className="amount nowrap">
                        {money(row.amountPaid)}
                      </td>

                      <td
                        className={`amount nowrap ${
                          row.balanceDue > 0
                            ? "ar-balance-outstanding"
                            : ""
                        }`}
                      >
                        {money(row.balanceDue)}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={9} className="empty-state">
                      <div>
                        <div className="empty-state-title">
                          No receivables found
                        </div>

                        <div className="empty-state-text">
                          No invoices match the selected
                          filters.
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>

              {rows.length > 0 ? (
                <tfoot>
                  <tr>
                    <td colSpan={6} className="total-label">
                      Totals
                    </td>

                    <td className="amount nowrap">
                      <strong>
                        {money(totalInvoiced)}
                      </strong>
                    </td>

                    <td className="amount nowrap">
                      <strong>
                        {money(totalReceived)}
                      </strong>
                    </td>

                    <td className="amount nowrap">
                      <strong>
                        {money(totalOutstanding)}
                      </strong>
                    </td>
                  </tr>
                </tfoot>
              ) : null}
            </table>
          </div>

          <div className="ledger-footer">
            <span>
              {rows.length} invoice
              {rows.length === 1 ? "" : "s"}
            </span>

            <span>•</span>

            <span>
              Invoiced {money(totalInvoiced)}
            </span>

            <span>•</span>

            <span>
              Received {money(totalReceived)}
            </span>

            <span>•</span>

            <span>
              Outstanding {money(totalOutstanding)}
            </span>
          </div>
        </section>
      </main>
    </WorkspaceShell>
  );
}