import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/permissions";
import WorkspaceShell from "@/app/workspace-shell";

type SearchParams = {
  supplier?: string;
  status?: string;
  overdue?: string;
};

const purchaseInvoiceStatuses = [
  "DRAFT",
  "RECEIVED",
  "PARTIALLY_PAID",
  "PAID",
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

function statusLabel(status: string) {
  switch (status) {
    case "DRAFT":
      return "Draft";
    case "RECEIVED":
      return "Received";
    case "PARTIALLY_PAID":
      return "Partially paid";
    case "PAID":
      return "Paid";
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
    case "RECEIVED":
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
  if (!dueDate || balanceDue <= 0) {
    return false;
  }

  if (status === "PAID" || status === "VOID") {
    return false;
  }

  return dueDate.getTime() < Date.now();
}

export default async function AccountsPayablePage({
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

  const supplierId = params.supplier || "";
  const status = params.status || "";
  const overdueOnly = params.overdue === "true";

  const suppliers = await prisma.supplier.findMany({
    where: {
      firmId: user.firmId,
      active: true,
    },
    orderBy: {
      name: "asc",
    },
    select: {
      id: true,
      name: true,
      supplierCode: true,
    },
  });

  const purchaseInvoices =
    await prisma.purchaseInvoice.findMany({
      where: {
        firmId: user.firmId,
        ...(supplierId ? { supplierId } : {}),
        ...(status
          ? {
              status:
                status as (typeof purchaseInvoiceStatuses)[number],
            }
          : {}),
      },
      orderBy: [
        { dueDate: "asc" },
        { invoiceDate: "desc" },
      ],
      select: {
        id: true,
        supplierId: true,
        invoiceNumber: true,
        invoiceDate: true,
        dueDate: true,
        total: true,
        amountPaid: true,
        balanceDue: true,
        status: true,
        description: true,
        matterId: true,
      },
    });

  const supplierIds = [
    ...new Set(
      purchaseInvoices.map(
        (invoice) => invoice.supplierId,
      ),
    ),
  ];

  const matterIds = [
    ...new Set(
      purchaseInvoices
        .map((invoice) => invoice.matterId)
        .filter(
          (matterId): matterId is string =>
            Boolean(matterId),
        ),
    ),
  ];

  const [invoiceSuppliers, matters] =
    await Promise.all([
      supplierIds.length > 0
        ? prisma.supplier.findMany({
            where: {
              firmId: user.firmId,
              id: {
                in: supplierIds,
              },
            },
            select: {
              id: true,
              name: true,
              supplierCode: true,
            },
          })
        : [],

      matterIds.length > 0
        ? prisma.matter.findMany({
            where: {
              firmId: user.firmId,
              id: {
                in: matterIds,
              },
            },
            select: {
              id: true,
              matterNumber: true,
              title: true,
            },
          })
        : [],
    ]);

  const supplierMap = new Map(
    invoiceSuppliers.map((supplier) => [
      supplier.id,
      supplier,
    ]),
  );

  const matterMap = new Map(
    matters.map((matter) => [
      matter.id,
      matter,
    ]),
  );

  const rows = purchaseInvoices
    .map((invoice) => {
      const total = Number(invoice.total ?? 0);

      const amountPaid = Number(
        invoice.amountPaid ?? 0,
      );

      const balanceDue = Number(
        invoice.balanceDue ?? 0,
      );

      const overdue = isOverdue(
        invoice.dueDate,
        balanceDue,
        invoice.status,
      );

      const supplier = supplierMap.get(
        invoice.supplierId,
      );

      const matter = invoice.matterId
        ? matterMap.get(invoice.matterId)
        : null;

      return {
        id: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        invoiceDate: invoice.invoiceDate,
        dueDate: invoice.dueDate,
        total,
        amountPaid,
        balanceDue,
        status: invoice.status,
        overdue,
        supplierName:
          supplier?.name ?? "Unknown supplier",
        supplierCode:
          supplier?.supplierCode ?? null,
        matterNumber:
          matter?.matterNumber ?? null,
        matterTitle:
          matter?.title ?? null,
        description:
          invoice.description ?? null,
      };
    })
    .filter((invoice) =>
      overdueOnly ? invoice.overdue : true,
    );

  const totalPurchases = rows.reduce(
    (sum, invoice) => sum + invoice.total,
    0,
  );

  const totalPaid = rows.reduce(
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
    Boolean(supplierId) ||
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
              Accounts Payable
            </h1>

            <p className="page-subtitle">
              Track supplier invoices, payments and
              outstanding balances.
            </p>
          </div>

          <div className="page-actions">
            <span className="status-badge">
              Supplier payables
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
                Payables filters
              </h2>

              <p className="section-description">
                Narrow supplier payables by supplier,
                invoice status or overdue invoices.
              </p>
            </div>
          </div>

          <form
            method="get"
            className="ledger-filter-grid"
          >
            <label className="ledger-filter-field">
              <span>Supplier</span>

              <select
                name="supplier"
                defaultValue={supplierId}
              >
                <option value="">
                  All suppliers
                </option>

                {suppliers.map((supplier) => (
                  <option
                    key={supplier.id}
                    value={supplier.id}
                  >
                    {supplier.name}
                    {supplier.supplierCode
                      ? ` (${supplier.supplierCode})`
                      : ""}
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

                {purchaseInvoiceStatuses.map(
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
                defaultValue={
                  overdueOnly ? "true" : ""
                }
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
                  href="/accounting/accounts-payable"
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
              Total purchases
            </div>

            <div className="metric-value metric-amount">
              {money(totalPurchases)}
            </div>

            <div className="metric-caption">
              Supplier invoice value
            </div>
          </article>

          <article className="card compact-card">
            <div className="metric-label">
              Total paid
            </div>

            <div className="metric-value metric-amount">
              {money(totalPaid)}
            </div>

            <div className="metric-caption">
              Payments made to suppliers
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
              Amount still payable
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
                Supplier payables
              </h2>

              <p className="section-description">
                Supplier invoices and balances for the
                selected filters.
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
                  <th>Supplier</th>
                  <th>Matter</th>
                  <th>Date</th>
                  <th>Due</th>
                  <th>Status</th>
                  <th className="numeric">
                    Amount
                  </th>
                  <th className="numeric">
                    Paid
                  </th>
                  <th className="numeric">
                    Balance
                  </th>
                </tr>
              </thead>

              <tbody>
                {rows.length > 0 ? (
                  rows.map((row) => (
                    <tr key={row.id}>
                      <td className="nowrap">
                        <Link
                          href={`/purchases/${row.id}`}
                          className="ledger-reference"
                        >
                          {row.invoiceNumber}
                        </Link>
                      </td>

                      <td>
                        <div>
                          <strong>
                            {row.supplierName}
                          </strong>

                          {row.supplierCode ? (
                            <small className="table-secondary-text">
                              {row.supplierCode}
                            </small>
                          ) : null}
                        </div>
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
                        ) : row.description ? (
                          row.description
                        ) : (
                          "—"
                        )}
                      </td>

                      <td className="date nowrap">
                        {formatDate(row.invoiceDate)}
                      </td>

                      <td
                        className={`date nowrap ${
                          row.overdue
                            ? "ledger-negative"
                            : ""
                        }`}
                      >
                        {formatDate(row.dueDate)}
                      </td>

                      <td>
                        <div className="status-stack">
                          <span
                            className={statusClass(
                              row.status,
                            )}
                          >
                            {statusLabel(row.status)}
                          </span>

                          {row.overdue ? (
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
                    <td
                      colSpan={9}
                      className="empty-state"
                    >
                      <div>
                        <div className="empty-state-title">
                          No payables found
                        </div>

                        <div className="empty-state-text">
                          No supplier invoices match the
                          selected filters.
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>

              {rows.length > 0 ? (
                <tfoot>
                  <tr>
                    <td
                      colSpan={6}
                      className="total-label"
                    >
                      Totals
                    </td>

                    <td className="amount nowrap">
                      <strong>
                        {money(totalPurchases)}
                      </strong>
                    </td>

                    <td className="amount nowrap">
                      <strong>
                        {money(totalPaid)}
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
              Purchases {money(totalPurchases)}
            </span>

            <span>•</span>

            <span>
              Paid {money(totalPaid)}
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