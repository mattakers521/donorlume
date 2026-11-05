import "server-only";

import { TRIAL_AI_EMAIL_LIMIT } from "@/lib/billing/plans";
import { effectivePlan, isInUnpaidTrial } from "@/lib/billing/trial";
import { checkLimit } from "@/lib/billing/usage";
import type { PlanKey } from "@/lib/billing/plans";
import { prisma } from "@/lib/prisma";

/**
 * One AI cap shared by every AI generation in the product:
 *   • each OutreachDraft row (one per donor), and
 *   • each AiGeneration row (one per Assistants-hub generation — a
 *     Campaign Creator brief + 3 emails is still ONE).
 *
 * Unpaid-trial orgs get TRIAL_AI_EMAIL_LIMIT lifetime; everyone else
 * gets their effective plan's monthly aiEmailsPerMonth.
 */
export async function countAiUsage(
  orgId: string,
  since?: Date,
): Promise<number> {
  const createdAt = since ? { gte: since } : undefined;
  const [drafts, generations] = await Promise.all([
    prisma.outreachDraft.count({
      where: { campaign: { orgId }, ...(createdAt && { createdAt }) },
    }),
    prisma.aiGeneration.count({
      where: { orgId, ...(createdAt && { createdAt }) },
    }),
  ]);
  return drafts + generations;
}

/** Calendar-month start (UTC) — matches lib/billing/usage.ts. */
export function utcMonthStart(now = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

type CapOrg = {
  id: string;
  plan: PlanKey;
  trialEndsAt: Date | null;
  stripeSubscriptionId: string | null;
};

export type AiCapBlock = {
  error: string;
  limit: number;
  current: number;
  kind: "trialAiEmails" | "aiEmailsPerMonth";
};

/**
 * Returns null when one more generation is allowed, or the 402 body
 * when the org is at its cap.
 */
export async function checkAiCap(org: CapOrg): Promise<AiCapBlock | null> {
  if (
    isInUnpaidTrial({
      trialEndsAt: org.trialEndsAt,
      stripeSubscriptionId: org.stripeSubscriptionId,
    })
  ) {
    const used = await countAiUsage(org.id);
    if (used >= TRIAL_AI_EMAIL_LIMIT) {
      return {
        error: `You've used all ${TRIAL_AI_EMAIL_LIMIT} trial AI drafts. Upgrade to keep generating — plans start at $49/mo.`,
        limit: TRIAL_AI_EMAIL_LIMIT,
        current: used,
        kind: "trialAiEmails",
      };
    }
    return null;
  }

  const used = await countAiUsage(org.id, utcMonthStart());
  const planCheck = checkLimit(
    effectivePlan(org.plan, org.trialEndsAt),
    "aiEmailsPerMonth",
    used,
    1,
  );
  if (!planCheck.ok) {
    return {
      error: `${planCheck.planName} plan includes ${planCheck.limit.toLocaleString()} AI drafts per month. Upgrade to keep generating.`,
      limit: planCheck.limit,
      current: used,
      kind: "aiEmailsPerMonth",
    };
  }
  return null;
}

/** Lifetime trial usage for the TrialAiCounter, or null when not in an unpaid trial. */
export async function trialAiUsage(org: {
  id: string;
  trialEndsAt: Date | null;
  stripeSubscriptionId: string | null;
}): Promise<number | null> {
  return isInUnpaidTrial({
    trialEndsAt: org.trialEndsAt,
    stripeSubscriptionId: org.stripeSubscriptionId,
  })
    ? countAiUsage(org.id)
    : null;
}
