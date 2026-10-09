import Link from "next/link";
import { requireRole } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { createExpense } from "@/app/actions";
import WorkspaceShell from "@/app/workspace-shell";

export default async function NewExpense() {
  const user = await requireRole([
    "OWNER",
    "ADMIN",
    "FINANCE",
    "ACCOUNTANT",
  ]);

  const [clients, matters, banks] = await Promise.all([
    prisma.client.findMany({
      where: {
        firmId: user.firmId,
        active: true,
      },
      orderBy: {
        displayName: "asc",
      },
    }),

    prisma.matter.findMany({
      where: {
        firmId: user.firmId,
        status: {
          not: "ARCHIVED",
        },
      },
      include: {
        client: true,
      },
      orderBy: {
        matterNumber: "asc",
      },
    }),

    prisma.bankAccount.findMany({
      where: {
        firmId: user.firmId,
        active: true,
      },
      orderBy: {
        name: "asc",
      },
    }),
  ]);

  return (
    <WorkspaceShell user={user}>
      <div className="page">
        <div className="page-header">
          <div>
            <h1 className="page-title">Record expense</h1>

            <p className="page-subtitle">
              Capture a paid expense and post the bank, expense and input-VAT
              entries together.
            </p>
          </div>

          <Link
            href="/expenses"
            className="secondary-button"
          >
            Back to Expenses
          </Link>
        </div>

        <div className="card form-card" style={{ marginTop: 24 }}>
          <form action={createExpense}>
            <label>
              Description

              <input
                name="description"
                required
                placeholder="Court filing fee"
              />
            </label>

            <label>
              Client (optional)

              <select name="clientId" defaultValue="">
                <option value="">Firm expense</option>

                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.displayName} — {client.clientCode}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Matter (optional)

              <select name="matterId" defaultValue="">
                <option value="">No matter</option>

                {matters.map((matter) => (
                  <option key={matter.id} value={matter.id}>
                    {matter.matterNumber} — {matter.client.displayName} —{" "}
                    {matter.title}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Net amount

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
              Input VAT

              <input
                name="taxAmount"
                type="number"
                min="0"
                step="0.01"
                defaultValue="0"
              />
            </label>

            <label>
              Paid from

              <select name="bankAccountId" required defaultValue="">
                <option value="" disabled>
                  Select bank account
                </option>

                {banks.map((bank) => (
                  <option key={bank.id} value={bank.id}>
                    {bank.name}
                    {bank.bankName ? ` — ${bank.bankName}` : ""}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Reference

              <input
                name="reference"
                placeholder="Supplier / EFT reference"
              />
            </label>

            <div className="form-actions">
              <Link
                href="/expenses"
                className="secondary-button"
              >
                Cancel
              </Link>

              <button
                className="primary-button"
                type="submit"
              >
                Post expense
              </button>
            </div>
          </form>
        </div>
      </div>
    </WorkspaceShell>
  );
}