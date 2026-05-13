"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";

import { C } from "@/lib/design";
import { AuthShell } from "@/components/auth-shell";
import { CreatingWorkspaceView } from "@/components/auth/creating-workspace";
import {
  PrimaryButton,
} from "@/components/auth-button";
import {
  ErrorBanner,
  TextAreaField,
  TextField,
} from "@/components/auth-fields";

type Props = {
  defaultSenderName: string;
  userEmail: string;
  /** Carried from the landing /signup ?path through Google OAuth. */
  signupPath: "event" | "donors" | null;
};

/**
 * Authed-but-org-less onboarding form. Mirrors the second half of
 * /signup but for users who already have a session (typically Google
 * OAuth — the provider creates a User but no Organization).
 */
export function OnboardingForm({
  defaultSenderName,
  userEmail,
  signupPath,
}: Props) {
  const router = useRouter();
  const [orgName, setOrgName] = useState("");
  const [mission, setMission] = useState("");
  const [senderName, setSenderName] = useState(defaultSenderName);
  const [senderTitle, setSenderTitle] = useState("");
  // Google OAuth signups still need to accept ToS — the User row was
  // created by NextAuth's adapter without the timestamp, so we capture
  // it on org-creation here.
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  // When true, the form is unmounted and replaced with the full-screen
  // "Setting up your workspace…" transition. We keep this true through
  // the redirect — letting `loading` drop back to false here would
  // flicker the form back into view between fetch resolve and
  // router.push committing.
  const [creating, setCreating] = useState(false);

  const valid =
    !!orgName.trim() && !!mission.trim() && acceptTerms;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid || loading) return;
    setError(null);
    setLoading(true);
    setCreating(true);

    // Race the real work with a 1.8s min-delay so the transition is
    // visible even when the network call resolves instantly.
    const minDelay = new Promise((r) => setTimeout(r, 1800));

    try {
      const [res] = await Promise.all([
        fetch("/api/auth/onboarding", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            orgName,
            mission,
            senderName: senderName || null,
            senderTitle: senderTitle || null,
            signupPath,
            acceptTerms,
          }),
        }),
        minDelay,
      ]);
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        // Drop the transition so the user sees the form + error banner.
        setCreating(false);
        setLoading(false);
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      // Don't reset `creating` — the transition stays mounted through
      // the navigation so the dashboard hydrates underneath it.
      router.push("/dashboard");
      router.refresh();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Couldn’t complete onboarding.",
      );
      setCreating(false);
      setLoading(false);
    }
  };

  if (creating) {
    return <CreatingWorkspaceView orgName={orgName} />;
  }

  return (
    <AuthShell
      heading="Welcome — tell us about your org."
      subhead="Just a few details so we can personalize prospect matching and AI outreach."
    >
      <p
        style={{
          fontSize: 13,
          color: C.textTertiary,
          marginBottom: 24,
          fontWeight: 500,
        }}
      >
        Signed in as {userEmail}
      </p>

      {error && <ErrorBanner message={error} />}

      <form onSubmit={submit} noValidate>
        <TextField
          label="Organization name"
          required
          value={orgName}
          onChange={setOrgName}
          placeholder="Hope Foundation"
        />
        <TextAreaField
          label="Mission"
          required
          rows={3}
          value={mission}
          onChange={setMission}
          placeholder="What does your organization do?"
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
            placeholder="Sarah Mitchell"
          />
          <TextField
            label="Title"
            value={senderTitle}
            onChange={setSenderTitle}
            placeholder="Dir. of Development"
          />
        </div>

        <label
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: 10,
            padding: "4px 0",
            margin: "0 0 20px",
            cursor: "pointer",
            userSelect: "none",
          }}
        >
          <input
            type="checkbox"
            checked={acceptTerms}
            onChange={(e) => setAcceptTerms(e.target.checked)}
            style={{
              marginTop: 3,
              width: 18,
              height: 18,
              accentColor: C.amber,
              cursor: "pointer",
              flexShrink: 0,
            }}
          />
          <span
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

        <PrimaryButton
          type="submit"
          loading={loading}
          loadingLabel="Setting up…"
          disabled={!valid}
        >
          Launch DonorLume <Sparkles size={18} />
        </PrimaryButton>
      </form>
    </AuthShell>
  );
}
