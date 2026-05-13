"use client";

import { C } from "@/lib/design";
import { StarburstLogo } from "@/components/starburst-logo";

type Props = {
  /**
   * Org name typed by the user. Rendered in bold in the body line as
   * a small piece of personalization. Optional — the view falls back
   * to "your workspace" if the value is empty/whitespace.
   */
  orgName: string;
};

/**
 * Full-screen "Setting up your workspace…" transition used between
 * org submission and the redirect to /dashboard.
 *
 * Both signup paths render this:
 *   • /signup        — email + password flow (POST /api/auth/register)
 *   • /onboarding    — Google OAuth follow-up (POST /api/auth/onboarding)
 *
 * Lives in `components/auth/` so neither page has to duplicate the
 * markup; both share the same `.signup-creating-pulse` keyframe in
 * globals.css so the brand mark breathes identically.
 *
 * Important: callers are expected to keep `step === "creating"` (or
 * equivalent) true through the redirect — letting the view stay
 * mounted prevents a flicker back to the form between fetch resolve
 * and `router.push`.
 */
export function CreatingWorkspaceView({ orgName }: Props) {
  const trimmed = orgName.trim();
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: C.bg,
        padding: 24,
        textAlign: "center",
      }}
    >
      <div
        className="signup-creating-pulse"
        style={{ marginBottom: 32, lineHeight: 0 }}
        aria-hidden
      >
        <StarburstLogo size={140} idKey="signup-creating" />
      </div>
      <h1
        style={{
          fontFamily: "var(--font-instrument-serif), Georgia, serif",
          fontSize: "clamp(26px, 4vw, 34px)",
          fontWeight: 400,
          margin: "0 0 12px",
          color: C.text,
          letterSpacing: -0.8,
          lineHeight: 1.15,
        }}
      >
        Setting up your workspace…
      </h1>
      <p
        style={{
          fontSize: 16,
          color: C.textBody,
          fontWeight: 500,
          margin: 0,
          maxWidth: 440,
          lineHeight: 1.6,
        }}
      >
        Spinning up{" "}
        {trimmed ? (
          <strong style={{ color: C.text }}>{trimmed}</strong>
        ) : (
          "your workspace"
        )}{" "}
        on DonorLume. This takes just a moment.
      </p>
    </main>
  );
}
