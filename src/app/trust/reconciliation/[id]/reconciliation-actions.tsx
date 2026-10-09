"use client";

import { useState, useTransition } from "react";
import {
  completeTrustReconciliation,
  startTrustReconciliation,
  updateTrustReconciliationNotes,
} from "./actions";

type Props = {
  reconciliationId: string;
  status: "OPEN" | "IN_PROGRESS" | "COMPLETED";
  difference: number;
  initialNotes: string;
};

export default function ReconciliationActions({
  reconciliationId,
  status,
  difference,
  initialNotes,
}: Props) {
  const [isPending, startTransition] =
    useTransition();

  const [notes, setNotes] =
    useState(initialNotes);

  const [error, setError] =
    useState<string | null>(null);

  function run(action: () => Promise<void>) {
    setError(null);

    startTransition(async () => {
      try {
        await action();
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "An unexpected error occurred.",
        );
      }
    });
  }

  function saveNotes() {
    run(() =>
      updateTrustReconciliationNotes(
        reconciliationId,
        notes,
      ),
    );
  }

  function startReconciliation() {
    run(() =>
      startTrustReconciliation(
        reconciliationId,
      ),
    );
  }

  function completeReconciliation() {
    run(() =>
      completeTrustReconciliation(
        reconciliationId,
      ),
    );
  }

  const balanced =
    Math.abs(difference) < 0.01;

  return (
    <div className="stack">
      <div className="form-field">
        <label htmlFor="reconciliation-notes">
          Notes
        </label>

        <textarea
          id="reconciliation-notes"
          rows={5}
          value={notes}
          disabled={
            isPending || status === "COMPLETED"
          }
          onChange={(event) =>
            setNotes(event.target.value)
          }
          placeholder="Add reconciliation notes..."
        />
      </div>

      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      <div className="form-actions">
        {status !== "COMPLETED" && (
          <button
            type="button"
            className="button"
            disabled={isPending}
            onClick={saveNotes}
          >
            {isPending
              ? "Saving..."
              : "Save Notes"}
          </button>
        )}

        {status === "OPEN" && (
          <button
            type="button"
            className="button primary"
            disabled={isPending}
            onClick={startReconciliation}
          >
            {isPending
              ? "Starting..."
              : "Start Reconciliation"}
          </button>
        )}

        {status === "IN_PROGRESS" && (
          <button
            type="button"
            className="button primary"
            disabled={
              isPending || !balanced
            }
            onClick={completeReconciliation}
            title={
              balanced
                ? "Complete reconciliation"
                : "The difference must be zero"
            }
          >
            {isPending
              ? "Completing..."
              : "Complete Reconciliation"}
          </button>
        )}
      </div>

      {!balanced &&
        status !== "COMPLETED" && (
          <div className="card">
            <div className="card-label">
              Reconciliation Difference
            </div>

            <p>
              The reconciliation cannot be completed
              while the difference is{" "}
              <strong>
                R{" "}
                {difference.toLocaleString(
                  "en-ZA",
                  {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  },
                )}
              </strong>
              .
            </p>
          </div>
        )}

      {balanced &&
        status !== "COMPLETED" && (
          <div className="card">
            <div className="card-label">
              Reconciliation Balanced
            </div>

            <p>
              The statement and ledger balances agree.
              The reconciliation can be completed.
            </p>
          </div>
        )}
    </div>
  );
}