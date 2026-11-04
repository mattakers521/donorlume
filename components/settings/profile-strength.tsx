import { CheckCircle2, Sparkles } from "lucide-react";

import { C, brandGradient, shadow } from "@/lib/design";
import {
  GROUNDING_FIELDS,
  PROFILE_FIELDS,
  type ProfileStrength,
} from "@/lib/org-profile";

const GROUNDING_LABELS = PROFILE_FIELDS.filter((f) =>
  GROUNDING_FIELDS.includes(f.key),
).map((f) => f.label.toLowerCase());

function headline(percent: number): string {
  if (percent >= 100) return "Your profile is complete";
  if (percent >= 50) return "Almost there";
  return "Let’s tell your story";
}

/**
 * Profile-strength indicator at the top of /settings/organization.
 * Server-rendered from the saved row; the save action revalidates the
 * page, so the number updates right after "Save".
 */
export function ProfileStrengthCard({
  strength,
  grounded,
}: {
  strength: ProfileStrength;
  grounded: boolean;
}) {
  const complete = strength.percent >= 100;
  return (
    <section
      aria-label="Profile strength"
      style={{
        backgroundColor: C.surface,
        borderRadius: 20,
        padding: "clamp(20px, 3vw, 26px)",
        boxShadow: shadow.md,
        marginBottom: 20,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 16,
          flexWrap: "wrap",
          marginBottom: 12,
        }}
      >
        <div>
          <div
            style={{
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: 1.2,
              textTransform: "uppercase",
              color: C.amberDark,
              marginBottom: 4,
            }}
          >
            Profile strength
          </div>
          <h2
            style={{
              fontFamily: "var(--font-instrument-serif), Georgia, serif",
              fontSize: 24,
              fontWeight: 400,
              color: C.text,
              margin: 0,
              letterSpacing: -0.4,
            }}
          >
            {headline(strength.percent)}
          </h2>
        </div>
        <div
          data-testid="profile-strength-percent"
          style={{
            fontFamily: "var(--font-instrument-serif), Georgia, serif",
            fontSize: 40,
            lineHeight: 1,
            color: complete ? C.amberDark : C.text,
          }}
        >
          {strength.percent}%
        </div>
      </div>

      <div
        role="progressbar"
        aria-label="Profile completeness"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={strength.percent}
        style={{
          height: 8,
          borderRadius: 999,
          backgroundColor: C.surfaceTint,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${strength.percent}%`,
            height: "100%",
            borderRadius: 999,
            background: brandGradient,
            transition: "width 0.4s ease",
          }}
        />
      </div>

      <p
        style={{
          margin: "14px 0 0",
          fontSize: 13.5,
          color: C.textBody,
          fontWeight: 500,
          lineHeight: 1.55,
          display: "flex",
          alignItems: "flex-start",
          gap: 8,
        }}
      >
        {grounded ? (
          <CheckCircle2
            size={16}
            color={C.green}
            style={{ flexShrink: 0, marginTop: 2 }}
          />
        ) : (
          <Sparkles
            size={16}
            color={C.amber}
            style={{ flexShrink: 0, marginTop: 2 }}
          />
        )}
        <span>
          {grounded
            ? "Every AI-written email is now grounded in your mission, the community you serve, and your focus areas."
            : `Add your ${GROUNDING_LABELS.join(", ").replace(/, ([^,]*)$/, ", and $1")} so every AI-written email sounds like it came from you — not a template.`}
        </span>
      </p>

      {strength.missing.length > 0 && (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: 8,
            marginTop: 12,
          }}
        >
          <span
            style={{ fontSize: 12.5, color: C.textTertiary, fontWeight: 600 }}
          >
            Still missing:
          </span>
          {strength.missing.map((f) => (
            <span
              key={f.key}
              style={{
                padding: "4px 10px",
                borderRadius: 999,
                backgroundColor: C.surfaceTint,
                color: C.textSecondary,
                fontSize: 12.5,
                fontWeight: 700,
              }}
            >
              {f.label}
            </span>
          ))}
        </div>
      )}
    </section>
  );
}
