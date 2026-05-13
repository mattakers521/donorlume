"use client";

import { useState } from "react";
import Link from "next/link";
import { Check } from "lucide-react";

import { C, brandGradient, shadow } from "@/lib/design";

type Interval = "monthly" | "annual";

type Plan = {
  name: string;
  monthlyPrice: string | null;
  annualPrice: string | null;
  cadenceMonthly?: string;
  cadenceAnnual?: string;
  /** Custom-pricing tag (e.g. "Custom") shown instead of a number. */
  customLabel?: string;
  tagline?: string;
  bullets: string[];
  cta: string;
  ctaHref: string;
  popular?: boolean;
};

const PLANS: Plan[] = [
  {
    name: "Starter",
    monthlyPrice: "$49",
    annualPrice: "$39",
    cadenceMonthly: "/month",
    cadenceAnnual: "/month, billed annually",
    tagline: "For small teams getting strategic about fundraising.",
    bullets: [
      "Up to 2,500 donor records",
      "2 users",
      "Smart Segments (auto-cohort classification)",
      "Prospect Discovery",
      "Lapsed Donor Scoring",
      "50 AI outreach emails per month",
      "Email support",
    ],
    cta: "Start free trial",
    ctaHref: "/signup?plan=starter",
  },
  {
    name: "Growth",
    monthlyPrice: "$149",
    annualPrice: "$119",
    cadenceMonthly: "/month",
    cadenceAnnual: "/month, billed annually",
    tagline: "For development teams scaling their program.",
    bullets: [
      "Up to 10,000 donor records",
      "5 users",
      "Everything in Starter, plus:",
      "250 AI outreach emails per month",
      "Direct email sending with open/click tracking",
      "Cohort reporting & board-ready dashboards",
      "Campaign management",
      "Priority email + chat support",
    ],
    cta: "Start free trial",
    ctaHref: "/signup?plan=growth",
    popular: true,
  },
  {
    name: "Scale",
    monthlyPrice: "$499",
    annualPrice: "$399",
    cadenceMonthly: "/month",
    cadenceAnnual: "/month, billed annually",
    tagline: "For large orgs and multi-program fundraising.",
    bullets: [
      "Up to 50,000 donor records",
      "Unlimited users",
      "Everything in Growth, plus:",
      "Unlimited AI outreach emails",
      "Advanced cohort analytics & trajectory scoring",
      "API access",
      "Dedicated onboarding",
      "SLA + dedicated support",
    ],
    cta: "Start free trial",
    ctaHref: "/signup?plan=scale",
  },
  {
    name: "Managed",
    monthlyPrice: null,
    annualPrice: null,
    customLabel: "Custom",
    tagline: "Your team doesn't have time? Ours will run it for you.",
    bullets: [
      "Vibrant Causes operates DonorLume on your behalf",
      "Dedicated strategist",
      "Weekly reporting and recommendations",
      "Custom integrations",
    ],
    cta: "Contact us",
    ctaHref: "mailto:hello@donorlume.com?subject=Managed%20plan%20inquiry",
  },
];

