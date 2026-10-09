import Link from "next/link";
import { requireRole } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import PeriodActions from "./period-actions";
import WorkspaceShell from "@/app/workspace-shell";

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("en-ZA", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(value);
}

function statusClass(status: string) {
  switch (status) {
    case "OPEN":
      return "bg-emerald-500/10 text-emerald-300";
    case "CLOSED":
      return "bg-amber-500/10 text-amber-300";
    case "LOCKED":
      return "bg-rose-500/10 text-rose-300";
    default:
      return "bg-slate-500/10 text-slate-300";
  }
}

export default async function FinancialPeriodsPage() {
  const user = await requireRole(["OWNER", "ADMIN", "FINANCE"]);

  const periods = await prisma.financialPeriod.findMany({
    where: {
      firmId: user.firmId,
    },
    orderBy: [
      {
        startDate: "desc",
      },
      {
        endDate: "desc",
      },
    ],
    select: {
      id: true,
      name: true,
      startDate: true,
      endDate: true,
      status: true,
      closedAt: true,
      closedBy: true,
      _count: {
        select: {
          journalEntries: true,
          reviews: true,
        },
      },
    },
  });

  const openPeriods = periods.filter(
    (period) => period.status === "OPEN",
  ).length;

  const closedPeriods = periods.filter(
    (period) => period.status === "CLOSED",
  ).length;

  const lockedPeriods = periods.filter(
    (period) => period.status === "LOCKED",
  ).length;

  const latestPeriod = periods[0] ?? null;

  return (
    <WorkspaceShell user={user}>
      <main className="page">
        <div className="page-header">
          <div>
            <div className="page-eyebrow">
              Accounting / Period Management
            </div>

            <h1 className="page-title">
              Financial Periods &amp; Year-End
            </h1>

            <p className="page-subtitle">
              Manage accounting periods, review status and year-end
              controls.
            </p>
          </div>

          <div className="page-actions">
            <Link href="/accounting" className="secondary-button">
              Back to Accounting
            </Link>
          </div>
        </div>

        <div className="grid grid-4">
          <div className="card compact-card">
            <div className="metric-label">Financial Periods</div>
            <div className="metric-value">{periods.length}</div>
          </div>

          <div className="card compact-card">
            <div className="metric-label">Open</div>
            <div className="metric-value">{openPeriods}</div>
          </div>

          <div className="card compact-card">
            <div className="metric-label">Closed</div>
            <div className="metric-value">{closedPeriods}</div>
          </div>

          <div className="card compact-card">
            <div className="metric-label">Locked</div>
            <div className="metric-value">{lockedPeriods}</div>
          </div>
        </div>

        {latestPeriod && (
          <section className="card">
            <div className="section-header">
              <div>
                <div className="page-eyebrow">Latest Period</div>

                <h2 className="section-title">
                  {latestPeriod.name}
                </h2>
              </div>

              <span
                className={`status-badge ${statusClass(
                  latestPeriod.status,
                )}`}
              >
                {latestPeriod.status}
              </span>
            </div>

            <div className="compact-grid">
              <InfoItem
                label="Start"
                value={formatDate(latestPeriod.startDate)}
              />

              <InfoItem
                label="End"
                value={formatDate(latestPeriod.endDate)}
              />

              <InfoItem
                label="Journal Entries"
                value={String(latestPeriod._count.journalEntries)}
              />

              <InfoItem
                label="Reviews"
                value={String(latestPeriod._count.reviews)}
              />
            </div>
          </section>
        )}

        <section className="card">
          <div className="section-header">
            <div>
              <h2 className="section-title">
                Financial Periods
              </h2>

              <p className="section-description">
                Review period activity and control the closing lifecycle.
              </p>
            </div>
          </div>

          {periods.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-title">
                No financial periods have been created.
              </div>

              <p className="empty-state-text">
                Create a financial period before posting and reporting
                against a formal accounting period.
              </p>
            </div>
          ) : (
            <div className="table-scroll">
              <table className="table">
                <thead>
                  <tr>
                    <th>Period</th>
                    <th>Start</th>
                    <th>End</th>
                    <th>Status</th>
                    <th className="numeric">Journal Entries</th>
                    <th className="numeric">Reviews</th>
                    <th>Closed</th>
                    <th className="numeric">Action</th>
                  </tr>
                </thead>

                <tbody>
                  {periods.map((period) => (
                    <tr key={period.id}>
                      <td>
                        <span className="nowrap">
                          {period.name}
                        </span>
                      </td>

                      <td className="date nowrap">
                        {formatDate(period.startDate)}
                      </td>

                      <td className="date nowrap">
                        {formatDate(period.endDate)}
                      </td>

                      <td>
                        <span
                          className={`status-badge ${statusClass(
                            period.status,
                          )}`}
                        >
                          {period.status}
                        </span>
                      </td>

                      <td className="numeric">
                        {period._count.journalEntries}
                      </td>

                      <td className="numeric">
                        {period._count.reviews}
                      </td>

                      <td className="date nowrap">
                        {period.closedAt
                          ? formatDate(period.closedAt)
                          : "—"}
                      </td>

                      <td className="numeric">
                        <PeriodActions
                          periodId={period.id}
                          status={period.status}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section>
          <div className="section-header">
            <div>
              <h2 className="section-title">
                Accounting Controls
              </h2>

              <p className="section-description">
                Periods move through a controlled accounting lifecycle.
              </p>
            </div>
          </div>

          <div className="grid grid-3">
            <ControlCard
              title="OPEN"
              description="Accounting activity can be recorded against the period. Reviews should be completed before closing."
            />

            <ControlCard
              title="CLOSED"
              description="The period has been closed after review. Authorised users can lock it as a stronger year-end control."
            />

            <ControlCard
              title="LOCKED"
              description="The period is locked and treated as restricted for normal accounting activity."
            />
          </div>
        </section>

        <section className="card">
          <div className="section-header">
            <div>
              <h2 className="section-title">
                Accounting Reports
              </h2>

              <p className="section-description">
                Review the core reports before closing a financial period.
              </p>
            </div>
          </div>

          <div className="grid grid-4">
            <ReportLink
              href="/accounting/trial-balance"
              label="Trial Balance"
            />

            <ReportLink
              href="/accounting/general-ledger"
              label="General Ledger"
            />

            <ReportLink
              href="/accounting/profit-loss"
              label="Profit & Loss"
            />

            <ReportLink
              href="/accounting/balance-sheet"
              label="Balance Sheet"
            />
          </div>
        </section>

        <div className="rounded-lg border border-amber-900/40 bg-amber-950/20 px-4 py-3 text-xs leading-5 text-amber-200/80">
          Closing requires review controls to be satisfied. Locking is
          restricted to OWNER and ADMIN users. Global enforcement of
          locked-period posting restrictions will be added to the
          accounting posting workflows.
        </div>
      </main>
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

      <div className="metric-value">{value}</div>
    </div>
  );
}

function ControlCard({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="card compact-card">
      <div className="section-title">{title}</div>

      <p className="section-description">
        {description}
      </p>
    </div>
  );
}

function ReportLink({
  href,
  label,
}: {
  href: string;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="secondary-button"
    >
      {label}
    </Link>
  );
}