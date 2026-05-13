/**
 * Plan catalog — single source of truth for the four DonorLume tiers
 * across monthly + annual billing intervals.
 *
 * Tier limits (donor records, AI emails/mo, seats) drive both the
 * /settings/billing UI and the runtime enforcement helper in
 * lib/billing/usage.ts. Stripe price IDs come from env (two per
 * recurring tier — monthly and annual; ENTERPRISE is a sales-contact
 * tier with no Stripe price).
 *
 * Editing this file is editing the product. Keep names/limits aligned
 * with the landing-page Pricing section and the marketing copy.
 */

import type { Plan } from "@prisma/client";

export type PlanKey = Plan; // "STARTER" | "GROWTH" | "SCALE" | "ENTERPRISE"
export type BillingInterval = "monthly" | "annual";

export type PlanDefinition = {
  key: PlanKey;
  name: string;
  /** Public monthly price (e.g. "$49"). `null` for ENTERPRISE. */
  monthlyPrice: string | null;
  /** Per-month price when billed annually (e.g. "$39"). `null` for ENTERPRISE. */
  annualPrice: string | null;
  /** Marketing one-liner. */
  tagline: string;
  /** Hard caps. `null` = unlimited. */
  limits: {
    donorRecords: number | null;
    aiEmailsPerMonth: number | null;
    seats: number | null;
  };
  /** Stripe price IDs — null for ENTERPRISE / when env var is unset. */
  stripePriceIdMonthly: string | null;
  stripePriceIdAnnual: string | null;
  /** Feature flags surfaced in the UI / used by gating logic. */
  features: {
    directEmailSending: boolean;
    cohortReporting: boolean;
    apiAccess: boolean;
    dedicatedSupport: boolean;
  };
};

const priceFromEnv = (key: string): string | null => {
  const v = process.env[key]?.trim();
  if (!v || v.startsWith("price_REPLACE")) return null;
  return v;
};

export const PLANS: Record<PlanKey, PlanDefinition> = {
  STARTER: {
    key: "STARTER",
    name: "Starter",
    monthlyPrice: "$49",
    annualPrice: "$39",
    tagline: "For small teams getting strategic about fundraising.",
    limits: {
      donorRecords: 2_500,
      aiEmailsPerMonth: 50,
      seats: 2,
    },
    stripePriceIdMonthly: priceFromEnv("STRIPE_PRICE_STARTER"),
    stripePriceIdAnnual: priceFromEnv("STRIPE_PRICE_STARTER_ANNUAL"),
    features: {
      directEmailSending: false,
      cohortReporting: false,
      apiAccess: false,
      dedicatedSupport: false,
    },
  },
  GROWTH: {
    key: "GROWTH",
    name: "Growth",
    monthlyPrice: "$149",
    annualPrice: "$119",
    tagline: "For development teams scaling their program.",
    limits: {
      donorRecords: 10_000,
      aiEmailsPerMonth: 250,
      seats: 5,
    },
    stripePriceIdMonthly: priceFromEnv("STRIPE_PRICE_GROWTH"),
    stripePriceIdAnnual: priceFromEnv("STRIPE_PRICE_GROWTH_ANNUAL"),
    features: {
      directEmailSending: true,
      cohortReporting: true,
      apiAccess: false,
      dedicatedSupport: false,
    },
  },
  SCALE: {
    key: "SCALE",
    name: "Scale",
    monthlyPrice: "$499",
    annualPrice: "$399",
    tagline: "For large orgs and multi-program fundraising.",
    limits: {
      donorRecords: 50_000,
      aiEmailsPerMonth: null,
      seats: null,
    },
    stripePriceIdMonthly: priceFromEnv("STRIPE_PRICE_SCALE"),
    stripePriceIdAnnual: priceFromEnv("STRIPE_PRICE_SCALE_ANNUAL"),
    features: {
      directEmailSending: true,
      cohortReporting: true,
      apiAccess: true,
      dedicatedSupport: true,
    },
  },
  ENTERPRISE: {
    key: "ENTERPRISE",
    name: "Managed",
    monthlyPrice: null,
    annualPrice: null,
    tagline: "Your team doesn't have time? Ours will run it for you.",
    limits: {
      donorRecords: null,
      aiEmailsPerMonth: null,
      seats: null,
    },
    stripePriceIdMonthly: null,
    stripePriceIdAnnual: null,
    features: {
      directEmailSending: true,
      cohortReporting: true,
      apiAccess: true,
      dedicatedSupport: true,
    },
  },
};

export const PLAN_ORDER: PlanKey[] = ["STARTER", "GROWTH", "SCALE", "ENTERPRISE"];

/** Trial tier — every new org gets Growth-level limits for 14 days. */
export const TRIAL_PLAN: PlanKey = "GROWTH";
export const TRIAL_DAYS = 14;

/**
 * Hard cap on AI outreach drafts for unpaid-trial orgs. Independent of
 * the per-month plan caps — applies LIFETIME across the trial. Sending
 * the resulting drafts (Resend dispatch) is unrestricted so users
 * experience the full open/click/reply tracking pipeline. Switches off
 * the moment they upgrade — paid orgs go back to their plan's monthly
 * `aiEmailsPerMonth` limit.
 */
export const TRIAL_AI_EMAIL_LIMIT = 25;

export function getPlan(key: PlanKey): PlanDefinition {
  return PLANS[key];
}

export function getStripePriceId(
  key: PlanKey,
  interval: BillingInterval,
): string | null {
  const p = PLANS[key];
  return interval === "annual" ? p.stripePriceIdAnnual : p.stripePriceIdMonthly;
}

/**
 * Reverse-lookup: given a Stripe price ID (e.g. from a webhook payload),
 * return the matching plan and the interval the customer chose. Returns
 * null if the price ID isn't one of ours (could happen during a
 * price-list migration).
 */
export function planFromPriceId(
  priceId: string,
): { plan: PlanDefinition; interval: BillingInterval } | null {
  for (const p of Object.values(PLANS)) {
    if (p.stripePriceIdMonthly === priceId) {
      return { plan: p, interval: "monthly" };
    }
    if (p.stripePriceIdAnnual === priceId) {
      return { plan: p, interval: "annual" };
    }
  }
  return null;
}
