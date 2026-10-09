"use client";

import { useFormStatus } from "react-dom";

export default function SubmitInvoiceButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      className="primary-button"
      disabled={pending}
      aria-disabled={pending}
    >
      {pending ? "Issuing invoice..." : "Issue invoice"}
    </button>
  );
}