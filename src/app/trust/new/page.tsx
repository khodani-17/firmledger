import Link from "next/link";
import {
  createTrustAccount,
  createTrustTransaction,
} from "@/app/actions";
import { requireRole } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import WorkspaceShell from "@/app/workspace-shell";

export default async function NewTrust({
  searchParams,
}: {
  searchParams: Promise<{ transaction?: string }>;
}) {
  const user = await requireRole([
    "OWNER",
    "ADMIN",
    "FINANCE",
    "ACCOUNTANT",
  ]);

  const [accounts, clients, matters] = await Promise.all([
    prisma.trustAccount.findMany({
      where: {
        firmId: user.firmId,
        active: true,
      },
      orderBy: { name: "asc" },
    }),

    prisma.client.findMany({
      where: {
        firmId: user.firmId,
        active: true,
      },
      orderBy: { displayName: "asc" },
    }),

    prisma.matter.findMany({
      where: {
        firmId: user.firmId,
        status: { not: "ARCHIVED" },
      },
      include: { client: true },
      orderBy: { matterNumber: "desc" },
    }),
  ]);

  await searchParams;

  return (
    <WorkspaceShell user={user}>
      <main className="page">
        <div className="page-header">
          <div>
            <Link href="/trust" className="text-link">
              ← Trust Accounting
            </Link>
            <h1 className="page-title">New Trust Entry</h1>
            <p className="page-subtitle">
              Set up a trust bank account or record a client-money transaction.
            </p>
          </div>
        </div>

        <div className="grid grid-2 compact-grid">
          <section className="card compact-card">
            <h2 className="section-title">New Trust Bank Account</h2>

            <form action={createTrustAccount} className="form-grid">
              <label>
                Name
                <input name="name" required />
              </label>

              <label>
                Bank
                <input name="bankName" />
              </label>

              <label>
                Account Number
                <input name="accountNumber" />
              </label>

              <div className="form-actions">
                <button className="button-primary" type="submit">
                  Create Trust Account
                </button>
              </div>
            </form>
          </section>

          <section className="card compact-card">
            <h2 className="section-title">
              Record Client-Money Transaction
            </h2>

            <form action={createTrustTransaction} className="form-grid">
              <label>
                Trust Account
                <select name="trustAccountId" required defaultValue="">
                  <option value="" disabled>
                    Select trust account
                  </option>
                  {accounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Client
                <select name="clientId" required defaultValue="">
                  <option value="" disabled>
                    Select client
                  </option>
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.displayName}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Matter
                <select name="matterId" defaultValue="">
                  <option value="">No matter</option>
                  {matters.map((matter) => (
                    <option key={matter.id} value={matter.id}>
                      {matter.matterNumber} · {matter.client.displayName}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Type
                <select name="type" defaultValue="RECEIPT">
                  <option value="RECEIPT">Receipt</option>
                  <option value="PAYMENT">Payment</option>
                  <option value="TRANSFER">Transfer</option>
                  <option value="INTEREST">Interest</option>
                  <option value="FEE">Fee</option>
                  <option value="REVERSAL">Reversal</option>
                </select>
              </label>

              <label>
                Amount
                <input
                  name="amount"
                  type="number"
                  min="0.01"
                  step="0.01"
                  required
                />
              </label>

              <label>
                Reference
                <input name="reference" />
              </label>

              <label>
                Description
                <input name="description" required />
              </label>

              <div className="form-actions">
                <button className="button-primary" type="submit">
                  Post Transaction
                </button>
              </div>
            </form>
          </section>
        </div>
      </main>
    </WorkspaceShell>
  );
}