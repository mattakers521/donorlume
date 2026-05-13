/**
 * Campaign-level aggregate helpers — used by the campaign list page,
 * the campaign report, and the dashboard "Recent Outreach" widget.
 *
 * Reads the denormalized counters on OutreachCampaign as the source of
 * truth for sent/delivered/opened/clicked/replied/bounced totals (the
 * tracking pipeline writes those atomically alongside the draft updates).
 */

import "server-only";

export type CampaignCounters = {
  totalDrafts: number;
  sentCount: number;
  deliveredCount: number;
  openedCount: number;
  clickedCount: number;
  repliedCount: number;
  bouncedCount: number;
};

export type CampaignMetrics = {
  sent: number;
  deliveredRate: number;
  openRate: number;
  clickRate: number;
  replyRate: number;
  bounceRate: number;
  /** Pre-formatted percentages so the UI can render directly. */
  deliveredPct: string;
  openPct: string;
  clickPct: string;
  replyPct: string;
  bouncePct: string;
};

/** 1.0-scale rate, divide-by-zero safe (returns 0). */
export function rate(num: number, denom: number): number {
  if (denom <= 0) return 0;
  return num / denom;
}

export function pctFmt(n: number, d: number): string {
  if (d <= 0) return "—";
  return `${Math.round((n / d) * 100)}%`;
}

export function deriveCampaignMetrics(c: CampaignCounters): CampaignMetrics {
  const sent = c.sentCount;
  return {
    sent,
    deliveredRate: rate(c.deliveredCount, sent),
    openRate: rate(c.openedCount, sent),
    clickRate: rate(c.clickedCount, sent),
    replyRate: rate(c.repliedCount, sent),
    bounceRate: rate(c.bouncedCount, sent),
    deliveredPct: pctFmt(c.deliveredCount, sent),
    openPct: pctFmt(c.openedCount, sent),
    clickPct: pctFmt(c.clickedCount, sent),
    replyPct: pctFmt(c.repliedCount, sent),
    bouncePct: pctFmt(c.bouncedCount, sent),
  };
}

/**
 * Cohort breakdown for a single campaign — Spec §7 "Cohort breakdown".
 * Walks the campaign's sent drafts, groups by each cohort the linked
 * donor belongs to, and computes per-cohort sent / open / click counts.
 *
 * Drafts from sample donors (donorId = null) contribute nothing to any
 * cohort bucket and are excluded from the breakdown entirely.
 */
export type CohortBreakdownRow = {
  cohortId: string;
  cohortName: string;
  cohortColor: string | null;
  sent: number;
  openRate: number;
  openPct: string;
  clickRate: number;
  clickPct: string;
};

type DraftForBreakdown = {
  sentAt: Date | string | null;
  openedAt: Date | string | null;
  clickedAt: Date | string | null;
  donor: {
    cohorts: {
      cohort: { id: string; name: string; color: string | null };
    }[];
  } | null;
};

export function cohortBreakdown(
  drafts: DraftForBreakdown[],
): CohortBreakdownRow[] {
  type Bucket = {
    cohortId: string;
    cohortName: string;
    cohortColor: string | null;
    sent: number;
    opened: number;
    clicked: number;
  };
  const buckets = new Map<string, Bucket>();

  for (const draft of drafts) {
    if (!draft.sentAt) continue; // only sent drafts count
    if (!draft.donor) continue; // sample drafts have no donor
    for (const { cohort } of draft.donor.cohorts) {
      let b = buckets.get(cohort.id);
      if (!b) {
        b = {
          cohortId: cohort.id,
          cohortName: cohort.name,
          cohortColor: cohort.color,
          sent: 0,
          opened: 0,
          clicked: 0,
        };
        buckets.set(cohort.id, b);
      }
      b.sent++;
      if (draft.openedAt) b.opened++;
      if (draft.clickedAt) b.clicked++;
    }
  }

  return [...buckets.values()]
    .map((b) => ({
      cohortId: b.cohortId,
      cohortName: b.cohortName,
      cohortColor: b.cohortColor,
      sent: b.sent,
      openRate: rate(b.opened, b.sent),
      openPct: pctFmt(b.opened, b.sent),
      clickRate: rate(b.clicked, b.sent),
      clickPct: pctFmt(b.clicked, b.sent),
    }))
    .sort((a, b) => b.sent - a.sent);
}
