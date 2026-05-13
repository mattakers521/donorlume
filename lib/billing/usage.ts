import "server-only";

import { getPlan, type PlanKey } from "@/lib/billing/plans";
import { prisma } from "@/lib/prisma";

export type OrgUsage = {
  donorRecords: number;
  aiEmailsThisMonth: number;
  seats: number;
};

/**
 * Returns the org's current usage across the three metered dimensions.
 * One Prisma transaction with three counts — Neon's pooled connection
 * handles this in a single round trip.
 */
export async function getOrgUsage(orgId: string): Promise<OrgUsage> {
  // Calendar-month boundary (UTC) — matches Stripe's metered billing
  // semantics and is what customers expect when they see "X/250 this month".
  const now = new Date();
  const monthStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
  );

  const [donorRecords, aiEmailsThisMonth, seats] = await Promise.all([
    prisma.donor.count({ where: { donorList: { orgId } } }),
    prisma.outreachDraft.count({
      where: {
        campaign: { orgId },
        createdAt: { gte: monthStart },
      },
    }),
    prisma.orgUser.count({ where: { orgId } }),
  ]);

  return { donorRecords, aiEmailsThisMonth, seats };
}

export type LimitCheck =
  | { ok: true; remaining: number | null }
  | {
      ok: false;
      limit: number;
      current: number;
      kind: LimitKind;
      planName: string;
    };

export type LimitKind = "donorRecords" | "aiEmailsPerMonth" | "seats";

/**
 * Plain check (no throw) — useful for UI gating where we want to render
 * an upgrade prompt instead of crashing.
 */
export function checkLimit(
  plan: PlanKey,
  kind: LimitKind,
  current: number,
  /** Number of new items this action is about to add (default 1). */
  delta = 1,
): LimitCheck {
  const def = getPlan(plan);
  const limit = def.limits[kind];
  if (limit === null) return { ok: true, remaining: null };
  if (current + delta > limit) {
    return {
      ok: false,
      limit,
      current,
      kind,
      planName: def.name,
    };
  }
  return { ok: true, remaining: limit - current - delta };
}

/**
 * Throwing variant for use inside route handlers. Maps to a clean 402
 * Payment Required at the API boundary — see formatPlanLimitError().
 */
export class PlanLimitError extends Error {
  readonly kind: LimitKind;
  readonly limit: number;
  readonly current: number;
  readonly planName: string;

  constructor(check: Extract<LimitCheck, { ok: false }>) {
    super(formatPlanLimitMessage(check));
    this.name = "PlanLimitError";
    this.kind = check.kind;
    this.limit = check.limit;
    this.current = check.current;
    this.planName = check.planName;
  }
}

export function assertWithinPlan(
  plan: PlanKey,
  kind: LimitKind,
  current: number,
  delta = 1,
): void {
  const check = checkLimit(plan, kind, current, delta);
  if (!check.ok) throw new PlanLimitError(check);
}

function formatPlanLimitMessage(
  check: Extract<LimitCheck, { ok: false }>,
): string {
  const labels: Record<LimitKind, string> = {
    donorRecords: "donor records",
    aiEmailsPerMonth: "AI outreach emails this month",
    seats: "team members",
  };
  return `Your ${check.planName} plan is limited to ${check.limit.toLocaleString()} ${
    labels[check.kind]
  }. Upgrade your plan to continue.`;
}
