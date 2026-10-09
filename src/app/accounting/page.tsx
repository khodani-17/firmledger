
import Link from "next/link";
import { requireRole } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { reviewItem } from "@/app/actions";
import WorkspaceShell from "@/app/workspace-shell";

export default async function AccountingPage() {
  const user = await requireRole([
    "OWNER",
    "ADMIN",
    "FINANCE",
    "ACCOUNTANT",
  ]);

  const [entries, reviews, openPeriod] = await Promise.all([
    prisma.journalEntry.findMany({
      where: {
        firmId: user.firmId,
      },
      include: {
        lines: {
          include: {
            ledgerAccount: true,
          },
        },
      },
      orderBy: {
        entryDate: "desc",
      },
      take: 30,
    }),

    prisma.accountantReview.findMany({
      where: {
        firmId: user.firmId,
        status: "PENDING",
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 20,
    }),

    prisma.financialPeriod.findFirst({
      where: {
        firmId: user.firmId,
        status: "OPEN",
      },
      orderBy: {
        startDate: "desc",
      },
    }),
  ]);

  const totalDebits = entries.reduce(
    (total, entry) =>
      total +
      entry.lines.reduce(
        (sum, line) => sum + Number(line.debit),
        0
      ),
    0
  );

  const totalCredits = entries.reduce(
    (total, entry) =>
      total +
      entry.lines.reduce(
        (sum, line) => sum + Number(line.credit),
        0
      ),
    0
  );

  const isBalanced =
    totalDebits.toFixed(2) === totalCredits.toFixed(2);

  return (
    <WorkspaceShell user={user}>
      <div className="page">
        <div className="page-header">
          <div>
            <h1 className="page-title">Accounting</h1>
            <p className="page-subtitle">
              General ledger activity, financial controls and
              accountant review.
            </p>
          </div>

          <div className="page-actions">
            <Link href="/reports" className="secondary-button">
              Reports
            </Link>

            <Link href="/billing/new" className="primary-button">
              New invoice
            </Link>
          </div>
        </div>

        {/* FINANCIAL PERIOD */}
        <div className="card compact-card">
          <div className="section-header">
            <div>
              <div className="metric-label">
                Open financial period
              </div>

              <div className="metric-value">
                {openPeriod?.name || "No open financial period"}
              </div>

              {openPeriod && (
                <div className="metric-label">
                  {openPeriod.startDate.toLocaleDateString("en-ZA")} —{" "}
                  {openPeriod.endDate.toLocaleDateString("en-ZA")}
                </div>
              )}
            </div>

            <div className="page-actions">
              <span
                className={
                  openPeriod
                    ? "status-badge status-success"
                    : "status-badge status-danger"
                }
              >
                <span className="status-dot" />
                {openPeriod ? "OPEN" : "NO OPEN PERIOD"}
              </span>

              <Link href="/periods" className="secondary-button">
                Manage periods
              </Link>
            </div>
          </div>
        </div>

        {/* SUMMARY */}
        <div className="grid grid-4 compact-grid">
          <div className="card">
            <div className="metric-label">Journal entries</div>
            <div className="metric-value">{entries.length}</div>
            <div className="metric-label">Recent postings</div>
          </div>

          <div className="card">
            <div className="metric-label">Pending reviews</div>
            <div className="metric-value">{reviews.length}</div>
            <div className="metric-label">
              Awaiting accountant action
            </div>
          </div>

          <div className="card">
            <div className="metric-label">Total debits</div>
            <div className="metric-value metric-amount">
              R{totalDebits.toFixed(2)}
            </div>
            <div className="metric-label">
              Recent journal activity
            </div>
          </div>

          <div className="card">
            <div className="metric-label">Ledger status</div>
            <div
              className={`metric-value ${
                isBalanced
                  ? "status-text-success"
                  : "status-text-danger"
              }`}
            >
              {isBalanced ? "Balanced" : "Check"}
            </div>
            <div className="metric-label">
              Debit and credit totals
            </div>
          </div>
        </div>

        {/* ACCOUNTING NAVIGATION */}
        <div className="card compact-card">
          <div className="section-header">
            <div>
              <div className="section-title">
                Accounting navigation
              </div>
              <div className="metric-label">
                Access the main financial control areas.
              </div>
            </div>
          </div>

          <div className="accounting-nav-grid">
            <Link
              href="/accounting/general-ledger"
              className="accounting-nav-item"
            >
              <div className="accounting-nav-title">
                General Ledger
              </div>
              <div className="metric-label">
                View ledger accounts and postings
              </div>
            </Link>

            <Link
              href="/accounting/trial-balance"
              className="accounting-nav-item"
            >
              <div className="accounting-nav-title">
                Trial Balance
              </div>
              <div className="metric-label">
                Review debit and credit balances
              </div>
            </Link>

            <Link
              href="/periods"
              className="accounting-nav-item"
            >
              <div className="accounting-nav-title">
                Financial Periods
              </div>
              <div className="metric-label">
                Open and manage accounting periods
              </div>
            </Link>

            <a
              href="#review-queue"
              className="accounting-nav-item"
            >
              <div className="accounting-nav-title">
                Review Queue
              </div>
              <div className="metric-label">
                Review transactions awaiting approval
              </div>
            </a>
          </div>
        </div>

        {/* JOURNAL + REVIEW QUEUE */}
        <div className="grid grid-2 compact-grid">
          {/* JOURNAL */}
          <div className="card">
            <div className="section-header">
              <div>
                <div className="section-title">
                  Recent journal activity
                </div>
                <div className="metric-label">
                  Latest double-entry postings.
                </div>
              </div>

              <Link href="/audit" className="secondary-button">
                Audit
              </Link>
            </div>

            {entries.length ? (
              <div className="table-scroll">
                <table className="table">
                  <thead>
                    <tr>
                      <th className="date">Date</th>
                      <th>Description</th>
                      <th>Status</th>
                      <th className="amount">Debit</th>
                      <th className="amount">Credit</th>
                    </tr>
                  </thead>

                  <tbody>
                    {entries.map((entry) => {
                      const debit = entry.lines.reduce(
                        (sum, line) => sum + Number(line.debit),
                        0
                      );

                      const credit = entry.lines.reduce(
                        (sum, line) => sum + Number(line.credit),
                        0
                      );

                      return (
                        <tr key={entry.id}>
                          <td className="date">
                            {entry.entryDate.toLocaleDateString("en-ZA")}
                          </td>

                          <td>
                            <strong>
                              {entry.description || "Journal entry"}
                            </strong>
                          </td>

                          <td>
                            <span className="badge">
                              {entry.sourceType || "—"}
                            </span>
                          </td>

                          <td className="amount">
                            R{debit.toFixed(2)}
                          </td>

                          <td className="amount">
                            R{credit.toFixed(2)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>

                  <tfoot>
                    <tr>
                      <td colSpan={3} className="total-label">
                        Total
                      </td>

                      <td className="amount total-value">
                        R{totalDebits.toFixed(2)}
                      </td>

                      <td className="amount total-value">
                        R{totalCredits.toFixed(2)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            ) : (
              <div className="empty-state">
                No journal entries have been recorded yet.
              </div>
            )}
          </div>

          {/* REVIEW QUEUE */}
          <div className="card" id="review-queue">
            <div className="section-header">
              <div>
                <div className="section-title">
                  Review queue
                </div>
                <div className="metric-label">
                  Transactions requiring accountant review.
                </div>
              </div>

              <span
                className={
                  reviews.length > 0
                    ? "count-badge count-warning"
                    : "count-badge"
                }
              >
                {reviews.length}
              </span>
            </div>

            {reviews.length ? (
              <div>
                {reviews.map((review) => (
                  <div key={review.id} className="review-item">
                    <div className="review-title">
                      {review.title}
                    </div>

                    <div className="review-notes">
                      {review.notes || "No notes provided."}
                    </div>

                    <div className="page-actions">
                      <form action={reviewItem}>
                        <input
                          type="hidden"
                          name="reviewId"
                          value={review.id}
                        />

                        <button
                          className="primary-button"
                          name="status"
                          value="REVIEWED"
                          type="submit"
                        >
                          Approve
                        </button>
                      </form>

                      <form action={reviewItem}>
                        <input
                          type="hidden"
                          name="reviewId"
                          value={review.id}
                        />

                        <button
                          className="secondary-button"
                          name="status"
                          value="FLAGGED"
                          type="submit"
                        >
                          Flag
                        </button>
                      </form>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <div className="empty-state-title">
                  Review queue is clear
                </div>

                <div className="metric-label">
                  There are no pending accounting transactions.
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ACCOUNTING CONTROLS */}
        <div className="accounting-footer">
          <span>
            Double-entry accounting is enforced before journal entries
            are saved.
          </span>

          <span>
            Closed financial periods cannot accept new postings.
          </span>
        </div>
      </div>
    </WorkspaceShell>
  );
}