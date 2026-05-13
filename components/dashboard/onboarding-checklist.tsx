"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { ArrowRight, Check, Sparkles } from "lucide-react";

import { C, brandGradient } from "@/lib/design";

export type ChecklistStep = {
  key:
    | "profile"
    | "prospects"
    | "donors"
    | "outreach"
    | "send";
  title: string;
  body: string;
  cta: string;
  href: string;
  done: boolean;
  /** Optional — present when the step came from getOnboardingState(). */
  completedToast?: string;
};

type Props = {
  steps: ChecklistStep[];
  /** Server Action that flips User.dismissedOnboarding to true. */
  dismissAction: () => Promise<void>;
  /**
   * First name pulled from `User.name`. Used to personalize the greeting
   * ("Welcome to DonorLume, Sarah!"). Null falls back to a generic
   * greeting so we never render "Welcome, !".
   */
  firstName: string | null;
};

/**
 * First-run onboarding checklist for the dashboard.
 *
 * Rendered above the KPI row when the user has completed fewer than 3
 * steps AND hasn't permanently dismissed. The page-level Server
 * Component decides visibility; this component just renders the card +
 * handles the dismiss interaction.
 *
 * Styling: amber/orange gradient border via a 1px linear-gradient
 * background sandwiching a surface-colored interior — gives the warm
 * accent the spec asked for without painting a heavy stroke on every
 * row.
 */
export function OnboardingChecklist({
  steps,
  dismissAction,
  firstName,
}: Props) {
  const completed = steps.filter((s) => s.done).length;
  const total = steps.length;
  const pct = Math.round((completed / total) * 100);
  const [pending, startTransition] = useTransition();
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  const handleDismiss = () => {
    if (pending) return;
    // Optimistic hide so the checklist disappears immediately.
    setDismissed(true);
    startTransition(async () => {
      try {
        await dismissAction();
      } catch {
        // Restore the card on failure so the user can retry.
        setDismissed(false);
      }
    });
  };

  return (
    <div
      style={{
        position: "relative",
        marginBottom: 32,
        borderRadius: 24,
        padding: 2,
        background: brandGradient,
        boxShadow:
          "0 20px 60px rgba(232,134,12,0.22), 0 6px 18px rgba(212,74,26,0.14)",
      }}
    >
      <div
        style={{
          position: "relative",
          backgroundColor: C.surface,
          borderRadius: 22,
          padding: "clamp(24px, 3.5vw, 36px)",
          overflow: "hidden",
        }}
      >
        {/* Ambient amber glow in the upper-right of the card — gives it
            the "welcome aboard" feel without overpowering the content. */}
        <div
          aria-hidden
          style={{
            position: "absolute",
            top: -120,
            right: -80,
            width: 360,
            height: 360,
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(232,134,12,0.18) 0%, transparent 65%)",
            pointerEvents: "none",
          }}
        />

        {/* Header — pill + title + body + progress */}
        <div
          style={{
            position: "relative",
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 20,
            flexWrap: "wrap",
            marginBottom: 24,
          }}
        >
          <div style={{ minWidth: 0, flex: 1 }}>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "6px 12px",
                borderRadius: 100,
                background: brandGradient,
                color: "#fff",
                fontSize: 11,
                fontWeight: 800,
                letterSpacing: 1.3,
                textTransform: "uppercase",
                marginBottom: 16,
                boxShadow: "0 6px 16px rgba(232,134,12,0.30)",
              }}
            >
              <Sparkles size={12} /> 14-day free trial
            </div>
            <h2
              style={{
                fontFamily:
                  "var(--font-instrument-serif), Georgia, serif",
                fontSize: "clamp(26px, 3.6vw, 36px)",
                fontWeight: 400,
                color: C.text,
                margin: "0 0 10px",
                letterSpacing: -0.8,
                lineHeight: 1.1,
              }}
            >
              Welcome to{" "}
              <span
                style={{
                  background: brandGradient,
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                }}
              >
                DonorLume
              </span>
              {firstName ? `, ${firstName}` : ""}!
            </h2>
            <p
              style={{
                fontSize: 16,
                color: C.textBody,
                fontWeight: 500,
                lineHeight: 1.55,
                margin: 0,
                maxWidth: 560,
              }}
            >
              Start your free trial — you won&rsquo;t be charged until
              your trial ends. Here&rsquo;s how to get the most out of
              the next 14 days: each step takes a few minutes, and by
              the time you finish you&rsquo;ll have a scored donor list,
              a saved pipeline, and your first personalized outreach
              ready to send.
            </p>
          </div>

          <div
            style={{
              flexShrink: 0,
              textAlign: "right",
              minWidth: 140,
            }}
          >
            <div
              style={{
                fontSize: 12,
                fontWeight: 800,
                color: C.textTertiary,
                letterSpacing: 1.2,
                textTransform: "uppercase",
                marginBottom: 6,
              }}
            >
              Progress
            </div>
            <div
              style={{
                fontFamily:
                  "var(--font-instrument-serif), Georgia, serif",
                fontSize: 36,
                color: C.text,
                letterSpacing: -0.8,
                lineHeight: 1,
              }}
            >
              <span style={{ color: C.amberDark }}>{completed}</span>
              <span style={{ color: C.textTertiary }}> of {total}</span>
            </div>
            <div
              style={{
                marginTop: 6,
                fontSize: 12,
                fontWeight: 600,
                color: C.textSecondary,
              }}
            >
              {completed === 0
                ? "Let's begin"
                : completed === total
                  ? "All set"
                  : "Keep going"}
            </div>
          </div>
        </div>

        {/* Progress bar */}
        <div
          aria-label={`${completed} of ${total} steps complete`}
          style={{
            height: 8,
            borderRadius: 100,
            backgroundColor: "rgba(0,0,0,0.06)",
            overflow: "hidden",
            marginBottom: 20,
          }}
        >
          <div
            style={{
              width: `${pct}%`,
              height: "100%",
              background: brandGradient,
              transition: "width 0.4s ease",
            }}
          />
        </div>

        {/* Step list */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          {steps.map((step) => (
            <StepRow key={step.key} step={step} />
          ))}
        </div>

        {/* Dismiss link */}
        <div
          style={{
            marginTop: 18,
            display: "flex",
            justifyContent: "flex-end",
          }}
        >
          <button
            type="button"
            onClick={handleDismiss}
            disabled={pending}
            style={{
              background: "none",
              border: "none",
              color: C.textSecondary,
              fontSize: 13,
              fontWeight: 600,
              cursor: pending ? "default" : "pointer",
              padding: 4,
              opacity: pending ? 0.6 : 1,
              textDecoration: "underline",
              textUnderlineOffset: 2,
              fontFamily: "var(--font-jakarta), sans-serif",
            }}
          >
            I&rsquo;ll explore on my own
          </button>
        </div>
      </div>
    </div>
  );
}

