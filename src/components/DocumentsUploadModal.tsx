"use client";

import { useState } from "react";
import { uploadDocument } from "@/app/document-actions";

type Client = {
  id: string;
  name: string | null;
};

type Matter = {
  id: string;
  title: string;
};

type DocumentsUploadModalProps = {
  clients: Client[];
  matters: Matter[];
  emptyState?: boolean;
};

export default function DocumentsUploadModal({
  clients,
  matters,
  emptyState = false,
}: DocumentsUploadModalProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
      >
        <svg
          viewBox="0 0 24 24"
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M12 5v14M5 12h14" />
        </svg>

        {emptyState
          ? "Upload your first document"
          : "Upload document"}
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="Close upload dialog"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm"
          />

          <div className="relative z-10 w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b border-slate-200 px-6 py-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Evidence vault
                </p>

                <h2 className="mt-1 text-xl font-semibold text-slate-950">
                  Upload document
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Add financial evidence and link it to the
                  relevant client or matter.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                aria-label="Close"
              >
                <svg
                  viewBox="0 0 24 24"
                  className="h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                >
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>

            <form
              action={uploadDocument}
              className="space-y-5 px-6 py-6"
            >
              <div>
                <label
                  htmlFor="document-file"
                  className="mb-2 block text-sm font-semibold text-slate-800"
                >
                  Document
                </label>

                <label
                  htmlFor="document-file"
                  className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center transition hover:border-slate-400 hover:bg-slate-100"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white text-slate-600 shadow-sm ring-1 ring-slate-200">
                    <svg
                      viewBox="0 0 24 24"
                      className="h-6 w-6"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.6"
                    >
                      <path d="M12 16V5" />
                      <path d="M8 9l4-4 4 4" />
                      <path d="M5 15v4h14v-4" />
                    </svg>
                  </div>

                  <p className="mt-4 text-sm font-semibold text-slate-800">
                    Choose a file to upload
                  </p>

                  <p className="mt-1 text-xs text-slate-400">
                    PDF, Word, Excel, PowerPoint, images or
                    text · Maximum 25 MB
                  </p>

                  <input
                    id="document-file"
                    name="file"
                    type="file"
                    required
                    className="sr-only"
                    accept=".pdf,.jpg,.jpeg,.png,.webp,.txt,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
                  />
                </label>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="document-type"
                    className="mb-2 block text-sm font-semibold text-slate-800"
                  >
                    Document type
                  </label>

                  <select
                    id="document-type"
                    name="documentType"
                    defaultValue="OTHER"
                    required
                    className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                  >
                    <option value="BANK_STATEMENT">
                      Bank Statement
                    </option>

                    <option value="SUPPLIER_INVOICE">
                      Supplier Invoice
                    </option>

                    <option value="RECEIPT">
                      Receipt
                    </option>

                    <option value="PROOF_OF_PAYMENT">
                      Proof of Payment
                    </option>

                    <option value="TAX_DOCUMENT">
                      Tax Document
                    </option>

                    <option value="EXPENSE_RECEIPT">
                      Expense Receipt
                    </option>

                    <option value="CONTRACT">
                      Contract
                    </option>

                    <option value="ACCOUNTING_SCHEDULE">
                      Accounting Schedule
                    </option>

                    <option value="VAT_DOCUMENT">
                      VAT Document
                    </option>

                    <option value="INVOICE">
                      Invoice
                    </option>

                    <option value="CREDIT_NOTE">
                      Credit Note
                    </option>

                    <option value="TRUST_DOCUMENT">
                      Trust Document
                    </option>

                    <option value="FINANCIAL_STATEMENT">
                      Financial Statement
                    </option>

                    <option value="OTHER">
                      Other
                    </option>
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="document-client"
                    className="mb-2 block text-sm font-semibold text-slate-800"
                  >
                    Client
                  </label>

                  <select
                    id="document-client"
                    name="clientId"
                    defaultValue=""
                    className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                  >
                    <option value="">
                      No client
                    </option>

                    {clients.map((client) => (
                      <option
                        key={client.id}
                        value={client.id}
                      >
                        {client.name ?? "Unnamed client"}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label
                  htmlFor="document-matter"
                  className="mb-2 block text-sm font-semibold text-slate-800"
                >
                  Matter
                </label>

                <select
                  id="document-matter"
                  name="matterId"
                  defaultValue=""
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                >
                  <option value="">
                    No matter
                  </option>

                  {matters.map((matter) => (
                    <option
                      key={matter.id}
                      value={matter.id}
                    >
                      {matter.title}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="document-description"
                  className="mb-2 block text-sm font-semibold text-slate-800"
                >
                  Description
                </label>

                <textarea
                  id="document-description"
                  name="description"
                  rows={3}
                  placeholder="Optional description or evidence note..."
                  className="w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                />
              </div>

              <div className="flex flex-col-reverse gap-3 border-t border-slate-200 pt-5 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
                >
                  Upload document
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}