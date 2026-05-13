/**
 * 14-day free trial helpers.
 *
 * Every new Organization gets `trialEndsAt = createdAt + 14 days` and
 * `stripeStatus = "trialing"` stamped at signup. During the trial the
 * org gets Growth-tier limits regardless of which plan their `Plan`
 * column actually holds — that way users experience the full product
 * before they pick a tier.
 *
 * No Stripe interaction is required to start a trial. When the user
 * eventually hits Stripe Checkout the route passes `trial_end =
 * trialEndsAt.unix()` so Stripe honors the in-app trial start time
 * (we don't double-trial them).
 */

import { TRIAL_DAYS, TRIAL_PLAN, type PlanKey } from "@/lib/billing/plans";

export function isInTrial(
  trialEndsAt: Date | null,
  now: Date = new Date(),
): boolean {
  return trialEndsAt !== null && trialEndsAt > now;
}

/**
 * Computes the trial end timestamp stamped on Organization at signup.
 *
 * Adds a 12-hour buffer beyond the 14-day window so Stripe's floor-
 * rounded "days remaining" display always reads 14 (not 13) when the
 * user reaches Checkout. Without the buffer, the few-seconds-to-minutes
 * delay between signup and first checkout drops the remaining seconds
 * below `14 * 86400`, and Stripe shows 13.
 *
 * The buffer also gives the user a humane half-day of grace if they
 * sign up late at night and hit the trial wall the next evening.
 */
const TRIAL_BUFFER_MS = 12 * 60 * 60 * 1000;

export function computeTrialEndsAt(now: Date = new Date()): Date {
  return new Date(
    now.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000 + TRIAL_BUFFER_MS,
  );
}

/**
 * In trial AND hasn't paid yet — these are the orgs subject to the
 * 25-total AI-email cap. The moment a user completes Stripe Checkout
 * (which sets stripeSubscriptionId), they're on their plan's monthly
 * cap regardless of whether the 14-day trial window is still running.
 */
export function isInUnpaidTrial(
  org: { trialEndsAt: Date | null; stripeSubscriptionId: string | null },
  now: Date = new Date(),
): boolean {
  return isInTrial(org.trialEndsAt, now) && !org.stripeSubscriptionId;
}

/**
 * Returns the tier whose limits should actually apply to this org
 * right now: Growth during the trial window, otherwise the column
 * value. Limit enforcement, the billing-page meters, and the
 * onboarding checklist all read from this helper instead of the raw
 * Plan column so the trial uplift is transparent to callers.
 */
export function effectivePlan(
  plan: PlanKey,
  trialEndsAt: Date | null,
  now: Date = new Date(),
): PlanKey {
  return isInTrial(trialEndsAt, now) ? TRIAL_PLAN : plan;
}

/**
 * Whole days remaining in the trial. Returns 0 once expired (never
 * negative). Useful for the "Free trial — N days left" banner.
 */
export function trialDaysRemaining(
  trialEndsAt: Date | null,
  now: Date = new Date(),
): number {
  if (!trialEndsAt) return 0;
  const ms = trialEndsAt.getTime() - now.getTime();
  if (ms <= 0) return 0;
  return Math.ceil(ms / (24 * 60 * 60 * 1000));
}
