import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import ReconciliationActions from "./reconciliation-actions";
import WorkspaceShell from "@/app/workspace-shell";

function formatMoney(value: number) {
  return `R ${value.toLocaleString("en-ZA", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export default async function TrustReconciliationDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireRole([
    "OWNER",
    "ADMIN",
    "FINANCE",
    "ACCOUNTANT",
  ]);

  const { id } = await params;

  const reconciliation =
    await prisma.trustReconciliation.findFirst({
      where: {
        id,
        firmId: user.firmId,
      },
      include: {
        trustAccount: true,
      },
    });

  if (!reconciliation) {
    notFound();
  }

  const difference = Number(reconciliation.difference);
  const balanced = Math.abs(difference) < 0.01;

  return (
    <WorkspaceShell user={user}>
      <main className="page">
        <div className="page-header">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href="/trust/reconciliation"
                className="text-link"
              >
                ← Reconciliation
              </Link>

              <span className="text-slate-500">/</span>

              <h1 className="page-title">
                Reconciliation detail
              </h1>
            </div>

            <p className="page-subtitle">
              Review the trust account balances and reconciliation result.
            </p>
          </div>

          <div className="page-actions">
            <Link href="/trust" className="button">
              Trust overview
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="card">
            <div className="metric-label">Trust account</div>
            <div className="mt-1 truncate text-sm font-semibold">
              {reconciliation.trustAccount.name}
            </div>
          </div>

          <div className="card">
            <div className="metric-label">Statement balance</div>
            <div className="mt-1 text-sm font-semibold tabular-nums">
              {formatMoney(
                Number(reconciliation.statementBalance)
              )}
            </div>
          </div>

          <div className="card">
            <div className="metric-label">Ledger balance</div>
            <div className="mt-1 text-sm font-semibold tabular-nums">
              {formatMoney(
                Number(reconciliation.ledgerBalance)
              )}
            </div>
          </div>

          <div className="card">
            <div className="metric-label">Difference</div>
            <div className="mt-1 text-sm font-semibold tabular-nums">
              {formatMoney(difference)}
            </div>
          </div>
        </div>

        <section className="card">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
            <h2 className="section-title">
              Reconciliation details
            </h2>

            <span className="badge">
              {reconciliation.status}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="table w-full">
              <tbody>
                <tr>
                  <th className="w-56">Trust account</th>
                  <td>{reconciliation.trustAccount.name}</td>
                </tr>

                <tr>
                  <th>Bank</th>
                  <td>
                    {reconciliation.trustAccount.bankName || "—"}
                  </td>
                </tr>

                <tr>
                  <th>Account number</th>
                  <td>
                    {reconciliation.trustAccount.accountNumber || "—"}
                  </td>
                </tr>

                <tr>
                  <th>Reconciliation date</th>
                  <td>
                    {new Date(
                      reconciliation.reconciliationDate
                    ).toLocaleDateString("en-ZA")}
                  </td>
                </tr>

                <tr>
                  <th>Statement balance</th>
                  <td className="text-right font-medium tabular-nums">
                    {formatMoney(
                      Number(reconciliation.statementBalance)
                    )}
                  </td>
                </tr>

                <tr>
                  <th>Ledger balance</th>
                  <td className="text-right font-medium tabular-nums">
                    {formatMoney(
                      Number(reconciliation.ledgerBalance)
                    )}
                  </td>
                </tr>

                <tr>
                  <th>Difference</th>
                  <td className="text-right font-semibold tabular-nums">
                    {formatMoney(difference)}
                  </td>
                </tr>

                <tr>
                  <th>Result</th>
                  <td>
                    <span className="badge">
                      {balanced
                        ? "BALANCED"
                        : "DIFFERENCE REQUIRES INVESTIGATION"}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section className="card">
          <div className="border-b border-slate-200 px-4 py-3">
            <h2 className="section-title">
              Reconciliation controls
            </h2>
          </div>

          <div className="p-4">
            <ReconciliationActions
              reconciliationId={reconciliation.id}
              status={reconciliation.status}
              difference={difference}
              initialNotes={reconciliation.notes || ""}
            />
          </div>
        </section>
      </main>
    </WorkspaceShell>
  );
}