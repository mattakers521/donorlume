import Link from "next/link";

import { getPlan, PLAN_ORDER, PLANS, type PlanKey } from "@/lib/billing/plans";
import { effectivePlan, isInTrial, trialDaysRemaining } from "@/lib/billing/trial";
import { getOrgUsage } from "@/lib/billing/usage";
import { C } from "@/lib/design";
import { getOrgContext } from "@/lib/with-org";
import {
  BillingActions,
} from "@/components/billing/billing-actions";
import {
  BillingPlanComparison,
  type PlanCardData,
} from "@/components/billing/plan-comparison";
import { ReloadOnReturn } from "@/components/billing/reload-on-return";
import { UsageMeter } from "@/components/billing/usage-meter";

export const dynamic = "force-dynamic";

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ checkout?: string }>;
}) {
  const { org } = await getOrgContext();
  const usage = await getOrgUsage(org.id);
  const { checkout } = await searchParams;

  // Trial-aware: show meters against the effective plan (Growth during
  // trial), but keep the "current plan" card honest about what the user
  // selected vs. what they're temporarily experiencing.
  const selectedPlan = getPlan(org.plan);
  const effectivePlanKey = effectivePlan(org.plan, org.trialEndsAt);
  const effective = getPlan(effectivePlanKey);
  const inTrial = isInTrial(org.trialEndsAt);
  const trialDays = trialDaysRemaining(org.trialEndsAt);
  const hasStripeCustomer = !!org.stripeCustomerId;
  const isCanceling = org.cancelAtPeriodEnd === true;
  const status = org.stripeStatus ?? (inTrial ? "trialing" : "active");
  const renewsAt = org.currentPeriodEnd
    ? new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      }).format(org.currentPeriodEnd)
    : null;

  const comparisonPlans: PlanCardData[] = PLAN_ORDER.map((key) => {
    const p = PLANS[key];
    return {
      key,
      name: p.name,
      monthlyPrice: p.monthlyPrice,
      annualPrice: p.annualPrice,
      tagline: p.tagline,
      bullets: [
        p.limits.donorRecords
          ? `${p.limits.donorRecords.toLocaleString()} donor records`
          : "Unlimited records",
        p.limits.aiEmailsPerMonth
          ? `${p.limits.aiEmailsPerMonth.toLocaleString()} AI emails/mo`
          : "Unlimited AI emails",
        p.limits.seats ? `${p.limits.seats} seats` : "Unlimited seats",
      ],
    };
  });

  return (
    <div style={{ padding: "32px clamp(20px, 4vw, 40px) 80px" }}>
      {/* Auto-reload when the user returns to this page after kicking
          off a Stripe Checkout (any path — back button, tab switch,
          closing the Stripe tab). Reads the sessionStorage flag set
          by <CheckoutPlanButton /> + <BillingActions />. */}
      <ReloadOnReturn />
      <div style={{ maxWidth: 980, margin: "0 auto" }}>
        <header style={{ marginBottom: 28 }}>
          <h1
            style={{
              fontFamily: "var(--font-instrument-serif), Georgia, serif",
              fontSize: "clamp(28px, 4vw, 36px)",
              fontWeight: 400,
              color: C.text,
              margin: "0 0 6px",
              letterSpacing: -1,
            }}
          >
            Billing
          </h1>
          <p
            style={{
              fontSize: 15,
              color: C.textBody,
              fontWeight: 500,
              margin: 0,
            }}
          >
            Your subscription, usage, and plan options.
          </p>
        </header>

        {checkout === "success" && (
          <Banner
            tone="success"
            title="Subscription updated."
            body="Thanks — Stripe is processing the payment. Your new plan limits should appear here within a few seconds."
          />
        )}
        {checkout === "cancel" && (
          <Banner
            tone="neutral"
            title="Checkout canceled."
            body="No worries — your current plan is unchanged."
          />
        )}
        {status === "past_due" && (
          <Banner
            tone="warning"
            title="Payment failed."
            body="Your last invoice failed. Update your payment method in the billing portal to keep DonorLume active."
          />
        )}

        {/* ─── Trial banner ─── */}
        {inTrial && (
          <div
            style={{
              position: "relative",
              borderRadius: 18,
              padding: 2,
              background: `linear-gradient(135deg, ${C.amber}, ${C.orange})`,
              boxShadow:
                "0 12px 32px rgba(232,134,12,0.18), 0 4px 12px rgba(212,74,26,0.10)",
              marginBottom: 18,
            }}
          >
            <div
              style={{
                backgroundColor: C.surface,
                borderRadius: 16,
                padding: "18px 22px",
                display: "flex",
                alignItems: "center",
                gap: 16,
                flexWrap: "wrap",
              }}
            >
              <div style={{ flex: 1, minWidth: 220 }}>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 800,
                    color: C.amberDark,
                    letterSpacing: 1.4,
                    textTransform: "uppercase",
                    marginBottom: 6,
                  }}
                >
                  Free trial · {trialDays} day{trialDays === 1 ? "" : "s"} left
                </div>
                <div
                  style={{
                    fontSize: 15,
                    fontWeight: 700,
                    color: C.text,
                    marginBottom: 4,
                  }}
                >
                  You&rsquo;re experiencing the full Growth tier.
                </div>
                <div
                  style={{
                    fontSize: 13.5,
                    lineHeight: 1.55,
                    color: C.textBody,
                    fontWeight: 500,
                  }}
                >
                  Start your free trial — you won&rsquo;t be charged until
                  your trial ends. Pick a plan below to keep your current
                  capacity past the 14-day window.
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ─── Current plan card ─── */}
        <section
          style={{
            backgroundColor: C.surface,
            borderRadius: 20,
            padding: "clamp(20px, 3vw, 32px)",
            border: `1px solid ${C.border}`,
            boxShadow:
              "0 4px 16px rgba(0,0,0,0.04), 0 1px 4px rgba(0,0,0,0.03)",
            marginBottom: 24,
          }}
        >
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 20,
              justifyContent: "space-between",
              alignItems: "flex-start",
              marginBottom: 24,
            }}
          >
            <div>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 800,
                  color: C.amberDark,
                  letterSpacing: 1.4,
                  textTransform: "uppercase",
                  marginBottom: 8,
                }}
              >
                {inTrial ? "Trial access" : "Current plan"}
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  gap: 10,
                  flexWrap: "wrap",
                }}
              >
                <span
                  style={{
                    fontFamily:
                      "var(--font-instrument-serif), Georgia, serif",
                    fontSize: 36,
                    color: C.text,
                    letterSpacing: -1,
                    lineHeight: 1,
                  }}
                >
                  {inTrial ? effective.name : selectedPlan.name}
                </span>
                {!inTrial && selectedPlan.monthlyPrice && (
                  <span
                    style={{
                      fontSize: 18,
                      color: C.textSecondary,
                      fontWeight: 600,
                    }}
                  >
                    {selectedPlan.monthlyPrice}/month
                  </span>
                )}
              </div>
              {inTrial && (
                <div
                  style={{
                    marginTop: 6,
                    fontSize: 13,
                    color: C.textSecondary,
                    fontWeight: 500,
                  }}
                >
                  Selected plan after trial:{" "}
                  <strong style={{ color: C.text }}>
                    {selectedPlan.name}
                  </strong>{" "}
                  — change below at any time.
                </div>
              )}
              <div
                style={{
                  marginTop: 12,
                  display: "flex",
                  gap: 10,
                  flexWrap: "wrap",
                }}
              >
                <StatusPill status={status} />
                {isCanceling && <StatusPill status="cancels-at-period-end" />}
                {renewsAt && (
                  <span
                    style={{
                      fontSize: 13,
                      color: C.textSecondary,
                      fontWeight: 600,
                    }}
                  >
                    {isCanceling ? "Ends" : "Renews"} {renewsAt}
                  </span>
                )}
              </div>
            </div>

            <BillingActions hasStripeCustomer={hasStripeCustomer} />
          </div>

          {/* Usage meters — show against effective (trial = Growth) limits */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 16,
            }}
          >
            <UsageMeter
              label="Donor records"
              current={usage.donorRecords}
              limit={effective.limits.donorRecords}
            />
            <UsageMeter
              label="AI emails this month"
              current={usage.aiEmailsThisMonth}
              limit={effective.limits.aiEmailsPerMonth}
            />
            <UsageMeter
              label="Team members"
              current={usage.seats}
              limit={effective.limits.seats}
            />
          </div>
        </section>

        {/* ─── Plan comparison ─── */}
        <section>
          <h2
            style={{
              fontFamily: "var(--font-instrument-serif), Georgia, serif",
              fontSize: 24,
              fontWeight: 400,
              color: C.text,
              margin: "0 0 16px",
              letterSpacing: -0.5,
            }}
          >
            Choose a plan
          </h2>

          <BillingPlanComparison
            plans={comparisonPlans}
            currentPlanKey={selectedPlan.key as PlanKey}
          />

          <p
            style={{
              marginTop: 24,
              fontSize: 13,
              lineHeight: 1.6,
              color: C.textBody,
              fontWeight: 500,
            }}
          >
            Switching to a higher tier prorates instantly. Downgrades take
            effect at the next renewal so you keep the features you paid
            for through the current period.{" "}
            <Link
              href="/help"
              style={{ color: C.amberDark, fontWeight: 700 }}
            >
              Questions?
            </Link>
          </p>
        </section>
      </div>
    </div>
  );
}

