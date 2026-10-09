import Link from "next/link";
import { requireRole } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import WorkspaceShell from "@/app/workspace-shell";

type SearchParams = {
  startDate?: string;
  endDate?: string;
};

function money(value: number) {
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: "ZAR",
    minimumFractionDigits: 2,
  }).format(value);
}

function dateOnly(value: Date) {
  return value.toISOString().slice(0, 10);
}

export default async function VatTaxPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const user = await requireRole(["OWNER", "ADMIN", "FINANCE"]);
  const params = await searchParams;

  const today = new Date();

  const startDate = params.startDate
    ? new Date(`${params.startDate}T00:00:00`)
    : new Date(today.getFullYear(), today.getMonth(), 1);

  const endDate = params.endDate
    ? new Date(`${params.endDate}T23:59:59.999`)
    : new Date(today);

  const [salesInvoices, purchaseInvoices] = await Promise.all([
    prisma.invoice.findMany({
      where: {
        firmId: user.firmId,
        issueDate: {
          gte: startDate,
          lte: endDate,
        },
        status: {
          not: "VOID",
        },
      },
      orderBy: {
        issueDate: "asc",
      },
      select: {
        id: true,
        invoiceNumber: true,
        issueDate: true,
        subtotal: true,
        taxAmount: true,
        total: true,
        status: true,
        client: {
          select: {
            displayName: true,
            name: true,
            surname: true,
            companyName: true,
          },
        },
      },
    }),

    prisma.purchaseInvoice.findMany({
      where: {
        firmId: user.firmId,
        invoiceDate: {
          gte: startDate,
          lte: endDate,
        },
        status: {
          not: "VOID",
        },
      },
      orderBy: {
        invoiceDate: "asc",
      },
      select: {
        id: true,
        invoiceNumber: true,
        invoiceDate: true,
        subtotal: true,
        taxAmount: true,
        total: true,
        status: true,
        supplier: {
          select: {
            name: true,
          },
        },
      },
    }),
  ]);

  const outputVat = salesInvoices.reduce(
    (total, invoice) => total + Number(invoice.taxAmount),
    0,
  );

  const inputVat = purchaseInvoices.reduce(
    (total, invoice) => total + Number(invoice.taxAmount),
    0,
  );

  const netVat = outputVat - inputVat;

  const salesSubtotal = salesInvoices.reduce(
    (total, invoice) => total + Number(invoice.subtotal),
    0,
  );

  const salesTotal = salesInvoices.reduce(
    (total, invoice) => total + Number(invoice.total),
    0,
  );

  const purchaseSubtotal = purchaseInvoices.reduce(
    (total, invoice) => total + Number(invoice.subtotal),
    0,
  );

  const purchaseTotal = purchaseInvoices.reduce(
    (total, invoice) => total + Number(invoice.total),
    0,
  );

  const clientName = (client: {
    displayName: string | null;
    name: string | null;
    surname: string | null;
    companyName: string | null;
  }) =>
    client.displayName ||
    client.companyName ||
    [client.name, client.surname].filter(Boolean).join(" ") ||
    "Unnamed Client";

  return (
    <WorkspaceShell user={user}>
      <main className="page">
        <div className="page-header">
          <div>
            <div className="page-eyebrow">
              ACCOUNTING / TAX
            </div>

            <h1 className="page-title">
              VAT / Tax
            </h1>

            <p className="page-subtitle">
              VAT collected from clients and VAT recorded on
              supplier purchases.
            </p>
          </div>

          <div className="page-actions">
            <Link
              href="/accounting"
              className="secondary-button"
            >
              Back to Accounting
            </Link>
          </div>
        </div>

        <section className="card compact-card">
          <div className="section-header">
            <div>
              <div className="section-title">
                Reporting filters
              </div>

              <div className="section-description">
                Choose the date range for the VAT summary.
              </div>
            </div>
          </div>

          <form method="get">
            <div className="ledger-filter-grid">
              <div className="ledger-filter-field">
                <label htmlFor="startDate">
                  From
                </label>

                <input
                  id="startDate"
                  name="startDate"
                  type="date"
                  defaultValue={dateOnly(startDate)}
                />
              </div>

              <div className="ledger-filter-field">
                <label htmlFor="endDate">
                  To
                </label>

                <input
                  id="endDate"
                  name="endDate"
                  type="date"
                  defaultValue={dateOnly(endDate)}
                />
              </div>

              <div className="ledger-filter-actions">
                <button
                  type="submit"
                  className="primary-button"
                >
                  Apply Filters
                </button>
              </div>
            </div>
          </form>
        </section>

        <div className="grid grid-4 compact-grid">
          <div className="card compact-card">
            <div className="metric-label">
              Output VAT
            </div>

            <div className="metric-value metric-amount">
              {money(outputVat)}
            </div>

            <div className="metric-caption">
              VAT on client invoices
            </div>
          </div>

          <div className="card compact-card">
            <div className="metric-label">
              Input VAT
            </div>

            <div className="metric-value metric-amount">
              {money(inputVat)}
            </div>

            <div className="metric-caption">
              VAT on supplier invoices
            </div>
          </div>

          <div className="card compact-card">
            <div className="metric-label">
              Net VAT
            </div>

            <div className="metric-value metric-amount">
              {money(netVat)}
            </div>

            <div className="metric-caption">
              Output VAT less input VAT
            </div>
          </div>

          <div className="card compact-card">
            <div className="metric-label">
              VAT Invoices
            </div>

            <div className="metric-value">
              {salesInvoices.length + purchaseInvoices.length}
            </div>

            <div className="metric-caption">
              Client and supplier invoices
            </div>
          </div>
        </div>

        <div className="grid grid-2 compact-grid">
          <div className="card compact-card">
            <div className="metric-label">
              Sales Excluding VAT
            </div>

            <div className="metric-value metric-amount">
              {money(salesSubtotal)}
            </div>
          </div>

          <div className="card compact-card">
            <div className="metric-label">
              Purchases Excluding VAT
            </div>

            <div className="metric-value metric-amount">
              {money(purchaseSubtotal)}
            </div>
          </div>
        </div>

        <section className="card compact-card">
          <div className="section-header">
            <div>
              <div className="page-eyebrow">
                VAT POSITION
              </div>

              <h2 className="section-title">
                {netVat >= 0
                  ? "Net VAT payable"
                  : "Net VAT credit position"}
              </h2>

              <p className="section-description">
                Output VAT less input VAT for the selected period.
              </p>
            </div>
          </div>

          <div>
            <VatRow
              label="Output VAT"
              amount={outputVat}
            />

            <VatRow
              label="Less: Input VAT"
              amount={-inputVat}
            />

            <VatRow
              label="Net VAT position"
              amount={netVat}
              emphasized
            />
          </div>
        </section>

        <section className="card compact-card">
          <div className="section-header">
            <div>
              <h2 className="section-title">
                Output VAT — Client Invoices
              </h2>

              <p className="section-description">
                VAT recorded on invoices issued to clients.
              </p>
            </div>
          </div>

          {salesInvoices.length === 0 ? (
            <EmptyState message="No client invoices found for this period." />
          ) : (
            <div className="table-scroll">
              <table className="table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Invoice</th>
                    <th>Client</th>
                    <th className="numeric">Excl. VAT</th>
                    <th className="numeric">VAT</th>
                    <th className="numeric">Total</th>
                  </tr>
                </thead>

                <tbody>
                  {salesInvoices.map((invoice) => (
                    <tr key={invoice.id}>
                      <td className="date nowrap">
                        {dateOnly(invoice.issueDate)}
                      </td>

                      <td>
                        <span className="nowrap">
                          {invoice.invoiceNumber}
                        </span>
                      </td>

                      <td>
                        {clientName(invoice.client)}
                      </td>

                      <td className="numeric amount">
                        {money(Number(invoice.subtotal))}
                      </td>

                      <td className="numeric amount status-text-success">
                        {money(Number(invoice.taxAmount))}
                      </td>

                      <td className="numeric amount">
                        {money(Number(invoice.total))}
                      </td>
                    </tr>
                  ))}
                </tbody>

                <tfoot>
                  <tr>
                    <td colSpan={3} className="total-label">
                      Total
                    </td>

                    <td className="numeric amount total-value">
                      {money(salesSubtotal)}
                    </td>

                    <td className="numeric amount total-value">
                      {money(outputVat)}
                    </td>

                    <td className="numeric amount total-value">
                      {money(salesTotal)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </section>

        <section className="card compact-card">
          <div className="section-header">
            <div>
              <h2 className="section-title">
                Input VAT — Supplier Invoices
              </h2>

              <p className="section-description">
                VAT recorded on supplier and purchase invoices.
              </p>
            </div>
          </div>

          {purchaseInvoices.length === 0 ? (
            <EmptyState message="No supplier invoices found for this period." />
          ) : (
            <div className="table-scroll">
              <table className="table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Invoice</th>
                    <th>Supplier</th>
                    <th className="numeric">Excl. VAT</th>
                    <th className="numeric">VAT</th>
                    <th className="numeric">Total</th>
                  </tr>
                </thead>

                <tbody>
                  {purchaseInvoices.map((invoice) => (
                    <tr key={invoice.id}>
                      <td className="date nowrap">
                        {dateOnly(invoice.invoiceDate)}
                      </td>

                      <td>
                        <span className="nowrap">
                          {invoice.invoiceNumber}
                        </span>
                      </td>

                      <td>
                        {invoice.supplier.name}
                      </td>

                      <td className="numeric amount">
                        {money(Number(invoice.subtotal))}
                      </td>

                      <td className="numeric amount status-text-success">
                        {money(Number(invoice.taxAmount))}
                      </td>

                      <td className="numeric amount">
                        {money(Number(invoice.total))}
                      </td>
                    </tr>
                  ))}
                </tbody>

                <tfoot>
                  <tr>
                    <td colSpan={3} className="total-label">
                      Total
                    </td>

                    <td className="numeric amount total-value">
                      {money(purchaseSubtotal)}
                    </td>

                    <td className="numeric amount total-value">
                      {money(inputVat)}
                    </td>

                    <td className="numeric amount total-value">
                      {money(purchaseTotal)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </section>

        <section className="card compact-card">
          <div className="section-description">
            This report is an accounting VAT summary. It does not
            submit a VAT return to SARS and does not determine
            whether every transaction is legally claimable as input
            VAT. Final VAT treatment should be reviewed before filing.
          </div>
        </section>
      </main>
    </WorkspaceShell>
  );
}

function VatRow({
  label,
  amount,
  emphasized,
}: {
  label: string;
  amount: number;
  emphasized?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between border-t border-slate-800 px-4 py-3 ${
        emphasized ? "bg-slate-950/40" : ""
      }`}
    >
      <span
        className={
          emphasized
            ? "text-sm font-semibold text-slate-100"
            : "text-sm text-slate-300"
        }
      >
        {label}
      </span>

      <span
        className={
          emphasized
            ? "text-sm font-semibold text-slate-100"
            : "text-sm font-medium text-slate-300"
        }
      >
        {money(amount)}
      </span>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="empty-state">
      <div className="empty-state-title">
        No transactions
      </div>

      <p className="empty-state-text">
        {message}
      </p>
    </div>
  );
}