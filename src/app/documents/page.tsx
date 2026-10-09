import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/permissions";
import { archiveDocument } from "@/app/document-actions";
import DocumentUploadDrawer from "./DocumentUploadDrawer";
import WorkspaceShell from "@/app/workspace-shell";

const DOCUMENT_TYPES = [
  ["BANK_STATEMENT", "Bank statement"],
  ["SUPPLIER_INVOICE", "Supplier invoice"],
  ["RECEIPT", "Receipt"],
  ["PROOF_OF_PAYMENT", "Proof of payment"],
  ["TAX_DOCUMENT", "Tax document"],
  ["EXPENSE_RECEIPT", "Expense receipt"],
  ["CONTRACT", "Contract"],
  ["ACCOUNTING_SCHEDULE", "Accounting schedule"],
  ["VAT_DOCUMENT", "VAT document"],
  ["INVOICE", "Invoice"],
  ["CREDIT_NOTE", "Credit note"],
  ["TRUST_DOCUMENT", "Trust document"],
  ["FINANCIAL_STATEMENT", "Financial statement"],
  ["OTHER", "Other"],
] as const;

function labelDocumentType(value: string) {
  const match = DOCUMENT_TYPES.find(([type]) => type === value);
  return match?.[1] ?? value;
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("en-ZA", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(value);
}

function statusClass(status: string) {
  switch (status) {
    case "ACTIVE":
      return "status-badge status-paid";
    case "ARCHIVED":
      return "status-badge status-neutral";
    default:
      return "status-badge status-neutral";
  }
}

type SearchParams = {
  q?: string;
  type?: string;
  client?: string;
  matter?: string;
};

export default async function DocumentsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const user = await requireRole([
    "OWNER",
    "ADMIN",
    "FINANCE",
    "LAWYER",
    "STAFF",
  ]);

  const params = await searchParams;

  const q = String(params.q ?? "").trim();
  const type = String(params.type ?? "").trim();
  const clientId = String(params.client ?? "").trim();
  const matterId = String(params.matter ?? "").trim();

  const where = {
    firmId: user.firmId,
    ...(q
      ? {
          OR: [
            {
              originalName: {
                contains: q,
                mode: "insensitive" as const,
              },
            },
            {
              description: {
                contains: q,
                mode: "insensitive" as const,
              },
            },
          ],
        }
      : {}),
    ...(type
      ? {
          documentType: type as any,
        }
      : {}),
    ...(clientId
      ? {
          clientId,
        }
      : {}),
    ...(matterId
      ? {
          matterId,
        }
      : {}),
  };

  const [documents, clients, matters] = await Promise.all([
    prisma.document.findMany({
      where,
      orderBy: {
        createdAt: "desc",
      },
      include: {
        client: {
          select: {
            id: true,
            name: true,
          },
        },
        matter: {
          select: {
            id: true,
            matterNumber: true,
            title: true,
          },
        },
      },
    }),

    prisma.client.findMany({
      where: {
        firmId: user.firmId,
      },
      select: {
        id: true,
        name: true,
      },
      orderBy: {
        name: "asc",
      },
    }),

    prisma.matter.findMany({
      where: {
        firmId: user.firmId,
      },
      select: {
        id: true,
        matterNumber: true,
        title: true,
        clientId: true,
      },
      orderBy: {
        matterNumber: "asc",
      },
    }),
  ]);

  return (
    <WorkspaceShell user={user}>
      <div className="page">
        <div className="page-header">
          <div>
            <p className="metric-label">DOCUMENT MANAGEMENT</p>

            <h1 className="page-title">Documents</h1>

            <p className="page-subtitle">
              Store, find, review and archive firm documents.
            </p>
          </div>

          <div className="page-actions">
            <DocumentUploadDrawer
              clients={clients}
              matters={matters}
            />
          </div>
        </div>

        <section className="card">
          <div className="section-header">
            <div>
              <h2 className="section-title">
                Search documents
              </h2>

              <p className="section-description">
                Filter documents by name, type, client or matter.
              </p>
            </div>
          </div>

          <form method="GET">
            <div className="ledger-filter-grid">
              <div className="ledger-filter-field">
                <label htmlFor="document-search">
                  Search
                </label>

                <input
                  id="document-search"
                  name="q"
                  defaultValue={q}
                  placeholder="Document name or description"
                />
              </div>

              <div className="ledger-filter-field">
                <label htmlFor="document-type-filter">
                  Type
                </label>

                <select
                  id="document-type-filter"
                  name="type"
                  defaultValue={type}
                >
                  <option value="">All types</option>

                  {DOCUMENT_TYPES.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="ledger-filter-field">
                <label htmlFor="document-client-filter">
                  Client
                </label>

                <select
                  id="document-client-filter"
                  name="client"
                  defaultValue={clientId}
                >
                  <option value="">All clients</option>

                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.name ?? "Unnamed client"}
                    </option>
                  ))}
                </select>
              </div>

              <div className="ledger-filter-field">
                <label htmlFor="document-matter-filter">
                  Matter
                </label>

                <select
                  id="document-matter-filter"
                  name="matter"
                  defaultValue={matterId}
                >
                  <option value="">All matters</option>

                  {matters.map((matter) => (
                    <option key={matter.id} value={matter.id}>
                      {matter.matterNumber} — {matter.title}
                    </option>
                  ))}
                </select>
              </div>

              <div className="ledger-filter-actions">
                <button
                  type="submit"
                  className="primary-button"
                >
                  Search
                </button>

                <Link
                  href="/documents"
                  className="secondary-button"
                >
                  Clear
                </Link>
              </div>
            </div>
          </form>
        </section>

        <section className="card">
          <div className="section-header">
            <div>
              <h2 className="section-title">
                Document register
              </h2>

              <p className="section-description">
                {documents.length}{" "}
                {documents.length === 1
                  ? "document"
                  : "documents"}{" "}
                found.
              </p>
            </div>
          </div>

          {documents.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-title">
                No documents found
              </div>

              <p className="empty-state-text">
                Upload a document or change the search filters.
              </p>
            </div>
          ) : (
            <div className="table-scroll">
              <table className="table">
                <thead>
                  <tr>
                    <th>Document</th>
                    <th>Type</th>
                    <th>Client</th>
                    <th>Matter</th>
                    <th>Added</th>
                    <th>Status</th>
                    <th className="numeric">Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {documents.map((document) => (
                    <tr key={document.id}>
                      <td>
                        <div className="nowrap">
                          <div className="font-medium">
                            {document.originalName}
                          </div>

                          {document.description && (
                            <div className="text-muted">
                              {document.description}
                            </div>
                          )}
                        </div>
                      </td>

                      <td className="nowrap">
                        {labelDocumentType(document.documentType)}
                      </td>

                      <td>
                        {document.client?.name ?? "—"}
                      </td>

                      <td>
                        {document.matter ? (
                          <div className="nowrap">
                            <div className="font-medium">
                              {document.matter.matterNumber}
                            </div>

                            <div className="text-muted">
                              {document.matter.title}
                            </div>
                          </div>
                        ) : (
                          "—"
                        )}
                      </td>

                      <td className="date">
                        {formatDate(document.createdAt)}
                      </td>

                      <td>
                        <span
                          className={statusClass(document.status)}
                        >
                          {document.status}
                        </span>
                      </td>

                      <td className="numeric">
                        <div className="page-actions">
                          <Link
                            href={`/api/documents/${document.id}`}
                            className="secondary-button"
                          >
                            Open
                          </Link>

                          {document.status === "ACTIVE" && (
                            <form action={archiveDocument}>
                              <input
                                type="hidden"
                                name="documentId"
                                value={document.id}
                              />

                              <button
                                type="submit"
                                className="secondary-button"
                              >
                                Archive
                              </button>
                            </form>
                          )}
                        </div>
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