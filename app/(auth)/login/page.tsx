"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { ArrowRight } from "lucide-react";

import { C } from "@/lib/design";
import { AuthShell } from "@/components/auth-shell";
import {
  PrimaryButton,
  GoogleButton,
} from "@/components/auth-button";
import {
  TextField,
  ErrorBanner,
  Divider,
} from "@/components/auth-fields";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const callbackUrl = params.get("callbackUrl") ?? "/dashboard";
  const queryError = params.get("error");
  // ?reset=success is the redirect target of /api/auth/reset-password
  // — surface a confirmation banner so the user knows the new
  // password is live.
  const resetJustSucceeded = params.get("reset") === "success";
  // ?error=seats_exceeded comes from the NextAuth signIn callback when
  // the user's org has more members than its plan's seat cap allows.
  // Surface a specific message so the user knows whom to ask.
  const initialError =
    queryError === "seats_exceeded"
      ? "Your team is above its plan's seat limit. Please ask an admin to upgrade, or contact support@donorlume.com."
      : null;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(initialError);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setError(null);
    setLoading(true);
    const res = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });
    setLoading(false);
    if (res?.error) {
      setError("That email and password didn’t match.");
      return;
    }
    router.push(callbackUrl);
    router.refresh();
  };

  const google = () => {
    signIn("google", { callbackUrl });
  };

  return (
    <AuthShell
      heading="Welcome back."
      subhead="Sign in to your donor intelligence dashboard."
    >
      {resetJustSucceeded && (
        <div
          role="status"
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: 12,
            padding: "14px 16px",
            borderRadius: 14,
            backgroundColor: C.greenLight,
            border: `1px solid rgba(52,199,89,0.30)`,
            marginBottom: 20,
            fontFamily: "var(--font-jakarta), -apple-system, sans-serif",
          }}
        >
          <span
            aria-hidden
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 22,
              height: 22,
              borderRadius: "50%",
              backgroundColor: C.green,
              color: "#fff",
              fontSize: 14,
              fontWeight: 900,
              flexShrink: 0,
              marginTop: 1,
            }}
          >
            ✓
          </span>
          <div
            style={{
              fontSize: 14,
              lineHeight: 1.55,
              color: C.text,
              fontWeight: 500,
            }}
          >
            <strong>Password updated.</strong> Sign in below with your new
            password.
          </div>
        </div>
      )}

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
        <TextField
          label="Password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={setPassword}
          placeholder="••••••••"
        />

        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            margin: "-4px 0 24px",
          }}
        >
          <Link
            href="/forgot-password"
            style={{
              fontSize: 13,
              color: C.amberDark,
              fontWeight: 700,
              textDecoration: "none",
            }}
          >
            Forgot password?
          </Link>
        </div>

        <PrimaryButton
          type="submit"
          loading={loading}
          loadingLabel="Signing in…"
          disabled={!email || !password}
        >
          Sign In <ArrowRight size={18} />
        </PrimaryButton>
      </form>

      <Divider label="or" />

      <GoogleButton onClick={google} disabled={loading} />

      <p
        style={{
          textAlign: "center",
          marginTop: 24,
          fontSize: 14,
          color: C.textTertiary,
        }}
      >
        New here?{" "}
        <Link
          href="/signup"
          style={{
            color: C.amber,
            fontWeight: 700,
            textDecoration: "none",
          }}
        >
          Create an account
        </Link>
      </p>
    </AuthShell>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
