import Link from "next/link";
import { requireRole } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { createTrustReconciliation } from "./actions";
import WorkspaceShell from "@/app/workspace-shell";

export default async function NewTrustReconciliation() {
  const user = await requireRole([
    "OWNER",
    "ADMIN",
    "FINANCE",
    "ACCOUNTANT",
  ]);

  const accounts = await prisma.trustAccount.findMany({
    where: {
      firmId: user.firmId,
      active: true,
    },
    orderBy: {
      name: "asc",
    },
  });

  return (
    <WorkspaceShell user={user}>
      <main className="page">
        <div className="page-header">
          <div>
            <div className="flex items-center gap-2">
              <Link
                href="/trust/reconciliation"
                className="text-link"
              >
                ← Reconciliation
              </Link>
              <span className="text-slate-500">/</span>
              <h1 className="page-title">
                New reconciliation
              </h1>
            </div>

            <p className="page-subtitle">
              Reconcile a trust bank statement against posted ledger
              transactions.
            </p>
          </div>
        </div>

        <section className="card">
          <div className="border-b border-slate-200 px-4 py-3">
            <h2 className="section-title">
              Reconciliation details
            </h2>
          </div>

          {accounts.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <p className="text-sm font-semibold">
                No active trust accounts
              </p>

              <p className="mt-1 text-sm text-slate-500">
                Create a trust account before starting a reconciliation.
              </p>

              <div className="mt-4">
                <Link
                  href="/trust/new"
                  className="button primary"
                >
                  Create trust account
                </Link>
              </div>
            </div>
          ) : (
            <form
              action={createTrustReconciliation}
              className="form-grid p-4"
            >
              <div className="form-field">
                <label htmlFor="trustAccountId">
                  Trust account
                </label>

                <select
                  id="trustAccountId"
                  name="trustAccountId"
                  required
                  defaultValue=""
                >
                  <option value="" disabled>
                    Select trust account
                  </option>

                  {accounts.map((account) => (
                    <option
                      key={account.id}
                      value={account.id}
                    >
                      {account.name}
                      {account.bankName
                        ? ` — ${account.bankName}`
                        : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-field">
                <label htmlFor="reconciliationDate">
                  Reconciliation date
                </label>

                <input
                  id="reconciliationDate"
                  name="reconciliationDate"
                  type="date"
                  required
                />
              </div>

              <div className="form-field">
                <label htmlFor="statementBalance">
                  Bank statement balance
                </label>

                <input
                  id="statementBalance"
                  name="statementBalance"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  required
                />

                <small>
                  Enter the closing balance shown on the trust bank
                  statement.
                </small>
              </div>

              <div className="form-field form-field-full">
                <label htmlFor="notes">Notes</label>

                <textarea
                  id="notes"
                  name="notes"
                  rows={3}
                  placeholder="Optional reconciliation notes..."
                />
              </div>

              <div className="form-field form-field-full">
                <div className="rounded border border-slate-200 bg-slate-50 px-4 py-3">
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Ledger balance
                  </div>

                  <p className="mt-1 text-sm leading-5 text-slate-600">
                    FirmLedger calculates the ledger balance automatically
                    from POSTED trust transactions up to the reconciliation
                    date.
                  </p>
                </div>
              </div>

              <div className="form-actions form-field-full">
                <Link
                  className="button"
                  href="/trust/reconciliation"
                >
                  Cancel
                </Link>

                <button
                  className="button primary"
                  type="submit"
                >
                  Create reconciliation
                </button>
              </div>
            </form>
          )}
        </section>
      </main>
    </WorkspaceShell>
  );
}