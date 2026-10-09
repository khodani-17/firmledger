"use client";

import { useState } from "react";
import { uploadDocument } from "@/app/document-actions";

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

type Client = {
  id: string;
  name: string | null;
};

type Matter = {
  id: string;
  matterNumber: string;
  title: string;
  clientId: string;
};

export default function DocumentUploadDrawer({
  clients,
  matters,
}: {
  clients: Client[];
  matters: Matter[];
}) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(formData: FormData) {
    setSubmitting(true);

    try {
      await uploadDocument(formData);
      setOpen(false);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-10 items-center gap-2 bg-slate-950 px-4 text-sm font-medium text-white transition hover:bg-slate-800"
      >
        <span className="text-base">+</span>
        Upload document
      </button>

      {open && (
        <div className="fixed inset-0 z-50">
          <button
            type="button"
            aria-label="Close"
            onClick={() => {
              if (!submitting) setOpen(false);
            }}
            className="absolute inset-0 bg-slate-950/40"
          />

          <aside className="absolute right-0 top-0 flex h-full w-full max-w-[480px] flex-col border-l border-slate-200 bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b border-slate-200 px-6 py-5">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                  Documents
                </div>

                <h2 className="mt-1 text-sm font-semibold text-slate-950">
                  Add document
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Upload a financial or supporting record.
                </p>
              </div>

              <button
                type="button"
                aria-label="Close"
                disabled={submitting}
                onClick={() => setOpen(false)}
                className="text-2xl leading-none text-slate-400 hover:text-slate-950 disabled:opacity-40"
              >
                ×
              </button>
            </div>

            <div className="flex-1 overflow-y-auto">
              <form
                id="document-upload-form"
                action={handleSubmit}
                className="space-y-7 px-6 py-6"
              >
                <section>
                  <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                    Document
                  </h3>

                  <div className="mt-4 space-y-5">
                    <div>
                      <label
                        htmlFor="document-file"
                        className="mb-2 block text-xs font-medium text-slate-700"
                      >
                        File
                      </label>

                      <input
                        id="document-file"
                        name="file"
                        type="file"
                        required
                        disabled={submitting}
                        className="block w-full border border-slate-300 bg-white px-3 py-2.5 text-sm file:mr-3 file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-xs file:font-medium"
                      />

                      <p className="mt-1.5 text-xs text-slate-400">
                        Maximum file size: 25 MB.
                      </p>
                    </div>

                    <div>
                      <label
                        htmlFor="document-type"
                        className="mb-2 block text-xs font-medium text-slate-700"
                      >
                        Document type
                      </label>

                      <select
                        id="document-type"
                        name="documentType"
                        defaultValue="OTHER"
                        required
                        disabled={submitting}
                        className="h-10 w-full border border-slate-300 bg-white px-3 text-sm outline-none focus:border-slate-700 focus:ring-1 focus:ring-slate-700"
                      >
                        {DOCUMENT_TYPES.map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </section>

                <section className="border-t border-slate-200 pt-6">
                  <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                    Record association
                  </h3>

                  <div className="mt-4 space-y-5">
                    <div>
                      <label
                        htmlFor="document-client"
                        className="mb-2 block text-xs font-medium text-slate-700"
                      >
                        Client
                      </label>

                      <select
                        id="document-client"
                        name="clientId"
                        defaultValue=""
                        disabled={submitting}
                        className="h-10 w-full border border-slate-300 bg-white px-3 text-sm outline-none focus:border-slate-700 focus:ring-1 focus:ring-slate-700"
                      >
                        <option value="">No client selected</option>

                        {clients.map((client) => (
                          <option key={client.id} value={client.id}>
                            {client.name ?? "Unnamed client"}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label
                        htmlFor="document-matter"
                        className="mb-2 block text-xs font-medium text-slate-700"
                      >
                        Matter
                      </label>

                      <select
                        id="document-matter"
                        name="matterId"
                        defaultValue=""
                        disabled={submitting}
                        className="h-10 w-full border border-slate-300 bg-white px-3 text-sm outline-none focus:border-slate-700 focus:ring-1 focus:ring-slate-700"
                      >
                        <option value="">No matter selected</option>

                        {matters.map((matter) => (
                          <option key={matter.id} value={matter.id}>
                            {matter.matterNumber} — {matter.title}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </section>

                <section className="border-t border-slate-200 pt-6">
                  <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                    Description
                  </h3>

                  <div className="mt-4">
                    <textarea
                      id="document-description"
                      name="description"
                      rows={5}
                      disabled={submitting}
                      placeholder="Describe the document or its purpose..."
                      className="w-full resize-none border border-slate-300 px-3 py-2.5 text-sm outline-none placeholder:text-slate-400 focus:border-slate-700 focus:ring-1 focus:ring-slate-700"
                    />
                  </div>
                </section>
              </form>
            </div>

            <div className="flex justify-end gap-3 border-t border-slate-200 bg-white px-6 py-2">
              <button
                type="button"
                disabled={submitting}
                onClick={() => setOpen(false)}
                className="h-10 px-4 text-sm font-medium text-slate-600 hover:text-slate-950 disabled:opacity-40"
              >
                Cancel
              </button>

              <button
                form="document-upload-form"
                type="submit"
                disabled={submitting}
                className="h-10 bg-slate-950 px-5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
              >
                {submitting ? "Uploading..." : "Upload document"}
              </button>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}