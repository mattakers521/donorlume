"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { C, brandGradient } from "@/lib/design";
import { StarburstLogo } from "@/components/starburst-logo";

/**
 * Full-screen "You're all set!" celebration shown after the user
 * sends their first email through DonorLume. Replaces the previous
 * fleeting toast so the milestone actually registers.
 *
 * Visual elements:
 *   • Center: a large pulsing starburst (reuses the `signup-creating-
 *     pulse` keyframe — same brand mark breathing animation).
 *   • Around it: confetti-style sparkle particles drifting upward via
 *     CSS-only `@keyframes celebrate-sparkle` (no library dep).
 *   • Below: serif headline, supporting copy, gradient "Go to
 *     Dashboard" CTA, secondary "Stay here" link back to the campaign
 *     in case the user wants to send more before they leave.
 *
 * Auto-redirect: NONE — the user dismisses by clicking the CTA. We
 * never time-out the screen because the brief explicitly called for
 * the user to feel the moment.
 */
export function CelebrateView() {
  // 14 confetti particles distributed across the canvas. Stagger via
  // index-driven delay so they don't all peak in the same frame.
  const sparkleCount = 14;

  return (
    <main
      style={{
        position: "relative",
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "32px 24px",
        backgroundColor: C.bg,
        overflow: "hidden",
        textAlign: "center",
      }}
    >
      {/* Confetti layer — pointer-events: none so it doesn't block the CTA. */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          overflow: "hidden",
        }}
      >
        {Array.from({ length: sparkleCount }).map((_, i) => (
          <Sparkle key={i} index={i} total={sparkleCount} />
        ))}
      </div>

      <div
        className="signup-creating-pulse"
        style={{ marginBottom: 36, lineHeight: 0, position: "relative" }}
        aria-hidden
      >
        <StarburstLogo size={160} idKey="celebrate" />
      </div>

      <div
        style={{
          fontSize: 11,
          fontWeight: 800,
          color: C.amberDark,
          letterSpacing: 1.6,
          textTransform: "uppercase",
          marginBottom: 14,
        }}
      >
        Onboarding complete
      </div>

      <h1
        style={{
          fontFamily: "var(--font-instrument-serif), Georgia, serif",
          fontSize: "clamp(36px, 6vw, 56px)",
          fontWeight: 400,
          margin: "0 0 18px",
          color: C.text,
          letterSpacing: -1.2,
          lineHeight: 1.05,
        }}
      >
        You&rsquo;re all set!
      </h1>

      <p
        style={{
          fontSize: 17,
          color: C.textBody,
          fontWeight: 500,
          margin: "0 auto 36px",
          maxWidth: 520,
          lineHeight: 1.6,
        }}
      >
        Your first email is on its way. DonorLume is tracking opens, clicks,
        and replies — head to your dashboard to see them roll in.
      </p>

      <div
        style={{
          display: "flex",
          gap: 14,
          flexWrap: "wrap",
          justifyContent: "center",
        }}
      >
        <Link
          href="/dashboard"
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
            letterSpacing: 0.2,
            boxShadow:
              "0 14px 36px rgba(232,134,12,0.34), 0 6px 18px rgba(212,74,26,0.20)",
            fontFamily: "var(--font-jakarta), -apple-system, sans-serif",
          }}
        >
          Go to Dashboard <ArrowRight size={18} />
        </Link>
        <Link
          href="/outreach"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "16px 24px",
            borderRadius: 14,
            backgroundColor: C.surface,
            color: C.text,
            fontSize: 15,
            fontWeight: 700,
            textDecoration: "none",
            border: `1px solid ${C.border}`,
            fontFamily: "var(--font-jakarta), -apple-system, sans-serif",
          }}
        >
          View campaigns
        </Link>
      </div>
    </main>
  );
}

/**
 * Single confetti particle. Color rotates through the brand palette;
 * starting X is spread across the viewport via the index; rise duration
 * + delay are staggered so the field reads as a gentle drift, not a
 * synchronized burst. Pure CSS animation — no JS frame loop.
 */
function Sparkle({ index, total }: { index: number; total: number }) {
  const colors = [C.amber, C.orange, C.gold, C.amberDark];
  const color = colors[index % colors.length];
  // Spread horizontally across the viewport; jitter so they don't form a grid.
  const xPercent = (index / total) * 100 + (index % 2 === 0 ? 4 : -4);
  const size = 8 + (index % 4) * 2;
  const duration = 3.5 + (index % 5) * 0.4;
  const delay = (index * 0.18) % 2.6;

  return (
    <span
      className="celebrate-sparkle"
      style={{
        position: "absolute",
        left: `${xPercent}%`,
        bottom: -20,
        width: size,
        height: size,
        borderRadius: index % 3 === 0 ? "50%" : 2,
        backgroundColor: color,
        animationDuration: `${duration}s`,
        animationDelay: `${delay}s`,
        opacity: 0,
        boxShadow: `0 0 12px ${color}`,
        transform: "rotate(0deg)",
      }}
    />
  );
}
