"use client";

import { useState } from "react";

import { C } from "@/lib/design";
import { CheckoutPlanButton } from "@/components/billing/billing-actions";

export type PlanCardData = {
  key: "STARTER" | "GROWTH" | "SCALE" | "ENTERPRISE";
  name: string;
  monthlyPrice: string | null;
  annualPrice: string | null;
  tagline: string;
  /** Pre-formatted limits for the bullet list. */
  bullets: string[];
};

type Props = {
  plans: PlanCardData[];
  currentPlanKey: PlanCardData["key"];
};

/**
 * Plan-comparison grid for /settings/billing.
 *
 * Owns the Monthly/Annual toggle state. Each card delegates the actual
 * Checkout call to <CheckoutPlanButton interval={...}>, so the API
 * receives the selected interval verbatim.
 */
export function BillingPlanComparison({ plans, currentPlanKey }: Props) {
  // Variable name avoids shadowing window.setInterval — a destructured
  // `setInterval` collides with the global timer fn and can confuse
  // both dev tools and React's reconciler in subtle ways.
  const [billingInterval, setBillingInterval] = useState<
    "monthly" | "annual"
  >("monthly");

  return (
    <div>
      {/* Toggle */}
      <div
        role="tablist"
        aria-label="Billing interval"
        style={{
          display: "inline-flex",
          gap: 4,
          padding: 4,
          borderRadius: 100,
          backgroundColor: C.surface,
          border: `1px solid ${C.border}`,
          marginBottom: 18,
          boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
        }}
      >
        <IntervalBtn
          active={billingInterval === "monthly"}
          onClick={() => setBillingInterval("monthly")}
        >
          Monthly
        </IntervalBtn>
        <IntervalBtn
          active={billingInterval === "annual"}
          onClick={() => setBillingInterval("annual")}
          badge="Save 20%"
        >
          Annual
        </IntervalBtn>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 16,
        }}
      >
        {plans.map((p) => {
          const isCurrent = p.key === currentPlanKey;
          const isEnterprise = p.key === "ENTERPRISE";
          const priceText = isEnterprise
            ? "Custom"
            : billingInterval === "annual"
              ? p.annualPrice
              : p.monthlyPrice;
          const cadence = isEnterprise
            ? null
            : billingInterval === "annual"
              ? "/month, billed annually"
              : "/month";

          return (
            <div
              key={p.key}
              style={{
                backgroundColor: isCurrent ? C.amberLight : C.surface,
                borderRadius: 16,
                padding: 22,
                border: isCurrent
                  ? `1.5px solid ${C.amber}`
                  : `1px solid ${C.border}`,
                display: "flex",
                flexDirection: "column",
                gap: 10,
              }}
            >
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 800,
                  color: isCurrent ? C.amberDark : C.textTertiary,
                  letterSpacing: 1.2,
                  textTransform: "uppercase",
                }}
              >
                {p.name}
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  gap: 4,
                  flexWrap: "wrap",
                }}
              >
                <span
                  style={{
                    fontFamily:
                      "var(--font-instrument-serif), Georgia, serif",
                    fontSize: 30,
                    color: C.text,
                    letterSpacing: -0.8,
                    lineHeight: 1,
                  }}
                >
                  {priceText}
                </span>
                {cadence && (
                  <span
                    style={{
                      fontSize: 12,
                      color: C.textSecondary,
                      fontWeight: 600,
                    }}
                  >
                    {cadence}
                  </span>
                )}
              </div>
              <p
                style={{
                  fontSize: 13,
                  lineHeight: 1.5,
                  color: C.textBody,
                  margin: 0,
                  fontWeight: 500,
                  minHeight: 38,
                }}
              >
                {p.tagline}
              </p>
              <ul
                style={{
                  listStyle: "none",
                  padding: 0,
                  margin: "4px 0 0",
                  fontSize: 12.5,
                  color: C.textBody,
                  fontWeight: 500,
                  lineHeight: 1.6,
                }}
              >
                {p.bullets.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>

              <div style={{ marginTop: "auto", paddingTop: 14 }}>
                {isCurrent ? (
                  <button
                    type="button"
                    disabled
                    style={{
                      display: "block",
                      width: "100%",
                      padding: "10px 14px",
                      borderRadius: 10,
                      backgroundColor: C.surface,
                      color: C.textSecondary,
                      fontSize: 13,
                      fontWeight: 700,
                      border: `1px solid ${C.border}`,
                      cursor: "not-allowed",
                      textAlign: "center",
                      fontFamily: "var(--font-jakarta), sans-serif",
                    }}
                  >
                    Current plan
                  </button>
                ) : isEnterprise ? (
                  <a
                    href="mailto:hello@donorlume.com?subject=Managed%20plan%20inquiry"
                    style={{
                      display: "block",
                      width: "100%",
                      padding: "10px 14px",
                      borderRadius: 10,
                      backgroundColor: "transparent",
                      color: C.text,
                      fontSize: 13,
                      fontWeight: 700,
                      border: `1.5px solid ${C.text}`,
                      textAlign: "center",
                      textDecoration: "none",
                      fontFamily: "var(--font-jakarta), sans-serif",
                    }}
                  >
                    Contact us
                  </a>
                ) : (
                  <CheckoutPlanButton
                    planKey={p.key as "STARTER" | "GROWTH" | "SCALE"}
                    interval={billingInterval}
                    label={
                      isHigherTier(p.key, currentPlanKey)
                        ? "Upgrade to this plan"
                        : "Switch to this plan"
                    }
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function IntervalBtn({
  active,
  onClick,
  badge,
  children,
}: {
  active: boolean;
  onClick: () => void;
  badge?: string;
  children: React.ReactNode;
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
        padding: "8px 16px",
        borderRadius: 100,
        border: "none",
        cursor: "pointer",
        fontSize: 13,
        fontWeight: 700,
        background: active
          ? `linear-gradient(135deg, ${C.amber}, ${C.orange})`
          : "transparent",
        color: active ? "#fff" : C.text,
        boxShadow: active ? "0 4px 12px rgba(232,134,12,0.28)" : "none",
        fontFamily: "var(--font-jakarta), sans-serif",
        transition: "background 0.15s, color 0.15s",
      }}
    >
      {children}
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

const PLAN_RANK: Record<string, number> = {
  STARTER: 1,
  GROWTH: 2,
  SCALE: 3,
  ENTERPRISE: 4,
};
function isHigherTier(target: string, current: string): boolean {
  return (PLAN_RANK[target] ?? 0) > (PLAN_RANK[current] ?? 0);
}
