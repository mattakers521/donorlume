"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft, Check } from "lucide-react";

import { C, brandGradient } from "@/lib/design";

type Props = {
  completedCount: number;
  total: number;
  nextStepIndex: number; // 1-based step number for "Step N of 5"
  nextStepTitle: string;
};

/**
 * Persistent onboarding strip pinned ABOVE the topbar on every authed
 * page (except /dashboard, where the full checklist takes over) until
 * the user finishes or dismisses onboarding.
 *
 * Treats the bar like a navigation rail, not a footnote:
 *   • Step pill + step title read large enough to act as the page's
 *     current "where am I in onboarding" anchor.
 *   • The "Back to dashboard" affordance is a visible button on the
 *     right, not an inline span — so users always know it's clickable.
 *   • Only the button is the Link; clicks elsewhere on the strip don't
 *     navigate (the old behavior of wrapping everything in one giant
 *     <Link> made the title feel weirdly clickable).
 *
 * Heights: ~64px on desktop so the step title can sit at 16px without
 * cramping; collapses gracefully on mobile via flex-wrap.
 */
export function OnboardingProgressBar({
  completedCount,
  total,
  nextStepIndex,
  nextStepTitle,
}: Props) {
  const pathname = usePathname();

  // On the dashboard itself the full checklist already does the job —
  // suppress the strip there to avoid duplicating progress UI.
  if (pathname === "/dashboard") return null;

  const pct = Math.min(100, Math.round((completedCount / total) * 100));
  const allDone = completedCount >= total;

  return (
    <div
      role="navigation"
      aria-label="Onboarding progress"
      style={{
        position: "relative",
        width: "100%",
        backgroundColor: "#1F1B19",
        color: "#fff",
        fontFamily: "var(--font-jakarta), sans-serif",
        boxShadow: "0 1px 0 rgba(0,0,0,0.06)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
          padding: "12px clamp(14px, 3vw, 28px)",
          minHeight: 64,
          flexWrap: "wrap",
        }}
      >
        {/* Left — step pill + title. Reads like a GPS prompt. */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            minWidth: 0,
            flex: 1,
          }}
        >
          <span
            aria-hidden
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 32,
              height: 32,
              borderRadius: "50%",
              background: brandGradient,
              color: "#fff",
              fontSize: 13,
              fontWeight: 800,
              flexShrink: 0,
              boxShadow: "0 6px 14px rgba(232,134,12,0.35)",
            }}
          >
            {allDone ? <Check size={16} strokeWidth={3} /> : nextStepIndex}
          </span>
          <div style={{ minWidth: 0, lineHeight: 1.25 }}>
            <div
              style={{
                fontSize: 11,
                fontWeight: 800,
                color: C.amberOnDark,
                letterSpacing: 1.4,
                textTransform: "uppercase",
                marginBottom: 2,
              }}
            >
              {allDone
                ? "Onboarding complete"
                : `Step ${nextStepIndex} of ${total}`}
            </div>
            <div
              style={{
                fontSize: 16,
                fontWeight: 700,
                color: "rgba(255,255,255,0.96)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
              title={nextStepTitle}
            >
              {nextStepTitle}
            </div>
          </div>
        </div>

        {/* Right — clear button-shaped "Back to dashboard" affordance. */}
        <Link
          href="/dashboard"
          className="onboarding-bar-cta"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "9px 16px",
            borderRadius: 10,
            backgroundColor: "rgba(255,255,255,0.10)",
            border: "1px solid rgba(255,255,255,0.18)",
            color: "#fff",
            fontSize: 13,
            fontWeight: 700,
            textDecoration: "none",
            whiteSpace: "nowrap",
            flexShrink: 0,
            transition: "background-color 0.15s, border-color 0.15s",
          }}
        >
          <ArrowLeft size={14} /> Back to dashboard
        </Link>
      </div>

      {/* Thicker progress track at the bottom edge — visibility cue. */}
      <div
        style={{
          height: 4,
          backgroundColor: "rgba(255,255,255,0.06)",
        }}
        aria-hidden
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
    </div>
  );
}
