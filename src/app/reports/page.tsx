import { requireRole } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import WorkspaceShell from "@/app/workspace-shell";

function money(value: number) {
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: "ZAR",
    minimumFractionDigits: 2,
  }).format(value);
}

export default async function Reports() {
  const user = await requireRole([
    "OWNER",
    "ADMIN",
    "FINANCE",
    "ACCOUNTANT",
  ]);

  const [lines, invoices, expenses, payments] = await Promise.all([
    prisma.journalLine.findMany({
      where: {
        journalEntry: {
          firmId: user.firmId,
        },
      },
      include: {
        ledgerAccount: true,
        journalEntry: true,
      },
    }),

    prisma.invoice.findMany({
      where: {
        firmId: user.firmId,
      },
      select: {
        total: true,
        amountPaid: true,
        balanceDue: true,
      },
    }),

    prisma.expense.findMany({
      where: {
        firmId: user.firmId,
        status: {
          not: "REJECTED",
        },
      },
      select: {
        amount: true,
        taxAmount: true,
      },
    }),

    prisma.payment.findMany({
      where: {
        firmId: user.firmId,
        status: "COMPLETED",
      },
      select: {
        amount: true,
      },
    }),
  ]);

  const accountTotals = new Map<
    string,
    {
      name: string;
      debit: number;
      credit: number;
      type: string;
    }
  >();

  for (const line of lines) {
    const current = accountTotals.get(line.ledgerAccountId) || {
      name: line.ledgerAccount.name,
      debit: 0,
      credit: 0,
      type: line.ledgerAccount.accountType ?? "",
    };

    current.debit += Number(line.debit);
    current.credit += Number(line.credit);

    accountTotals.set(line.ledgerAccountId, current);
  }

  const revenue = [...accountTotals.values()]
    .filter((account) => account.type === "REVENUE")
    .reduce(
      (sum, account) => sum + account.credit - account.debit,
      0,
    );

  const operatingExpenses = [...accountTotals.values()]
    .filter((account) => account.type === "EXPENSE")
    .reduce(
      (sum, account) => sum + account.debit - account.credit,
      0,
    );

  const receivables = invoices.reduce(
    (sum, invoice) => sum + Number(invoice.balanceDue),
    0,
  );

  const receipts = payments.reduce(
    (sum, payment) => sum + Number(payment.amount),
    0,
  );

  const expensesTotal = expenses.reduce(
    (sum, expense) =>
      sum + Number(expense.amount) + Number(expense.taxAmount),
    0,
  );

  const accounts = [...accountTotals.values()].sort((a, b) =>
    a.name.localeCompare(b.name),
  );

  const totalDebits = accounts.reduce(
    (sum, account) => sum + account.debit,
    0,
  );

  const totalCredits = accounts.reduce(
    (sum, account) => sum + account.credit,
    0,
  );

  return (
    <WorkspaceShell user={user}>
      <div className="page">
        <div className="page-header">
          <div>
            <p className="metric-label">FINANCE / REPORTING</p>

            <h1 className="page-title">Financial reports</h1>

            <p className="page-subtitle">
              Review revenue, operating expenses, receivables, cash
              activity and ledger balances.
            </p>
          </div>
        </div>

        <div className="grid grid-4">
          <div className="compact-card">
            <div className="metric-label">Revenue</div>

            <div className="metric-amount">
              {money(revenue)}
            </div>
          </div>

          <div className="compact-card">
            <div className="metric-label">
              Operating expenses
            </div>

            <div className="metric-amount">
              {money(operatingExpenses)}
            </div>
          </div>

          <div className="compact-card">
            <div className="metric-label">Net result</div>

            <div className="metric-amount">
              {money(revenue - operatingExpenses)}
            </div>
          </div>

          <div className="compact-card">
            <div className="metric-label">
              Accounts receivable
            </div>

            <div className="metric-amount">
              {money(receivables)}
            </div>
          </div>
        </div>

        <div className="grid grid-2">
          <div className="compact-card">
            <div className="metric-label">Cash receipts</div>

            <div className="metric-amount">
              {money(receipts)}
            </div>

            <p className="metric-caption">
              Completed client and other recorded payments.
            </p>
          </div>

          <div className="compact-card">
            <div className="metric-label">
              Expense cash outflow
            </div>

            <div className="metric-amount">
              {money(expensesTotal)}
            </div>

            <p className="metric-caption">
              Non-rejected expenses, including recorded tax amounts.
            </p>
          </div>
        </div>

        <section className="card">
          <div className="section-header">
            <div>
              <h2 className="section-title">Trial balance</h2>

              <p className="section-description">
                Debit and credit activity grouped by ledger account.
              </p>
            </div>

            <span className="metric-caption">
              {accounts.length}{" "}
              {accounts.length === 1 ? "account" : "accounts"}
            </span>
          </div>

          {accounts.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-title">
                No accounting activity
              </div>

              <p className="empty-state-text">
                Posted journal entries will appear here.
              </p>
            </div>
          ) : (
            <div className="table-scroll">
              <table className="table">
                <thead>
                  <tr>
                    <th>Account</th>
                    <th>Type</th>
                    <th className="numeric">Debit</th>
                    <th className="numeric">Credit</th>
                    <th className="numeric">Balance</th>
                  </tr>
                </thead>

                <tbody>
                  {accounts.map((account) => {
                    const balance = account.debit - account.credit;

                    return (
                      <tr key={account.name}>
                        <td>
                          <span className="font-medium">
                            {account.name}
                          </span>
                        </td>

                        <td className="nowrap">
                          {account.type}
                        </td>

                        <td className="numeric amount">
                          {money(account.debit)}
                        </td>

                        <td className="numeric amount">
                          {money(account.credit)}
                        </td>

                        <td className="numeric amount">
                          {money(Math.abs(balance))}{" "}
                          {balance >= 0 ? "Dr" : "Cr"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>

                <tfoot>
                  <tr>
                    <td colSpan={2}>Total</td>

                    <td className="numeric amount">
                      {money(totalDebits)}
                    </td>

                    <td className="numeric amount">
                      {money(totalCredits)}
                    </td>

                    <td className="numeric amount">
                      {money(Math.abs(totalDebits - totalCredits))}
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