"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2, ChevronLeft } from "lucide-react";

import { C } from "@/lib/design";
import { AuthShell } from "@/components/auth-shell";
import { PrimaryButton } from "@/components/auth-button";
import { ErrorBanner, TextField } from "@/components/auth-fields";

/**
 * /forgot-password — single email field. Submits to
 * POST /api/auth/forgot-password and flips to a success state.
 *
 * The success message is intentionally generic ("If an account exists
 * with that email, we sent a reset link") because the API never
 * confirms whether the account actually exists. Matches the
 * anti-enumeration policy on the server side.
 */
export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || loading) return;
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      // The endpoint always returns 200 OK for any input — even invalid
      // emails or non-existent accounts. So we treat anything but a
      // network failure as "submitted".
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      setSubmitted(true);
    } catch {
      setError(
        "Couldn't send the reset email — please check your connection and try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <AuthShell
        heading="Check your inbox."
        subhead="If an account exists with that email, we just sent you a reset link."
      >
        <div
          role="status"
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: 12,
            padding: "16px 18px",
            borderRadius: 14,
            backgroundColor: C.amberLight,
            border: `1px solid rgba(232,134,12,0.25)`,
            marginBottom: 20,
            fontFamily: "var(--font-jakarta), -apple-system, sans-serif",
          }}
        >
          <CheckCircle2
            size={20}
            color={C.amberDark}
            strokeWidth={2.4}
            style={{ flexShrink: 0, marginTop: 2 }}
          />
          <div style={{ fontSize: 14, lineHeight: 1.55, color: C.text }}>
            <strong>The link expires in 1 hour.</strong> If you don&rsquo;t
            see the email within a few minutes, check your spam folder, or
            try again with a different email address.
          </div>
        </div>

        <Link
          href="/login"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            fontSize: 14,
            color: C.amberDark,
            fontWeight: 700,
            textDecoration: "none",
          }}
        >
          <ChevronLeft size={16} /> Back to sign in
        </Link>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      heading="Forgot your password?"
      subhead="Enter the email you signed up with and we'll send you a link to choose a new one."
    >
      {error && <ErrorBanner message={error} />}

      <form onSubmit={submit} noValidate>
        <TextField
          label="Email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={setEmail}
          placeholder="you@yourorg.com"
        />

        <PrimaryButton
          type="submit"
          loading={loading}
          loadingLabel="Sending reset link…"
          disabled={!email || loading}
        >
          Send Reset Link <ArrowRight size={18} />
        </PrimaryButton>
      </form>

      <p
        style={{
          textAlign: "center",
          marginTop: 24,
          fontSize: 14,
          color: C.textTertiary,
        }}
      >
        Remembered it?{" "}
        <Link
          href="/login"
          style={{
            color: C.amber,
            fontWeight: 700,
            textDecoration: "none",
          }}
        >
          Back to sign in
        </Link>
      </p>
    </AuthShell>
  );
}
