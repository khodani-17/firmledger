"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function SignupPage() {
  const router = useRouter();

  const [firmName, setFirmName] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    const form = new FormData(event.currentTarget);

    const firm = String(form.get("firmName") || "").trim();
    const fullName = String(form.get("name") || "").trim();
    const userEmail = String(form.get("email") || "").trim();
    const userPassword = String(form.get("password") || "");
    const userConfirmPassword = String(
      form.get("confirmPassword") || ""
    );

    if (
      !firm ||
      !fullName ||
      !userEmail ||
      !userPassword ||
      !userConfirmPassword
    ) {
      setError("Please complete all required fields.");
      return;
    }

    if (userPassword !== userConfirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          firmName: firm,
          name: fullName,
          email: userEmail,
          password: userPassword,
          confirmPassword: userConfirmPassword,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Unable to create account.");
        setLoading(false);
        return;
      }

      router.replace("/");
      router.refresh();
    } catch (error) {
      console.error(error);
      setError("Unable to create account. Please try again.");
      setLoading(false);
    }
  }

  return (
    <main className="auth-page">
      <div className="auth-card">
        <div className="auth-brand">
          Firm<span>Ledger</span>
        </div>

        <h1>Create your account</h1>

        <p className="auth-subtitle">
          Set up your law firm&apos;s financial workspace.
        </p>

        <form onSubmit={submit} className="auth-form">
          <label htmlFor="signup-firm">
            Firm name
            <input
              id="signup-firm"
              name="firmName"
              type="text"
              placeholder="Maphorogo Attorneys"
              autoComplete="organization"
              required
            />
          </label>

          <label htmlFor="signup-name">
            Your name
            <input
              id="signup-name"
              name="name"
              type="text"
              placeholder="Khodani Maphorogo"
              autoComplete="name"
              required
            />
          </label>

          <label htmlFor="signup-email">
            Email
            <input
              id="signup-email"
              name="email"
              type="email"
              placeholder="you@example.com"
              autoComplete="email"
              required
            />
          </label>

          <label htmlFor="signup-password">
            Password
            <input
              id="signup-password"
              name="password"
              type="password"
              placeholder="Create a password"
              autoComplete="new-password"
              minLength={8}
              required
            />
          </label>

          <label htmlFor="signup-confirm-password">
            Confirm password
            <input
              id="signup-confirm-password"
              name="confirmPassword"
              type="password"
              placeholder="Re-enter your password"
              autoComplete="new-password"
              minLength={8}
              required
            />
          </label>

          {error && <div className="form-error">{error}</div>}

          <button
            type="submit"
            disabled={loading}
            className="primary-button"
          >
            {loading ? "Creating account..." : "Create account"}
          </button>
        </form>

        <div className="auth-footer">
          Already have an account?{" "}
          <Link href="/login">Sign in</Link>
        </div>
      </div>
    </main>
  );
}