export function LandingPricing() {
  // Avoid shadowing window.setInterval — see plan-comparison.tsx for
  // the full rationale.
  const [billingInterval, setBillingInterval] =
    useState<Interval>("monthly");

  return (
    <section
      id="pricing"
      style={{
        padding: "88px 24px",
        backgroundColor: C.bg,
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Soft amber glow centered behind the cards */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          width: 900,
          height: 700,
          top: "30%",
          left: "50%",
          transform: "translateX(-50%)",
          background:
            "radial-gradient(ellipse, rgba(232,134,12,0.10) 0%, transparent 65%)",
          pointerEvents: "none",
          filter: "blur(40px)",
        }}
      />

      <div style={{ position: "relative", maxWidth: 1200, margin: "0 auto" }}>
        <div
          style={{
            textAlign: "center",
            marginBottom: 40,
            maxWidth: 820,
            marginInline: "auto",
          }}
        >
          <div
            className="landing-amber-rule"
            aria-hidden
            style={{ width: 80, margin: "0 auto 28px" }}
          />
          <div
            style={{
              fontSize: 12,
              fontWeight: 800,
              color: C.amberDark,
              letterSpacing: 2,
              textTransform: "uppercase",
              marginBottom: 16,
            }}
          >
            Pricing
          </div>
          <h2
            className="landing-section-h2"
            style={{
              fontFamily: "var(--font-instrument-serif), Georgia, serif",
              fontWeight: 400,
              color: C.text,
              margin: "0 0 16px",
            }}
          >
            Real intelligence at real nonprofit prices.
          </h2>
          <p
            style={{
              fontSize: 17,
              lineHeight: 1.65,
              color: C.textBody,
              fontWeight: 500,
              margin: 0,
            }}
          >
            Start your free trial — you won&rsquo;t be charged until
            your 14-day trial ends.
          </p>
        </div>

        {/* Monthly / Annual toggle */}
        <div
          role="tablist"
          aria-label="Billing interval"
          style={{
            display: "flex",
            justifyContent: "center",
            marginBottom: 40,
          }}
        >
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              padding: 4,
              borderRadius: 100,
              backgroundColor: C.surface,
              border: `1px solid ${C.border}`,
              boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
            }}
          >
            <IntervalPill
              active={billingInterval === "monthly"}
              onClick={() => setBillingInterval("monthly")}
              label="Monthly"
            />
            <IntervalPill
              active={billingInterval === "annual"}
              onClick={() => setBillingInterval("annual")}
              label="Annual"
              badge="Save 20%"
            />
          </div>
        </div>

        <div className="landing-grid-4">
          {PLANS.map((plan) => (
            <PlanCard
              key={plan.name}
              plan={plan}
              interval={billingInterval}
            />
          ))}
        </div>

        <p
          style={{
            textAlign: "center",
            fontSize: 14,
            color: C.textBody,
            fontWeight: 500,
            maxWidth: 900,
            margin: "44px auto 0",
            lineHeight: 1.7,
          }}
        >
          All plans include: Smart Segments, Prospect Discovery, Lapsed
          Donor Scoring, AI Outreach Studio, multi-tenant data isolation,
          SSL encryption, and 99.9% uptime. Month-to-month billing. Cancel
          anytime. Your data is always yours.
        </p>
      </div>
    </section>
  );
}

function IntervalPill({
  active,
  onClick,
  label,
  badge,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  badge?: string;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "8px 18px",
        borderRadius: 100,
        border: "none",
        cursor: "pointer",
        fontSize: 13.5,
        fontWeight: 700,
        background: active ? brandGradient : "transparent",
        color: active ? "#fff" : C.text,
        boxShadow: active ? "0 4px 14px rgba(232,134,12,0.30)" : "none",
        fontFamily: "var(--font-jakarta), sans-serif",
        transition: "background 0.15s, color 0.15s",
      }}
    >
      {label}
      {badge && (
        <span
          style={{
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: 0.6,
            padding: "2px 6px",
            borderRadius: 6,
            background: active
              ? "rgba(255,255,255,0.22)"
              : C.amberLight,
            color: active ? "#fff" : C.amberDark,
          }}
        >
          {badge}
        </span>
      )}
    </button>
  );
}

