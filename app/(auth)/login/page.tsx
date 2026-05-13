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
        <div style={{ marginBottom: 24 }}>
          <TextField
            label="Password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={setPassword}
            placeholder="••••••••"
          />
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
