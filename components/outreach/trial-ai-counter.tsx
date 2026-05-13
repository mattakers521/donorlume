import Link from "next/link";
import { ArrowRight, Sparkles, Zap } from "lucide-react";

import { TRIAL_AI_EMAIL_LIMIT } from "@/lib/billing/plans";
import { C, brandGradient } from "@/lib/design";

type Props = {
  /** Lifetime count of OutreachDrafts created by this org. */
  used: number;
};

/**
 * Trial-only counter that shows how many of the 25 free AI drafts the
 * org has consumed. Renders two states:
 *   • Below cap → a passive "X of 25 trial emails used" pill + progress
 *     bar that nudges toward upgrade but doesn't block.
 *   • At/above cap → an active upgrade card with the exact message the
 *     spec calls for and a primary CTA to /settings/billing.
 *
 * Page callers should only render this when isInUnpaidTrial(org) is
 * true. After upgrade or trial-end the component vanishes entirely.
 */
export function TrialAiCounter({ used }: Props) {
  const cap = TRIAL_AI_EMAIL_LIMIT;
  const clamped = Math.min(used, cap);
  const remaining = Math.max(0, cap - used);
  const pct = Math.min(100, Math.round((clamped / cap) * 100));
  const atCap = used >= cap;

  if (atCap) {
    return (
      <div
        style={{
          position: "relative",
          marginBottom: 24,
          padding: 2,
          borderRadius: 18,
          background: brandGradient,
          boxShadow:
            "0 14px 40px rgba(232,134,12,0.18), 0 4px 12px rgba(212,74,26,0.10)",
        }}
      >
        <div
          style={{
            backgroundColor: C.surface,
            borderRadius: 16,
            padding: "20px 22px",
            display: "flex",
            alignItems: "flex-start",
            gap: 14,
            flexWrap: "wrap",
          }}
        >
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              background: brandGradient,
              color: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              boxShadow: "0 6px 14px rgba(232,134,12,0.30)",
            }}
          >
            <Zap size={20} />
          </div>
          <div style={{ flex: 1, minWidth: 220 }}>
            <div
              style={{
                fontSize: 11,
                fontWeight: 800,
                color: C.amberDark,
                letterSpacing: 1.4,
                textTransform: "uppercase",
                marginBottom: 4,
              }}
            >
              Trial cap reached
            </div>
            <div
              style={{
                fontSize: 15,
                fontWeight: 700,
                color: C.text,
                marginBottom: 4,
              }}
            >
              You&rsquo;ve used all {cap} trial outreach drafts.
            </div>
            <div
              style={{
                fontSize: 13.5,
                lineHeight: 1.55,
                color: C.textBody,
                fontWeight: 500,
              }}
            >
              Upgrade to keep generating personalized outreach — plans
              start at $49/mo. You can still send everything you&rsquo;ve
              already drafted.
            </div>
          </div>
          <Link
            href="/settings/billing"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "12px 20px",
              borderRadius: 12,
              background: brandGradient,
              color: "#fff",
              fontSize: 14,
              fontWeight: 700,
              textDecoration: "none",
              boxShadow: "0 10px 24px rgba(232,134,12,0.30)",
              whiteSpace: "nowrap",
              flexShrink: 0,
            }}
          >
            Pick a plan <ArrowRight size={15} />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        marginBottom: 24,
        padding: "14px 18px",
        borderRadius: 14,
        backgroundColor: C.amberLight,
        border: `1px solid rgba(232,134,12,0.25)`,
        display: "flex",
        alignItems: "center",
        gap: 14,
        flexWrap: "wrap",
      }}
    >
      <Sparkles
        size={16}
        color={C.amberDark}
        style={{ flexShrink: 0, marginTop: 2 }}
      />
      <div style={{ flex: 1, minWidth: 220 }}>
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
            gap: 12,
            marginBottom: 6,
          }}
        >
          <span
            style={{
              fontSize: 13.5,
              fontWeight: 700,
              color: C.text,
            }}
          >
            <strong style={{ color: C.amberDark }}>{used}</strong> of {cap}{" "}
            trial emails used
          </span>
          <span
            style={{
              fontSize: 12.5,
              color: C.textBody,
              fontWeight: 600,
            }}
          >
            {remaining} left
          </span>
        </div>
        <div
          style={{
            height: 6,
            borderRadius: 100,
            backgroundColor: "rgba(0,0,0,0.06)",
            overflow: "hidden",
          }}
          aria-label={`${used} of ${cap} trial AI drafts used`}
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
      <Link
        href="/settings/billing"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          padding: "8px 14px",
          borderRadius: 10,
          backgroundColor: "transparent",
          color: C.amberDark,
          fontSize: 12.5,
          fontWeight: 700,
          textDecoration: "none",
          border: `1.5px solid ${C.amberDark}`,
          whiteSpace: "nowrap",
          flexShrink: 0,
        }}
      >
        Upgrade
      </Link>
    </div>
  );
}
