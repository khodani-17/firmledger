import Link from "next/link";
import { createMatter } from "@/app/actions";
import { requireRole } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import WorkspaceShell from "@/app/workspace-shell";

export default async function NewMatter() {
  const user = await requireRole([
    "OWNER",
    "ADMIN",
    "FINANCE",
    "LAWYER",
    "STAFF",
  ]);

  const clients = await prisma.client.findMany({
    where: {
      firmId: user.firmId,
      active: true,
    },
    orderBy: {
      displayName: "asc",
    },
  });

  return (
    <WorkspaceShell user={user}>
      <div className="page">
        <div className="page-header">
          <div>
            <h1 className="page-title">New matter</h1>

            <p className="page-subtitle">
              Create a matter before billing or recording disbursements.
            </p>
          </div>

          <Link
            href="/matters"
            className="secondary-button"
          >
            Back to Matters
          </Link>
        </div>

        <div className="card form-card">
          <form action={createMatter}>
            <label>
              Client

              <select name="clientId" required defaultValue="">
                <option value="" disabled>
                  Select client
                </option>

                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.displayName} ({client.clientCode})
                  </option>
                ))}
              </select>
            </label>

            <label>
              Matter title

              <input
                name="title"
                required
                placeholder="e.g. Mokoena v Mokoena"
              />
            </label>

            <label>
              Description

              <textarea
                name="description"
                rows={4}
              />
            </label>

            <div className="form-actions">
              <Link
                href="/matters"
                className="secondary-button"
              >
                Cancel
              </Link>

              <button
                type="submit"
                className="primary-button"
              >
                Create matter
              </button>
            </div>
          </form>
        </div>
      </div>
    </WorkspaceShell>
  );
}