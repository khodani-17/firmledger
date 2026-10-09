"use client";

import { useState, useTransition } from "react";
import {
  closeFinancialPeriod,
  lockFinancialPeriod,
} from "./actions";

type PeriodStatus = "OPEN" | "CLOSED" | "LOCKED";

export default function PeriodActions({
  periodId,
  status,
}: {
  periodId: string;
  status: PeriodStatus;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleClose() {
    const confirmed = window.confirm(
      "Close this financial period?\n\nAfter closing, normal accounting activity should no longer be posted to this period.",
    );

    if (!confirmed) return;

    setError(null);

    startTransition(async () => {
      try {
        await closeFinancialPeriod(periodId);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Unable to close the financial period.",
        );
      }
    });
  }

  function handleLock() {
    const confirmed = window.confirm(
      "Lock this financial period?\n\nA locked period should only be reopened through an authorised accounting control process.",
    );

    if (!confirmed) return;

    setError(null);

    startTransition(async () => {
      try {
        await lockFinancialPeriod(periodId);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Unable to lock the financial period.",
        );
      }
    });
  }

  if (status === "LOCKED") {
    return (
      <div className="text-xs font-medium text-rose-300">
        Locked
      </div>
    );
  }

  return (
    <div className="flex min-w-[150px] flex-col items-end gap-2">
      {status === "OPEN" && (
        <button
          type="button"
          onClick={handleClose}
          disabled={isPending}
          className="rounded-lg border border-amber-700/60 bg-amber-500/10 px-3 py-1.5 text-xs font-medium text-amber-300 transition hover:bg-amber-500/20 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPending ? "Closing..." : "Close Period"}
        </button>
      )}

      {status === "CLOSED" && (
        <button
          type="button"
          onClick={handleLock}
          disabled={isPending}
          className="rounded-lg border border-rose-700/60 bg-rose-500/10 px-3 py-1.5 text-xs font-medium text-rose-300 transition hover:bg-rose-500/20 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPending ? "Locking..." : "Lock Period"}
        </button>
      )}

      {error && (
        <div className="max-w-[220px] text-right text-xs leading-4 text-rose-300">
          {error}
        </div>
      )}
    </div>
  );
}