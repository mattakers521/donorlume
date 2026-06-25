import Link from "next/link";
import { ArrowRight, Sparkles, Upload, Users } from "lucide-react";

import { C, brandGradient, shadow } from "@/lib/design";

/**
 * Empty state rendered at /outreach/new when the org has zero real
 * donors. Without this, the picker would silently load 8 sample
 * donors — first-time users would tick "Generate" and burn trial
 * credits on Maria DePalma + friends without realizing the contacts
 * weren't theirs.
 *
 * Primary CTA points to /lapsed (the upload page). Secondary
 * "try with sample data" link bounces back to the same route with
 * `?samples=true`, which the page detects to mount the wizard
 * with samples-only and a clear sample-mode banner.
 */
export function OutreachColdStart() {
  return (
    <div
      style={{
        maxWidth: 760,
        margin: "0 auto",
        padding: "clamp(24px, 4vw, 48px) 24px",
      }}
    >
      <div
        style={{
          backgroundColor: C.surface,
          borderRadius: 24,
          boxShadow: shadow.md,
          padding: "clamp(28px, 4vw, 48px)",
          textAlign: "center",
        }}
      >
        <div
          aria-hidden
          style={{
            width: 80,
            height: 80,
            borderRadius: 24,
            background: brandGradient,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 24px",
            boxShadow: shadow.glow,
          }}
        >
          <Users size={36} color="#fff" strokeWidth={2.2} />
        </div>

        <h1
          style={{
            fontFamily: "var(--font-instrument-serif), Georgia, serif",
            fontSize: "clamp(28px, 3.8vw, 38px)",
            fontWeight: 400,
            color: C.text,
            margin: "0 0 14px",
            letterSpacing: -0.8,
            lineHeight: 1.15,
          }}
        >
          Upload your donors first.
        </h1>

        <p
          style={{
            fontSize: 17,
            color: C.textBody,
            fontWeight: 500,
            lineHeight: 1.55,
            margin: "0 auto 32px",
            maxWidth: 520,
          }}
        >
          AI outreach personalizes every email from your donor history
          — last gift, lifetime giving, segments, and notes. Drop a CSV
          on the Upload page and we&rsquo;ll score every row, then come
          back here to draft.
        </p>

        <Link
          href="/lapsed"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "16px 32px",
            borderRadius: 14,
            background: brandGradient,
            color: "#fff",
            fontSize: 16,
            fontWeight: 800,
            textDecoration: "none",
            boxShadow: shadow.md,
            letterSpacing: -0.1,
            fontFamily:
              "var(--font-jakarta), -apple-system, sans-serif",
          }}
        >
          <Upload size={18} /> Upload donors <ArrowRight size={18} />
        </Link>

        <div
          style={{
            marginTop: 28,
            paddingTop: 24,
            borderTop: `1px solid ${C.borderSubtle}`,
            display: "flex",
            justifyContent: "center",
          }}
        >
          <Link
            href="/outreach/new?samples=true"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              fontSize: 14,
              color: C.textSecondary,
              fontWeight: 600,
              textDecoration: "underline",
              textUnderlineOffset: 3,
              textDecorationColor: "rgba(110,110,115,0.4)",
            }}
          >
            <Sparkles size={14} color={C.amber} /> Or try the wizard
            with sample data
          </Link>
        </div>
      </div>
    </div>
  );
}
