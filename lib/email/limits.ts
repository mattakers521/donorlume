/**
 * Send-rate safeguards — protect shared sending reputation and recipient
 * inboxes from spam-trigger patterns.
 *
 * Three checks layered on top of every outbound send:
 *   1. `HOURLY_CAP` — at most 50 sends per org per rolling 60-minute window.
 *   2. Plan-tier daily cap — Starter 100 / Growth 250 / Scale 500 / Enterprise unlimited.
 *      Resets at UTC midnight.
 *   3. 7-day recipient dedup — same `recipientEmail` can't receive two sends
 *      from the same org within `RECIPIENT_DEDUP_DAYS`. Confirmable from
 *      the UI (the route handler accepts `?confirmDuplicate=true`).
 *
 * Each helper returns structured data so the API route can map the failure
 * mode to the right HTTP status without losing detail:
 *   - 429 hourly cap exceeded   → `nextSlotAt` for client auto-resume
 *   - 402 daily cap exceeded    → `dailyCap` / `dailyUsed` / `planName`
 *   - 409 dedup conflict        → recipient + days-ago + last campaign name
 */

import "server-only";

import { getPlan, type PlanKey } from "@/lib/billing/plans";
import { prisma } from "@/lib/prisma";

/** Hard rolling-hour cap. Independent of plan tier — applies to every org. */
export const HOURLY_CAP = 50;

/** Window for the duplicate-recipient warning (days). */
export const RECIPIENT_DEDUP_DAYS = 7;

export type CapStatus = {
  /** Sends already counted in the window. */
  used: number;
  /** Hard cap (null = unlimited — only possible for plan-tier daily caps). */
  cap: number | null;
  /** Sends remaining before the cap. null when `cap` is null. */
  remaining: number | null;
  /**
   * ISO timestamp when the next slot opens. Always defined for the
   * hourly cap when used > 0 (= oldest send + 1h). null when room exists
   * now or when the cap is null.
   */
  nextSlotAt: string | null;
  /** Window-reset timestamp. For daily, this is the next UTC midnight. */
  resetsAt: string;
};

/**
 * Rolling 1-hour window. Counts sends with `sentAt > now - 1h` and
 * returns the oldest one's expiry as `nextSlotAt` so the UI can show a
 * precise auto-resume time after hitting the cap.
 */
export async function getHourlyStatus(orgId: string): Promise<CapStatus> {
  const now = new Date();
  const windowStart = new Date(now.getTime() - 60 * 60 * 1000);
  const windowEnd = new Date(now.getTime() + 60 * 60 * 1000);

  const recent = await prisma.outreachDraft.findMany({
    where: {
      campaign: { orgId },
      sentAt: { gt: windowStart },
    },
    select: { sentAt: true },
    orderBy: { sentAt: "asc" },
  });

  const used = recent.length;
  const remaining = Math.max(0, HOURLY_CAP - used);
  const oldest = recent[0]?.sentAt;
  const nextSlotAt =
    used >= HOURLY_CAP && oldest
      ? new Date(oldest.getTime() + 60 * 60 * 1000).toISOString()
      : null;

  return {
    used,
    cap: HOURLY_CAP,
    remaining,
    nextSlotAt,
    resetsAt: windowEnd.toISOString(),
  };
}

/**
 * UTC calendar-day cap by plan tier. Returns `cap: null` for ENTERPRISE
 * (unlimited) — the route handler should bypass the limit check in that
 * case rather than treating `remaining: null` as zero.
 */
export async function getDailyStatus(
  orgId: string,
  plan: PlanKey,
): Promise<CapStatus & { planName: string }> {
  const cap = getPlan(plan).limits.emailSendsPerDay;
  const planName = getPlan(plan).name;

  const now = new Date();
  const dayStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

  const used = await prisma.outreachDraft.count({
    where: {
      campaign: { orgId },
      sentAt: { gte: dayStart, lt: dayEnd },
    },
  });

  return {
    used,
    cap,
    remaining: cap === null ? null : Math.max(0, cap - used),
    nextSlotAt:
      cap !== null && used >= cap ? dayEnd.toISOString() : null,
    resetsAt: dayEnd.toISOString(),
    planName,
  };
}

export type RecipientConflict = {
  recipientName: string;
  /** Whole days (rounded down) since the last send. 0 = earlier today. */
  daysAgo: number;
  campaignName: string | null;
  /** When the conflict expires and the recipient can be emailed again. */
  cooldownEndsAt: string;
};

/**
 * Returns the most recent send to `email` from this org within the last
 * `RECIPIENT_DEDUP_DAYS` days, if any. Excludes the draft being sent
 * (caller passes its own id) so a retry on an already-attempted draft
 * doesn't self-block.
 */
export async function findRecentRecipient(
  orgId: string,
  recipientEmail: string,
  excludeDraftId: string,
): Promise<RecipientConflict | null> {
  const since = new Date(
    Date.now() - RECIPIENT_DEDUP_DAYS * 24 * 60 * 60 * 1000,
  );

  const last = await prisma.outreachDraft.findFirst({
    where: {
      campaign: { orgId },
      id: { not: excludeDraftId },
      recipientEmail: { equals: recipientEmail, mode: "insensitive" },
      sentAt: { gte: since },
    },
    orderBy: { sentAt: "desc" },
    select: {
      sentAt: true,
      recipientName: true,
      campaign: { select: { name: true } },
    },
  });

  if (!last || !last.sentAt) return null;

  const msAgo = Date.now() - last.sentAt.getTime();
  const daysAgo = Math.floor(msAgo / (24 * 60 * 60 * 1000));
  const cooldownEndsAt = new Date(
    last.sentAt.getTime() + RECIPIENT_DEDUP_DAYS * 24 * 60 * 60 * 1000,
  );

  return {
    recipientName: last.recipientName,
    daysAgo,
    campaignName: last.campaign.name,
    cooldownEndsAt: cooldownEndsAt.toISOString(),
  };
}
