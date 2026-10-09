
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/permissions";
import WorkspaceShell from "@/app/workspace-shell";

export default async function Home() {
  const user = await requireUser();

  const [invoiceAgg, paidAgg, expenseAgg, outstanding] = await Promise.all([
    prisma.invoice.aggregate({
      where: {
        firmId: user.firmId,
        status: { not: "VOID" },
      },
      _sum: { total: true },
    }),

    prisma.payment.aggregate({
      where: {
        firmId: user.firmId,
        status: "COMPLETED",
      },
      _sum: { amount: true },
    }),

    prisma.expense.aggregate({
      where: {
        firmId: user.firmId,
      },
      _sum: { amount: true },
    }),

    prisma.invoice.aggregate({
      where: {
        firmId: user.firmId,
        status: {
          in: ["SENT", "PARTIALLY_PAID", "OVERDUE"],
        },
      },
      _sum: { balanceDue: true },
    }),
  ]);

  const money = (n: unknown) => `R${Number(n ?? 0).toFixed(2)}`;

  return (
    <WorkspaceShell user={user}>
      <div className="page">
        <div className="page-header">
          <div>
            <h1 className="page-title">Good morning</h1>
            <p className="page-subtitle">
              A simple financial view of your firm.
            </p>
          </div>
        </div>

        <div className="grid grid-4" style={{ marginTop: 24 }}>
          <Metric
            label="Revenue / billed"
            value={money(invoiceAgg._sum.total)}
          />

          <Metric
            label="Outstanding invoices"
            value={money(outstanding._sum.balanceDue)}
          />

          <Metric
            label="Payments received"
            value={money(paidAgg._sum.amount)}
          />

          <Metric
            label="Expenses"
            value={money(expenseAgg._sum.amount)}
          />
        </div>

        <div className="card" style={{ marginTop: 22 }}>
          <div className="section-title">Quick actions</div>

          <div className="action-grid">
            <Action
              href="/billing/new"
              title="New invoice"
              text="Create an invoice for a client or matter."
            />

            <Action
              href="/expenses/new"
              title="Record expense"
              text="Capture a firm expense or disbursement."
            />

            <Action
              href="/payments/new"
              title="Record payment"
              text="Record money received from a client."
            />

            <Action
              href="/banking/reconciliation"
              title="Reconcile bank"
              text="Match bank activity to transactions."
            />
          </div>
        </div>

        <div className="grid grid-2" style={{ marginTop: 22 }}>
          <div className="card">
            <div className="section-title">FirmLedger workflow</div>

            <p className="page-subtitle">
              Clients → Matters → Billing → Payments → Bank reconciliation →
              Accountant review → Month-end close → Reports.
            </p>
          </div>

          <div className="card">
            <div className="section-title">Current user</div>

            <p className="page-subtitle">
              You are signed in as <strong>{user.role}</strong>. Permissions
              will control each financial action as the platform grows.
            </p>
          </div>
        </div>
      </div>
    </WorkspaceShell>
  );
}

function Metric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="card">
      <div className="metric-label">{label}</div>
      <div className="metric-value">{value}</div>
    </div>
  );
}

function Action({
  href,
  title,
  text,
}: {
  href: string;
  title: string;
  text: string;
}) {
  return (
    <Link className="action" href={href}>
      <strong>{title}</strong>
      <div className="metric-label" style={{ marginTop: 7 }}>
        {text}
      </div>
    </Link>
  );
}