function PlanCard({
  plan,
  interval,
}: {
  plan: Plan;
  interval: Interval;
}) {
  const isPopular = !!plan.popular;
  // Popular card goes DARK for maximum pop against the light surrounding
  // cards — the contrast is the point.
  const bg = isPopular ? C.dark : C.surface;
  const textPrimary = isPopular ? "#fff" : C.text;
  const textBody = isPopular ? C.textOnDarkBody : C.textBody;
  const textTertiaryColor = isPopular ? C.textOnDarkTertiary : C.textTertiary;

  const priceDisplay = plan.customLabel
    ? plan.customLabel
    : interval === "annual"
      ? plan.annualPrice
      : plan.monthlyPrice;
  const cadenceDisplay = plan.customLabel
    ? null
    : interval === "annual"
      ? plan.cadenceAnnual
      : plan.cadenceMonthly;

  return (
    <div
      style={{
        position: "relative",
        backgroundColor: bg,
        borderRadius: 22,
        padding: "32px 26px",
        boxShadow: isPopular
          ? "0 24px 60px rgba(20,20,22,0.28), 0 8px 24px rgba(232,134,12,0.18)"
          : shadow.md,
        border: isPopular
          ? `2px solid ${C.amber}`
          : `1px solid ${C.border}`,
        display: "flex",
        flexDirection: "column",
        transform: isPopular ? "translateY(-6px)" : "none",
      }}
    >
      {isPopular && (
        <div
          style={{
            position: "absolute",
            top: -13,
            left: "50%",
            transform: "translateX(-50%)",
            padding: "6px 16px",
            borderRadius: 100,
            background: brandGradient,
            color: "#fff",
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: 0.8,
            textTransform: "uppercase",
            boxShadow: "0 8px 20px rgba(232,134,12,0.4)",
            whiteSpace: "nowrap",
          }}
        >
          Most Popular
        </div>
      )}

      <div style={{ marginBottom: 18 }}>
        <div
          style={{
            fontSize: 13,
            fontWeight: 800,
            color: textTertiaryColor,
            textTransform: "uppercase",
            letterSpacing: 1.2,
            marginBottom: 12,
          }}
        >
          {plan.name}
        </div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
          <span
            style={{
              fontFamily: "var(--font-instrument-serif), Georgia, serif",
              fontSize: 46,
              fontWeight: 400,
              color: textPrimary,
              letterSpacing: -1.5,
              lineHeight: 1,
              ...(isPopular
                ? {
                    background: `linear-gradient(135deg, ${C.amberOnDark}, ${C.orange})`,
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                    backgroundClip: "text",
                  }
                : {}),
            }}
          >
            {priceDisplay}
          </span>
          {cadenceDisplay && (
            <span
              style={{
                fontSize: 13,
                color: textTertiaryColor,
                fontWeight: 600,
              }}
            >
              {cadenceDisplay}
            </span>
          )}
        </div>
        {plan.tagline && (
          <p
            style={{
              marginTop: 12,
              marginBottom: 0,
              fontSize: 13,
              lineHeight: 1.5,
              color: textBody,
              fontWeight: 500,
            }}
          >
            {plan.tagline}
          </p>
        )}
      </div>

      <ul
        style={{
          listStyle: "none",
          padding: 0,
          margin: "0 0 28px",
          display: "flex",
          flexDirection: "column",
          gap: 11,
          flex: 1,
        }}
      >
        {plan.bullets.map((b) => (
          <li
            key={b}
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 10,
              fontSize: 14,
              color: textBody,
              fontWeight: 500,
              lineHeight: 1.5,
            }}
          >
            <Check
              size={16}
              color={isPopular ? C.amberOnDark : C.amber}
              style={{ marginTop: 2, flexShrink: 0 }}
            />
            {b}
          </li>
        ))}
      </ul>

      <Link
        href={plan.ctaHref}
        style={{
          display: "block",
          textAlign: "center",
          padding: "13px 20px",
          borderRadius: 12,
          background: isPopular ? brandGradient : C.surface,
          border: isPopular ? "none" : `1.5px solid ${C.text}`,
          color: isPopular ? "#fff" : C.text,
          fontSize: 14,
          fontWeight: 700,
          textDecoration: "none",
          boxShadow: isPopular
            ? "0 10px 28px rgba(232,134,12,0.35)"
            : "none",
        }}
      >
        {plan.cta}
      </Link>
    </div>
  );
}
