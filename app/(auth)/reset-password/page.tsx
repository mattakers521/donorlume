"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowRight, CheckCircle2 } from "lucide-react";

import { C } from "@/lib/design";
import { AuthShell } from "@/components/auth-shell";
import { PrimaryButton } from "@/components/auth-button";
import { ErrorBanner, TextField } from "@/components/auth-fields";

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordForm />
    </Suspense>
  );
}

/**
 * /reset-password?token=… — collects new password + confirmation,
 * POSTs to /api/auth/reset-password. On success bounces to
 * /login?reset=success so the user sees a confirmation banner there.
 *
 * Missing-token edge case rendered explicitly: a user could arrive
 * here via a typo or a manually-edited URL. We show a clear pointer
 * back to /forgot-password instead of a blank form that fails on
 * submit.
 */
function ResetPasswordForm() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const passwordsMatch = password.length > 0 && password === confirm;
  const valid =
    !!token && password.length >= 8 && passwordsMatch;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid || loading) return;
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
      };
      if (!res.ok) {
        setError(body.error ?? "Couldn't reset your password.");
        return;
      }
      // Success — bounce to login with a banner. We pass through any
      // email server-side returned (currently unused but useful if we
      // later want to pre-fill the email field on login).
      router.push("/login?reset=success");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <AuthShell
        heading="Reset link missing."
        subhead="This URL doesn't include a valid reset token."
      >
        <p
          style={{
            fontSize: 14,
            color: C.textBody,
            lineHeight: 1.6,
            fontWeight: 500,
            margin: "0 0 24px",
          }}
        >
          If you got here from an email, the link may have been malformed.
          Request a fresh reset link below.
        </p>
        <Link
          href="/forgot-password"
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            padding: "12px 22px",
            borderRadius: 12,
            background: `linear-gradient(135deg, ${C.amber}, ${C.orange})`,
            color: "#fff",
            fontSize: 14,
            fontWeight: 700,
            textDecoration: "none",
            boxShadow: "0 8px 24px rgba(232,134,12,0.25)",
            fontFamily: "var(--font-jakarta), -apple-system, sans-serif",
          }}
        >
          Request a New Reset Link <ArrowRight size={16} />
        </Link>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      heading="Choose a new password."
      subhead="Pick something at least 8 characters long."
    >
      {error && <ErrorBanner message={error} />}

      <form onSubmit={submit} noValidate>
        <TextField
          label="New password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          value={password}
          onChange={setPassword}
          placeholder="At least 8 characters"
        />
        <TextField
          label="Confirm new password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          value={confirm}
          onChange={setConfirm}
          placeholder="Type it again"
        />

        {confirm.length > 0 && !passwordsMatch && (
          <p
            style={{
              fontSize: 13,
              color: C.orange,
              fontWeight: 600,
              margin: "0 0 16px",
            }}
          >
            Passwords don&rsquo;t match yet.
          </p>
        )}
        {passwordsMatch && (
          <p
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              fontSize: 13,
              color: C.green,
              fontWeight: 600,
              margin: "0 0 16px",
            }}
          >
            <CheckCircle2 size={14} strokeWidth={2.4} />
            Passwords match.
          </p>
        )}

        <PrimaryButton
          type="submit"
          loading={loading}
          loadingLabel="Updating password…"
          disabled={!valid}
        >
          Reset Password <ArrowRight size={18} />
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
