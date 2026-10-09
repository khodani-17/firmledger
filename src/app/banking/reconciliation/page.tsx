import { requireRole } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import {
  addBankTransaction,
  reconcileBankTransaction,
} from "@/app/actions";
import WorkspaceShell from "@/app/workspace-shell";

export default async function Reconciliation() {
  const u = await requireRole([
    "OWNER",
    "ADMIN",
    "FINANCE",
    "ACCOUNTANT",
  ]);

  const [rows, banks, payments] = await Promise.all([
    prisma.bankTransaction.findMany({
      where: {
        bankAccount: {
          firmId: u.firmId,
        },
        matched: false,
      },
      include: {
        bankAccount: true,
      },
      orderBy: {
        transactionDate: "desc",
      },
    }),

    prisma.bankAccount.findMany({
      where: {
        firmId: u.firmId,
        active: true,
      },
      orderBy: {
        name: "asc",
      },
    }),

    prisma.payment.findMany({
      where: {
        firmId: u.firmId,
        status: "COMPLETED",
        bankTransactions: {
          none: {},
        },
      },
      include: {
        client: true,
        invoice: true,
      },
      orderBy: {
        paymentDate: "desc",
      },
    }),
  ]);

  return (
    <WorkspaceShell user={u}>
      <div className="page">
        <div className="page-header">
          <div>
            <h1 className="page-title">Bank reconciliation</h1>
            <p className="page-subtitle">
              Match imported bank transactions to recorded client payments.
            </p>
          </div>
        </div>

        <div
          className="grid grid-2"
          style={{ marginTop: 24, alignItems: "start" }}
        >
          <div className="card">
            <div className="section-title">Add bank transaction</div>

            <form
              action={addBankTransaction}
              className="form-card"
              style={{ maxWidth: "none" }}
            >
              <label>
                Bank
                <select name="bankAccountId" required defaultValue="">
                  <option value="" disabled>
                    Select bank account
                  </option>
                  {banks.map((bank) => (
                    <option key={bank.id} value={bank.id}>
                      {bank.name}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Description
                <input
                  name="description"
                  required
                  placeholder="Incoming EFT"
                />
              </label>

              <label>
                Reference
                <input
                  name="reference"
                  placeholder="Bank reference"
                />
              </label>

              <label>
                Amount
                <input
                  name="amount"
                  type="number"
                  min="0.01"
                  step="0.01"
                  required
                  placeholder="0.00"
                />
              </label>

              <label>
                Type
                <select name="type" defaultValue="CREDIT">
                  <option value="CREDIT">Credit / money in</option>
                  <option value="DEBIT">Debit / money out</option>
                </select>
              </label>

              <button className="primary-button" type="submit">
                Add transaction
              </button>
            </form>
          </div>

          <div className="card">
            <div className="section-title">Unmatched transactions</div>

            {rows.length > 0 ? (
              <div>
                {rows.map((transaction) => {
                  const matchingPayments = payments.filter(
                    (payment) =>
                      Math.abs(
                        Number(payment.amount) -
                          Number(transaction.amount)
                      ) < 0.001
                  );

                  return (
                    <div
                      key={transaction.id}
                      style={{
                        borderBottom: "1px solid var(--border)",
                        padding: "14px 0",
                      }}
                    >
                      <strong>{transaction.description}</strong>

                      <div className="metric-label" style={{ marginTop: 4 }}>
                        {transaction.bankAccount.name}
                        {" · "}
                        {transaction.reference || "No reference"}
                        {" · "}
                        R{Number(transaction.amount).toFixed(2)}
                      </div>

                      {transaction.type === "CREDIT" ? (
                        <form
                          action={reconcileBankTransaction}
                          style={{
                            marginTop: 10,
                            display: "flex",
                            gap: 8,
                            alignItems: "center",
                            flexWrap: "wrap",
                          }}
                        >
                          <input
                            type="hidden"
                            name="bankTransactionId"
                            value={transaction.id}
                          />

                          <select
                            name="paymentId"
                            required
                            defaultValue=""
                            style={{
                              flex: "1 1 220px",
                              minWidth: 0,
                            }}
                          >
                            <option value="" disabled>
                              Select matching payment
                            </option>

                            {matchingPayments.map((payment) => (
                              <option key={payment.id} value={payment.id}>
                                {payment.invoice?.invoiceNumber || "Payment"}
                                {" — "}
                                {payment.client?.displayName || "Client"}
                                {" — R"}
                                {Number(payment.amount).toFixed(2)}
                              </option>
                            ))}
                          </select>

                          <button
                            className="primary-button"
                            type="submit"
                            disabled={matchingPayments.length === 0}
                          >
                            Match
                          </button>
                        </form>
                      ) : (
                        <div style={{ marginTop: 10 }}>
                          <span className="badge">
                            Debit — manual review
                          </span>
                        </div>
                      )}

                      {transaction.type === "CREDIT" &&
                        matchingPayments.length === 0 && (
                          <p className="page-subtitle" style={{ marginTop: 8 }}>
                            No completed unmatched payments with the same
                            amount were found.
                          </p>
                        )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="page-subtitle">
                No unmatched transactions. Your bank transactions are up to
                date.
              </p>
            )}
          </div>
        </div>
      </div>
    </WorkspaceShell>
  );
}