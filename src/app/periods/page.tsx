import { requireRole } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import {
  createFinancialPeriod,
  closeFinancialPeriod,
} from "@/app/actions";
import WorkspaceShell from "@/app/workspace-shell";

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("en-ZA", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(value);
}

export default async function Periods() {
  const user = await requireRole([
    "OWNER",
    "ADMIN",
    "FINANCE",
    "ACCOUNTANT",
  ]);

  const rows = await prisma.financialPeriod.findMany({
    where: {
      firmId: user.firmId,
    },
    orderBy: {
      startDate: "desc",
    },
  });

  const openPeriod = rows.find(
    (period) => period.status === "OPEN",
  );

  const closedPeriods = rows.filter(
    (period) => period.status !== "OPEN",
  );

  return (
    <WorkspaceShell user={user}>
      <div className="page">
        <div className="page-header">
          <div>
            <p className="metric-label">ACCOUNTING / CONTROLS</p>

            <h1 className="page-title">Financial periods</h1>

            <p className="page-subtitle">
              Manage accounting periods and control when transactions
              can be posted.
            </p>
          </div>

          <div className="page-actions">
            <a
              href="#create-period"
              className="primary-button"
            >
              New period
            </a>
          </div>
        </div>

        <section className="card">
          <div className="section-header">
            <div>
              <h2 className="section-title">
                Current period
              </h2>

              <p className="section-description">
                Current posting status for this firm.
              </p>
            </div>

            <span
              className={`status-badge ${
                openPeriod
                  ? "bg-emerald-500/10 text-emerald-300"
                  : "bg-rose-500/10 text-rose-300"
              }`}
            >
              {openPeriod ? "OPEN" : "NO OPEN PERIOD"}
            </span>
          </div>

          {openPeriod ? (
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-semibold text-slate-100">
                  {openPeriod.name}
                </h3>

                <p className="metric-caption">
                  {formatDate(openPeriod.startDate)} –{" "}
                  {formatDate(openPeriod.endDate)}
                </p>
              </div>

              <div className="page-actions">
                <span className="status-badge bg-emerald-500/10 text-emerald-300">
                  Posting allowed
                </span>

                <form action={closeFinancialPeriod}>
                  <input
                    type="hidden"
                    name="periodId"
                    value={openPeriod.id}
                  />

                  <button
                    type="submit"
                    className="secondary-button"
                  >
                    Close period
                  </button>
                </form>
              </div>
            </div>
          ) : (
            <div className="empty-state">
              <div className="empty-state-title">
                No open financial period
              </div>

              <p className="empty-state-text">
                Posting is blocked until a financial period is created.
              </p>
            </div>
          )}
        </section>

        <section
          id="create-period"
          className="card"
        >
          <div className="section-header">
            <div>
              <h2 className="section-title">
                Create financial period
              </h2>

              <p className="section-description">
                Set the period name and its start and end dates.
              </p>
            </div>
          </div>

          <form
            action={createFinancialPeriod}
            className="grid grid-4"
          >
            <div className="form-field">
              <label htmlFor="period-name">
                Period name
              </label>

              <input
                id="period-name"
                name="name"
                placeholder="2026 Financial Year"
                required
              />
            </div>

            <div className="form-field">
              <label htmlFor="period-start">
                Start date
              </label>

              <input
                id="period-start"
                name="startDate"
                type="date"
                required
              />
            </div>

            <div className="form-field">
              <label htmlFor="period-end">
                End date
              </label>

              <input
                id="period-end"
                name="endDate"
                type="date"
                required
              />
            </div>

            <div className="form-field justify-end">
              <label className="invisible">
                Create period
              </label>

              <button
                type="submit"
                className="primary-button"
              >
                Create period
              </button>
            </div>
          </form>
        </section>

        <div className="grid grid-3">
          <div className="compact-card">
            <div className="metric-label">
              Posting control
            </div>

            <div className="metric-value">
              {openPeriod ? "Allowed" : "Blocked"}
            </div>

            <p className="metric-caption">
              {openPeriod
                ? "An open period is available for posting."
                : "An open period is required for posting."}
            </p>
          </div>

          <div className="compact-card">
            <div className="metric-label">Open periods</div>

            <div className="metric-value">
              {openPeriod ? 1 : 0}
            </div>
          </div>

          <div className="compact-card">
            <div className="metric-label">Closed periods</div>

            <div className="metric-value">
              {closedPeriods.length}
            </div>

            <p className="metric-caption">
              {rows.length} total{" "}
              {rows.length === 1 ? "period" : "periods"}
            </p>
          </div>
        </div>

        <section className="card">
          <div className="section-header">
            <div>
              <h2 className="section-title">
                Period history
              </h2>

              <p className="section-description">
                Review financial periods and their current status.
              </p>
            </div>

            <span className="metric-caption">
              {rows.length} {rows.length === 1 ? "period" : "periods"}
            </span>
          </div>

          {rows.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-title">
                No financial periods
              </div>

              <p className="empty-state-text">
                Create a financial period above to get started.
              </p>
            </div>
          ) : (
            <div className="table-scroll">
              <table className="table">
                <thead>
                  <tr>
                    <th>Period</th>
                    <th>Start date</th>
                    <th>End date</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>

                <tbody>
                  {rows.map((period) => (
                    <tr key={period.id}>
                      <td>
                        <span className="font-medium">
                          {period.name}
                        </span>
                      </td>

                      <td className="date">
                        {formatDate(period.startDate)}
                      </td>

                      <td className="date">
                        {formatDate(period.endDate)}
                      </td>

                      <td>
                        <span
                          className={`status-badge ${
                            period.status === "OPEN"
                              ? "bg-emerald-500/10 text-emerald-300"
                              : "bg-slate-500/10 text-slate-300"
                          }`}
                        >
                          {period.status}
                        </span>
                      </td>

                      <td>
                        {period.status === "OPEN" ? (
                          <form action={closeFinancialPeriod}>
                            <input
                              type="hidden"
                              name="periodId"
                              value={period.id}
                            />

                            <button
                              type="submit"
                              className="secondary-button"
                            >
                              Close period
                            </button>
                          </form>
                        ) : (
                          <span className="metric-caption">
                            {period.closedAt
                              ? `Closed ${formatDate(period.closedAt)}`
                              : "Closed"}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </WorkspaceShell>
  );
}