import Link from "next/link";
import { requireRole } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import WorkspaceShell from "@/app/workspace-shell";

function formatMoney(value: number) {
  return `R ${value.toLocaleString("en-ZA", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    OPEN: "status-warning",
    IN_PROGRESS: "status-warning",
    COMPLETED: "status-success",
    "NOT STARTED": "status-neutral",
  };

  return (
    <span className={`badge ${styles[status] ?? "status-neutral"}`}>
      {status.replaceAll("_", " ")}
    </span>
  );
}

function SummaryCard({
  label,
  value,
  description,
}: {
  label: string;
  value: number;
  description: string;
}) {
  return (
    <div className="card compact-card">
      <div className="metric-label">{label}</div>
      <div className="metric-value">{value}</div>
      <p className="muted">{description}</p>
    </div>
  );
}

function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="empty-state">
      <p>{title}</p>
      <span>{description}</span>
      {action ? <div className="form-actions">{action}</div> : null}
    </div>
  );
}

export default async function TrustReconciliation() {
  const user = await requireRole([
    "OWNER",
    "ADMIN",
    "FINANCE",
    "ACCOUNTANT",
  ]);

  const [accounts, reconciliations] = await Promise.all([
    prisma.trustAccount.findMany({
      where: {
        firmId: user.firmId,
        active: true,
      },
      orderBy: {
        name: "asc",
      },
    }),

    prisma.trustReconciliation.findMany({
      where: {
        firmId: user.firmId,
      },
      include: {
        trustAccount: {
          select: {
            name: true,
          },
        },
      },
      orderBy: {
        reconciliationDate: "desc",
      },
      take: 20,
    }),
  ]);

  const latestByAccount = accounts.map((account) => ({
    account,
    latest: reconciliations.find(
      (reconciliation) =>
        reconciliation.trustAccountId === account.id
    ),
  }));

  const openCount = reconciliations.filter(
    (reconciliation) => reconciliation.status === "OPEN"
  ).length;

  const inProgressCount = reconciliations.filter(
    (reconciliation) => reconciliation.status === "IN_PROGRESS"
  ).length;

  const completedCount = reconciliations.filter(
    (reconciliation) => reconciliation.status === "COMPLETED"
  ).length;

  return (
    <WorkspaceShell user={user}>
      <main className="page">
        <div className="page-header">
          <div>
            <Link href="/trust" className="text-link">
              ← Trust Accounting
            </Link>
            <h1 className="page-title">Trust Reconciliation</h1>
            <p className="page-subtitle">
              Reconcile trust bank statement balances against the trust
              ledger and review outstanding differences.
            </p>
          </div>

          <div className="page-actions">
            <Link
              href="/trust/reconciliation/new"
              className="button-primary"
            >
              + New Reconciliation
            </Link>
          </div>
        </div>

        <section>
          <div className="section-heading">
            <h2 className="section-title">Overview</h2>
            <span className="muted">Latest 20 records</span>
          </div>

          <div className="grid grid-4 compact-grid">
            <SummaryCard
              label="Open"
              value={openCount}
              description="Awaiting reconciliation"
            />
            <SummaryCard
              label="In Progress"
              value={inProgressCount}
              description="Currently being reconciled"
            />
            <SummaryCard
              label="Completed"
              value={completedCount}
              description="Marked as completed"
            />
            <SummaryCard
              label="Active Trust Accounts"
              value={accounts.length}
              description="Available for reconciliation"
            />
          </div>
        </section>

        <section className="card compact-card">
          <div className="section-heading">
            <div>
              <h2 className="section-title">Trust Accounts</h2>
              <p className="muted">
                Latest reconciliation for each active account.
              </p>
            </div>
            <span className="muted">
              {accounts.length}{" "}
              {accounts.length === 1 ? "account" : "accounts"}
            </span>
          </div>

          {latestByAccount.length === 0 ? (
            <EmptyState
              title="No active trust accounts"
              description="Active trust accounts will appear here when available for reconciliation."
              action={
                <Link href="/trust" className="button-secondary">
                  View Trust Overview
                </Link>
              }
            />
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Trust Account</th>
                    <th>Last Reconciliation</th>
                    <th className="text-right">Statement Balance</th>
                    <th className="text-right">Ledger Balance</th>
                    <th className="text-right">Difference</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {latestByAccount.map(({ account, latest }) => (
                    <tr key={account.id}>
                      <td className="font-medium">{account.name}</td>
                      <td>
                        {latest
                          ? new Date(
                              latest.reconciliationDate
                            ).toLocaleDateString("en-ZA")
                          : "Not reconciled"}
                      </td>
                      <td className="text-right tabular-nums">
                        {latest
                          ? formatMoney(Number(latest.statementBalance))
                          : "—"}
                      </td>
                      <td className="text-right tabular-nums">
                        {latest
                          ? formatMoney(Number(latest.ledgerBalance))
                          : "—"}
                      </td>
                      <td className="text-right tabular-nums font-medium">
                        {latest
                          ? formatMoney(Number(latest.difference))
                          : "—"}
                      </td>
                      <td>
                        <StatusBadge
                          status={latest ? latest.status : "NOT STARTED"}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="card compact-card">
          <div className="section-heading">
            <div>
              <h2 className="section-title">Reconciliation History</h2>
              <p className="muted">
                Recent reconciliation records and balances.
              </p>
            </div>
            <span className="muted">
              {reconciliations.length}{" "}
              {reconciliations.length === 1 ? "record" : "records"}
            </span>
          </div>

          {reconciliations.length === 0 ? (
            <EmptyState
              title="No reconciliation history yet"
              description="Saved reconciliations will appear here with their dates, balances, statuses, and notes."
              action={
                <Link
                  href="/trust/reconciliation/new"
                  className="button-primary"
                >
                  Start a Reconciliation
                </Link>
              }
            />
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Trust Account</th>
                    <th className="text-right">Statement Balance</th>
                    <th className="text-right">Ledger Balance</th>
                    <th className="text-right">Difference</th>
                    <th>Status</th>
                    <th>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {reconciliations.map((reconciliation) => (
                    <tr key={reconciliation.id}>
                      <td>
                        {new Date(
                          reconciliation.reconciliationDate
                        ).toLocaleDateString("en-ZA")}
                      </td>
                      <td className="font-medium">
                        {reconciliation.trustAccount.name}
                      </td>
                      <td className="text-right tabular-nums">
                        {formatMoney(
                          Number(reconciliation.statementBalance)
                        )}
                      </td>
                      <td className="text-right tabular-nums">
                        {formatMoney(Number(reconciliation.ledgerBalance))}
                      </td>
                      <td className="text-right tabular-nums font-medium">
                        {formatMoney(Number(reconciliation.difference))}
                      </td>
                      <td>
                        <StatusBadge status={reconciliation.status} />
                      </td>
                      <td>
                        <span
                          className="block max-w-[260px] truncate"
                          title={reconciliation.notes || undefined}
                        >
                          {reconciliation.notes || "—"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <p className="muted">
          Review balance differences and supporting bank statements before
          finalising a reconciliation.
        </p>
      </main>
    </WorkspaceShell>
  );
}