function StepRow({ step }: { step: ChecklistStep }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 14,
        padding: "14px 16px",
        borderRadius: 14,
        backgroundColor: step.done ? C.amberLight : C.bg,
        border: step.done
          ? `1px solid rgba(232,134,12,0.25)`
          : `1px solid ${C.border}`,
        transition: "background-color 0.2s, border-color 0.2s",
      }}
    >
      {/* Checkbox circle */}
      <div
        aria-hidden
        style={{
          width: 26,
          height: 26,
          borderRadius: "50%",
          background: step.done ? brandGradient : C.surface,
          border: step.done ? "none" : `1.5px solid ${C.border}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          boxShadow: step.done
            ? "0 4px 10px rgba(232,134,12,0.30)"
            : "0 1px 2px rgba(0,0,0,0.04)",
          marginTop: 2,
        }}
      >
        {step.done && <Check size={15} color="#fff" strokeWidth={3} />}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 15,
            fontWeight: 700,
            color: C.text,
            marginBottom: 2,
            textDecoration: step.done ? "line-through" : "none",
            textDecorationColor: step.done
              ? "rgba(0,0,0,0.20)"
              : undefined,
          }}
        >
          {step.title}
        </div>
        <div
          style={{
            fontSize: 13.5,
            lineHeight: 1.55,
            color: C.textBody,
            fontWeight: 500,
            opacity: step.done ? 0.6 : 1,
          }}
        >
          {step.body}
        </div>
      </div>

      {!step.done && (
        <Link
          href={step.href}
          onClick={() => {
            console.log(
              `[checklist-trace] step CTA clicked: key=${step.key} href=${step.href}`,
            );
          }}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "8px 14px",
            borderRadius: 10,
            background: brandGradient,
            color: "#fff",
            fontSize: 13,
            fontWeight: 700,
            textDecoration: "none",
            flexShrink: 0,
            boxShadow: "0 6px 16px rgba(232,134,12,0.25)",
            alignSelf: "center",
            whiteSpace: "nowrap",
          }}
        >
          {step.cta} <ArrowRight size={14} />
        </Link>
      )}
      {step.done && (
        <span
          style={{
            fontSize: 11,
            fontWeight: 800,
            color: C.amberDark,
            letterSpacing: 1.2,
            textTransform: "uppercase",
            alignSelf: "center",
            flexShrink: 0,
          }}
        >
          Done
        </span>
      )}
    </div>
  );
}
