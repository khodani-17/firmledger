import { requireRole } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { createTaxReturn } from "@/app/actions";
import WorkspaceShell from "@/app/workspace-shell";

export default async function Tax() {
  const user = await requireRole([
    "OWNER",
    "ADMIN",
    "FINANCE",
    "ACCOUNTANT",
  ]);

  const rows = await prisma.taxReturn.findMany({
    where: { firmId: user.firmId },
    orderBy: { periodEnd: "desc" },
  });

  return (
    <WorkspaceShell user={user}>
      <main className="page">
        <div className="page-header">
          <div>
            <h1 className="page-title">Tax Returns</h1>
            <p className="page-subtitle">
              Prepare and review your firm&apos;s tax returns.
            </p>
          </div>
        </div>

        <section className="card compact-card">
          <div className="section-title">Prepare Tax Return</div>

          <form
            action={createTaxReturn}
            className="form-grid"
          >
            <label>
              <span>Return Type</span>
              <select name="returnType" defaultValue="VAT201">
                <option>VAT201</option>
                <option>Income Tax</option>
                <option>Other</option>
              </select>
            </label>

            <label>
              <span>Period Start</span>
              <input
                name="periodStart"
                type="date"
                required
              />
            </label>

            <label>
              <span>Period End</span>
              <input
                name="periodEnd"
                type="date"
                required
              />
            </label>

            <div className="form-actions">
              <button type="submit" className="button-primary">
                Prepare Return
              </button>
            </div>
          </form>
        </section>

        <section className="card compact-card">
          <div className="section-heading">
            <h2 className="section-title">Tax Returns</h2>
            <span className="muted">
              {rows.length} {rows.length === 1 ? "return" : "returns"}
            </span>
          </div>

          {rows.length === 0 ? (
            <div className="empty-state">
              <p>No tax returns prepared</p>
              <span>
                Prepare a return above to see it here.
              </span>
            </div>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Return</th>
                    <th>Period</th>
                    <th className="text-right">Output VAT</th>
                    <th className="text-right">Input VAT</th>
                    <th className="text-right">Net VAT</th>
                    <th>Status</th>
                  </tr>
                </thead>

                <tbody>
                  {rows.map((taxReturn) => (
                    <tr key={taxReturn.id}>
                      <td className="font-medium">
                        {taxReturn.returnType}
                      </td>

                      <td>
                        {taxReturn.periodStart.toLocaleDateString("en-ZA")}
                        {" – "}
                        {taxReturn.periodEnd.toLocaleDateString("en-ZA")}
                      </td>

                      <td className="text-right tabular-nums">
                        R{Number(taxReturn.outputVat).toFixed(2)}
                      </td>

                      <td className="text-right tabular-nums">
                        R{Number(taxReturn.inputVat).toFixed(2)}
                      </td>

                      <td className="text-right tabular-nums font-medium">
                        R{Number(taxReturn.netVat).toFixed(2)}
                      </td>

                      <td>
                        <span className="badge">
                          {taxReturn.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </WorkspaceShell>
  );
}