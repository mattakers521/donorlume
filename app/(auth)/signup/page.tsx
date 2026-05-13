"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { ArrowRight, ChevronLeft, Sparkles } from "lucide-react";

import { C } from "@/lib/design";
import { AuthShell } from "@/components/auth-shell";
import { CreatingWorkspaceView } from "@/components/auth/creating-workspace";
import {
  PrimaryButton,
  GoogleButton,
} from "@/components/auth-button";
import {
  TextField,
  TextAreaField,
  ErrorBanner,
  Divider,
} from "@/components/auth-fields";

type Step = "account" | "onboard" | "creating";

export default function SignupPage() {
  return (
    <Suspense fallback={null}>
      <SignupForm />
    </Suspense>
  );
}

function SignupForm() {
  const router = useRouter();
  // ?path=event | donors — captured from the landing "Choose Your Path"
  // cards. We forward it to /api/auth/register so the org row gets
  // stamped with signupPath, which the onboarding checklist then reads
  // to vary step 2's copy (event-platform exports vs. CRM exports).
  const searchParams = useSearchParams();
  const rawPath = searchParams.get("path");
  const signupPath: "event" | "donors" | null =
    rawPath === "event" || rawPath === "donors" ? rawPath : null;

  const [step, setStep] = useState<Step>("account");

  // Step 1
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  // Required acceptance — gates the "Continue" button on step 1 AND
  // the final POST. Sent to the register API; server stamps
  // termsAcceptedAt = now on User create.
  const [acceptTerms, setAcceptTerms] = useState(false);

  // Step 2
  const [orgName, setOrgName] = useState("");
  const [mission, setMission] = useState("");
  const [senderName, setSenderName] = useState("");
  const [senderTitle, setSenderTitle] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const accountValid =
    !!name && !!email && password.length >= 8 && acceptTerms;
  const orgValid = !!orgName.trim() && !!mission.trim();

  const advance = (e: React.FormEvent) => {
    e.preventDefault();
    if (!accountValid) {
      setError("Password must be at least 8 characters.");
      return;
    }
    setError(null);
    setStep("onboard");
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgValid || loading) return;
    setError(null);
    setLoading(true);
    // Switch to the full-screen transition. We Promise.all(...) the
    // actual work with a min-delay so fast users still see the moment;
    // slow users see the network time naturally.
    setStep("creating");

    const minDelay = new Promise((r) => setTimeout(r, 1800));

    try {
      const [res] = await Promise.all([
        fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name,
            email,
            password,
            orgName,
            mission,
            senderName: senderName || name,
            senderTitle,
            signupPath,
            acceptTerms,
          }),
        }),
        minDelay,
      ]);

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        if (res.status === 409) {
          setError("An account with this email already exists.");
          setStep("account");
        } else if (res.status === 400) {
          setError(
            body?.error === "Validation failed"
              ? "Please double-check the fields and try again."
              : "Something looked off in those fields.",
          );
          setStep("onboard");
        } else {
          setError("Couldn’t create your account. Try again in a moment.");
          setStep("onboard");
        }
        setLoading(false);
        return;
      }

      const signInRes = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (signInRes?.error) {
        setError(
          "Account created — but we couldn’t sign you in automatically. Please sign in.",
        );
        setLoading(false);
        router.push("/login");
        return;
      }

      // Don't drop the loading flag — we're navigating away. The
      // transition view stays up through the route change so the
      // user never sees a flicker back to the form.
      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Network error. Check your connection and try again.");
      setStep("onboard");
      setLoading(false);
    }
  };

  const google = () => {
    // Carry the signup path through Google's OAuth round-trip so the
    // /onboarding form can stamp it on the org when the new user lands.
    const callbackUrl = signupPath
      ? `/onboarding?path=${encodeURIComponent(signupPath)}`
      : "/dashboard";
    signIn("google", { callbackUrl });
  };

  if (step === "creating") {
    return <CreatingWorkspaceView orgName={orgName} />;
  }

  if (step === "account") {
    return (
      <AuthShell
        heading="Start for free."
        subhead="Create your account in under a minute."
      >
        {error && <ErrorBanner message={error} />}

        <SectionLead>
          Let&rsquo;s set up your account — takes about 60 seconds.
        </SectionLead>

        <form onSubmit={advance} noValidate>
          <TextField
            label="Full name"
            autoComplete="name"
            required
            value={name}
            onChange={setName}
            placeholder="Sarah Mitchell"
          />
          <TextField
            label="Work email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={setEmail}
            placeholder="sarah@hopefoundation.org"
          />
          <TextField
            label="Password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={password}
            onChange={setPassword}
            placeholder="At least 8 characters"
          />

          <TermsCheckbox
            checked={acceptTerms}
            onChange={setAcceptTerms}
          />

          <PrimaryButton type="submit" disabled={!accountValid}>
            Continue <ArrowRight size={18} />
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
          Already have an account?{" "}
          <Link
            href="/login"
            style={{
              color: C.amber,
              fontWeight: 700,
              textDecoration: "none",
            }}
          >
            Sign in
          </Link>
        </p>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      heading="Tell us about your org."
      subhead="This powers personalized prospect matching and AI outreach."
    >
      {error && <ErrorBanner message={error} />}

      <SectionLead>
        Tell us about your organization — this powers your AI outreach
        and prospect matching.
      </SectionLead>

      <form onSubmit={submit} noValidate>
        <TextField
          label="Organization name"
          required
          value={orgName}
          onChange={setOrgName}
          placeholder="Hope Community Foundation"
        />
        <TextAreaField
          label="Mission"
          required
          value={mission}
          onChange={setMission}
          rows={3}
          placeholder="Helping families in central Indiana access affordable housing."
        />
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 12,
            marginBottom: 28,
          }}
        >
          <TextField
            label="Your name"
            value={senderName}
            onChange={setSenderName}
            placeholder={name || "Sarah Mitchell"}
          />
          <TextField
            label="Your title"
            value={senderTitle}
            onChange={setSenderTitle}
            placeholder="Director of Development"
          />
        </div>

        <PrimaryButton
          type="submit"
          loading={loading}
          loadingLabel="Setting up your workspace…"
          disabled={!orgValid}
        >
          Launch DonorLume <Sparkles size={18} />
        </PrimaryButton>
      </form>

      <button
        type="button"
        onClick={() => {
          setError(null);
          setStep("account");
        }}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 4,
          margin: "20px auto 0",
          fontSize: 14,
          color: C.textTertiary,
          background: "none",
          border: "none",
          cursor: "pointer",
          fontFamily: "var(--font-jakarta), -apple-system, sans-serif",
        }}
      >
        <ChevronLeft size={14} />
        Back
      </button>
    </AuthShell>
  );
}