// ─── Subcomponents ────────────────────────────────────────────────────

function Banner({
  tone,
  title,
  body,
}: {
  tone: "success" | "warning" | "neutral";
  title: string;
  body: string;
}) {
  const palette = {
    success: { bg: C.greenLight, fg: "#1B5E20", accent: C.green },
    warning: { bg: "#FFF4E5", fg: "#7A3A00", accent: C.amberDark },
    neutral: { bg: C.surfaceHover, fg: C.text, accent: C.textTertiary },
  }[tone];
  return (
    <div
      style={{
        backgroundColor: palette.bg,
        borderLeft: `4px solid ${palette.accent}`,
        color: palette.fg,
        padding: "14px 18px",
        borderRadius: 12,
        marginBottom: 16,
      }}
    >
      <div style={{ fontWeight: 700, marginBottom: 2 }}>{title}</div>
      <div style={{ fontSize: 14, lineHeight: 1.5 }}>{body}</div>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const label =
    {
      active: "Active",
      trialing: "Trial",
      trial: "Trial",
      past_due: "Past due",
      canceled: "Canceled",
      incomplete: "Incomplete",
      "cancels-at-period-end": "Cancels at period end",
    }[status] ?? status;

  const palette =
    {
      active: { bg: C.greenLight, fg: "#1B5E20" },
      trialing: { bg: C.amberLight, fg: C.amberDark },
      trial: { bg: C.amberLight, fg: C.amberDark },
      past_due: { bg: C.redLight, fg: C.red },
      canceled: { bg: C.surfaceHover, fg: C.textSecondary },
      incomplete: { bg: C.redLight, fg: C.red },
      "cancels-at-period-end": { bg: C.surfaceHover, fg: C.textSecondary },
    }[status] ?? { bg: C.surfaceHover, fg: C.textSecondary };

  return (
    <span
      style={{
        display: "inline-block",
        padding: "4px 10px",
        borderRadius: 100,
        backgroundColor: palette.bg,
        color: palette.fg,
        fontSize: 11,
        fontWeight: 800,
        letterSpacing: 0.8,
        textTransform: "uppercase",
      }}
    >
      {label}
    </span>
  );
}
