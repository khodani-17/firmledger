import Link from "next/link";
import { createBankAccount } from "@/app/actions";
import { requireRole } from "@/lib/permissions";
import WorkspaceShell from "@/app/workspace-shell";

const SOUTH_AFRICAN_BANKS = [
  "ABSA Bank",
  "First National Bank (FNB)",
  "Nedbank",
  "Standard Bank",
  "Capitec Bank",
] as const;

export default async function NewBankAccountPage() {
  const user = await requireRole([
    "OWNER",
    "ADMIN",
    "FINANCE",
    "ACCOUNTANT",
  ]);

  return (
    <WorkspaceShell user={user}>
      <div className="page">
        <div className="page-header">
          <div>
            <p className="eyebrow">BANKING</p>

            <h1 className="page-title">
              Add bank account
            </h1>

            <p className="page-subtitle">
              Add a business bank account for receipts, payments and
              reconciliation.
            </p>
          </div>

          <Link
            href="/banking"
            className="secondary-button"
          >
            Back to Banking
          </Link>
        </div>

        <div className="card form-card">
          <form action={createBankAccount}>
            <div className="form-grid">
              <div className="form-field">
                <label htmlFor="name">
                  Account name
                </label>

                <input
                  id="name"
                  name="name"
                  type="text"
                  placeholder="e.g. Business Current Account"
                  required
                />

                <p className="field-help">
                  Give the account a name that your firm will easily
                  recognise.
                </p>
              </div>

              <div className="form-field">
                <label htmlFor="bankName">
                  Bank
                </label>

                <select
                  id="bankName"
                  name="bankName"
                  defaultValue=""
                  required
                >
                  <option value="" disabled>
                    Select bank
                  </option>

                  {SOUTH_AFRICAN_BANKS.map((bank) => (
                    <option key={bank} value={bank}>
                      {bank}
                    </option>
                  ))}
                </select>

                <p className="field-help">
                  Select the South African bank where the account is held.
                </p>
              </div>

              <div className="form-field">
                <label htmlFor="accountNumber">
                  Account number
                </label>

                <input
                  id="accountNumber"
                  name="accountNumber"
                  type="text"
                  inputMode="numeric"
                  placeholder="Enter account number"
                  autoComplete="off"
                />

                <p className="field-help">
                  Optional. Enter the account number used for reconciliation
                  and payment identification.
                </p>
              </div>

              <div className="form-field">
                <label htmlFor="accountType">
                  Account type
                </label>

                <select
                  id="accountType"
                  name="accountType"
                  defaultValue="BUSINESS_CURRENT"
                >
                  <option value="BUSINESS_CURRENT">
                    Business Current
                  </option>

                  <option value="CURRENT">
                    Current
                  </option>

                  <option value="SAVINGS">
                    Savings
                  </option>

                  <option value="OTHER">
                    Other
                  </option>
                </select>
              </div>

              <div className="form-field">
                <label htmlFor="currency">
                  Currency
                </label>

                <select
                  id="currency"
                  name="currency"
                  defaultValue="ZAR"
                >
                  <option value="ZAR">
                    South African Rand (ZAR)
                  </option>
                </select>

                <p className="field-help">
                  FirmLedger currently uses ZAR as the default operating
                  currency.
                </p>
              </div>
            </div>

            <div className="form-notice">
              <strong>Business banking only</strong>

              <p>
                This form is for ordinary business bank accounts. Trust
                banking must be created and managed through the dedicated
                Trust Accounts module.
              </p>
            </div>

            <div className="form-actions">
              <Link
                href="/banking"
                className="secondary-button"
              >
                Cancel
              </Link>

              <button
                type="submit"
                className="primary-button"
              >
                Add bank account
              </button>
            </div>
          </form>
        </div>
      </div>
    </WorkspaceShell>
  );
}