/**
 * One-line helper that sits above each form section. Quiet amber-tinted
 * tone so it reads as guidance, not chrome. Used on both signup steps
 * to answer "what am I being asked to do here?" before the user has to
 * parse the field labels.
 */
function SectionLead({ children }: { children: React.ReactNode }) {
  return (
    <p
      style={{
        margin: "0 0 20px",
        padding: "10px 14px",
        backgroundColor: "rgba(232,134,12,0.06)",
        borderLeft: `3px solid ${C.amber}`,
        borderRadius: 8,
        fontSize: 13.5,
        lineHeight: 1.55,
        color: C.text,
        fontWeight: 500,
      }}
    >
      {children}
    </p>
  );
}

/**
 * ToS + Privacy consent gate. Required for new signups — both the
 * "Continue" button and the final POST are gated on `checked === true`.
 * Links open in a new tab so the user doesn't lose form state.
 */
function TermsCheckbox({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <label
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 10,
        padding: "12px 4px",
        margin: "4px 0 20px",
        cursor: "pointer",
        userSelect: "none",
      }}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        style={{
          marginTop: 3,
          width: 18,
          height: 18,
          accentColor: C.amber,
          cursor: "pointer",
          flexShrink: 0,
        }}
        aria-describedby="terms-description"
      />
      <span
        id="terms-description"
        style={{
          fontSize: 13.5,
          color: C.textBody,
          fontWeight: 500,
          lineHeight: 1.5,
        }}
      >
        I agree to the{" "}
        <a
          href="/terms"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            color: C.amberDark,
            fontWeight: 700,
            textDecoration: "underline",
            textUnderlineOffset: 2,
          }}
        >
          Terms of Service
        </a>{" "}
        and{" "}
        <a
          href="/privacy"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            color: C.amberDark,
            fontWeight: 700,
            textDecoration: "underline",
            textUnderlineOffset: 2,
          }}
        >
          Privacy Policy
        </a>
        .
      </span>
    </label>
  );
}
