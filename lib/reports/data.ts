/**
 * Board-report data layer — one server-side helper drives both the
 * /reports page and the /api/reports/export CSV. Keeping the
 * aggregations in a single function means the page and the download
 * can never drift; what the Development Director sees on screen is
 * what shows up in the PDF/CSV.
 */

import "server-only";

import type { ProspectStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import {
  rangeLabel,
  rangeStart,
  type RangeKey,
} from "@/lib/reports/range";

// Re-export so callers that already destructure from `data.ts` (server
// pages, the export route) don't need to adjust imports.
export { RANGE_OPTIONS, parseRange, rangeLabel, rangeStart } from "@/lib/reports/range";
export type { RangeKey } from "@/lib/reports/range";

// ─── Result shapes ───────────────────────────────────────────────────

export type ReportOverview = {
  prospectsSaved: number;
  donorsScored: number;
  outreachSent: number;
  /** 0..1 — opens / sent over the range. `null` if no sends in range. */
  openRate: number | null;
  clickRate: number | null;
  donorsReactivated: number;
};

export type ReportCampaign = {
  id: string;
  name: string;
  createdAt: Date;
  sentCount: number;
  openedCount: number;
  clickedCount: number;
  repliedCount: number;
  openRate: number; // 0..1
  clickRate: number; // 0..1
  replyRate: number; // 0..1
};

export type CohortTrend = "growing" | "stable" | "n/a";

export type ReportCohort = {
  id: string;
  slug: string;
  name: string;
  family: string;
  memberCount: number;
  totalLifetimeValue: number;
  averageScore: number | null;
  newMembersInRange: number;
  trend: CohortTrend;
};

export type ReportPipelineStage = {
  status: ProspectStatus;
  label: string;
  count: number;
  /** Sum of `Prospect.revenue` for prospects in this stage. Used as a
   *  numeric proxy for capacity since `Prospect.capacity` is a
   *  free-form string and isn't reliably populated. */
  totalRevenue: number;
};

export type ReportData = {
  orgName: string;
  range: RangeKey;
  rangeLabel: string;
  rangeStart: Date | null;
  generatedAt: Date;
  overview: ReportOverview;
  campaigns: ReportCampaign[];
  cohorts: ReportCohort[];
  pipeline: ReportPipelineStage[];
  otherStageCount: number;
};

// ─── Status presentation ────────────────────────────────────────────

const PRIMARY_PIPELINE_ORDER: ProspectStatus[] = [
  "RESEARCHING",
  "WARM",
  "HOT",
  "CONTACTED",
  "CULTIVATING",
];

const STATUS_LABELS: Record<ProspectStatus, string> = {
  RESEARCHING: "Researching",
  WARM: "Warm",
  HOT: "Hot",
  CONTACTED: "Contacted",
  CULTIVATING: "Cultivating",
  ASKED: "Asked",
  COMMITTED: "Committed",
  DECLINED: "Declined",
  ARCHIVED: "Archived",
};

// ─── Main builder ───────────────────────────────────────────────────

/**
 * One-shot fetch + roll-up. Every aggregation is org-scoped (multi-tenant
 * safe per Spec §7) and respects the requested date range. The function
 * parallelizes its DB calls so the report renders in roughly one
 * round-trip's worth of latency even at scale.
 */
export async function getReportData(
  orgId: string,
  range: RangeKey,
  now: Date = new Date(),
): Promise<ReportData> {
  const start = rangeStart(range, now);
  const dateFilter = start ? { gte: start } : undefined;

  // Org name for the report header / CSV.
  const orgRow = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { name: true },
  });
  const orgName = orgRow?.name ?? "Your Organization";

  const [
    prospectsSaved,
    donorsScored,
    sentDrafts,
    repliedDrafts,
    campaigns,
    cohortRows,
    prospectsByStatus,
  ] = await Promise.all([
    // Total prospects saved (within range or all-time).
    prisma.prospect.count({
      where: { orgId, createdAt: dateFilter },
    }),
    // Total donors scored — uses Donor.createdAt to honor the range.
    prisma.donor.count({
      where: { donorList: { orgId }, createdAt: dateFilter },
    }),
    // Per-draft aggregates we'll roll up below. sentAt is the right
    // anchor here — drafts that were never sent shouldn't count.
    prisma.outreachDraft.findMany({
      where: {
        campaign: { orgId },
        sentAt: dateFilter ? { not: null, ...dateFilter } : { not: null },
      },
      select: {
        id: true,
        openCount: true,
        openedAt: true,
        clickedAt: true,
        repliedAt: true,
      },
    }),
    // Donors reactivated = drafts that got a reply IN the range.
    prisma.outreachDraft.count({
      where: {
        campaign: { orgId },
        repliedAt: dateFilter ? { not: null, ...dateFilter } : { not: null },
      },
    }),
    // Campaigns (use createdAt as the anchor; the counters themselves
    // are lifetime so we report the campaign's own lifetime performance).
    prisma.outreachCampaign.findMany({
      where: { orgId, createdAt: dateFilter },
      orderBy: { createdAt: "desc" },
    }),
    // Cohorts + members (with createdAt on the DonorCohort assignments
    // so we can derive the "new in range" trend signal).
    prisma.cohortDefinition.findMany({
      where: { orgId, isArchived: false },
      include: {
        members: {
          include: {
            donor: {
              select: {
                totalGiven: true,
                reactivationScore: true,
              },
            },
          },
        },
      },
    }),
    // Pipeline counts grouped by status. We also pull revenue to sum.
    prisma.prospect.groupBy({
      by: ["status"],
      where: { orgId },
      _count: { _all: true },
      _sum: { revenue: true },
    }),
  ]);

  // ─── Overview ────────────────────────────────────────────────────
  const outreachSent = sentDrafts.length;
  const opens = sentDrafts.filter(
    (d) => d.openCount > 0 || d.openedAt !== null,
  ).length;
  const clicks = sentDrafts.filter((d) => d.clickedAt !== null).length;
  const overview: ReportOverview = {
    prospectsSaved,
    donorsScored,
    outreachSent,
    openRate: outreachSent > 0 ? opens / outreachSent : null,
    clickRate: outreachSent > 0 ? clicks / outreachSent : null,
    donorsReactivated: repliedDrafts,
  };

  // ─── Outreach Performance ───────────────────────────────────────
  const campaignRows: ReportCampaign[] = campaigns.map((c) => {
    const denom = c.sentCount > 0 ? c.sentCount : 0;
    return {
      id: c.id,
      name: c.name,
      createdAt: c.createdAt,
      sentCount: c.sentCount,
      openedCount: c.openedCount,
      clickedCount: c.clickedCount,
      repliedCount: c.repliedCount,
      openRate: denom > 0 ? c.openedCount / denom : 0,
      clickRate: denom > 0 ? c.clickedCount / denom : 0,
      replyRate: denom > 0 ? c.repliedCount / denom : 0,
    };
  });

  // ─── Cohort Health ──────────────────────────────────────────────
  // "Growing" if any new DonorCohort assignments landed within the
  // range; "stable" otherwise. "n/a" for All-Time because every
  // assignment is by definition within range — the signal is meaningless.
  //
  // We don't have soft-deletes on DonorCohort, so "shrinking" isn't
  // reliably detectable. Documenting that here so future readers don't
  // chase the bug.
  const cohorts: ReportCohort[] = cohortRows
    .map((c) => {
      let total = 0;
      let scoreSum = 0;
      let scoredCount = 0;
      for (const m of c.members) {
        if (m.donor.totalGiven != null) total += m.donor.totalGiven;
        if (m.donor.reactivationScore != null) {
          scoreSum += m.donor.reactivationScore;
          scoredCount++;
        }
      }
      const newMembersInRange = start
        ? c.members.filter((m) => m.assignedAt >= start).length
        : c.members.length;

      let trend: CohortTrend;
      if (range === "all_time") trend = "n/a";
      else if (c.members.length === 0) trend = "stable";
      else trend = newMembersInRange > 0 ? "growing" : "stable";

      return {
        id: c.id,
        slug: c.slug,
        name: c.name,
        family: c.family,
        memberCount: c.members.length,
        totalLifetimeValue: total,
        averageScore:
          scoredCount > 0 ? Math.round(scoreSum / scoredCount) : null,
        newMembersInRange,
        trend,
      };
    })
    // Surface populated cohorts first, then sort the rest alphabetically
    // — keeps board-meeting attention on the cohorts that matter.
    .sort((a, b) => {
      if (a.memberCount !== b.memberCount) return b.memberCount - a.memberCount;
      return a.name.localeCompare(b.name);
    });

  // ─── Prospect Pipeline ──────────────────────────────────────────
  const byStatus = new Map<
    ProspectStatus,
    { count: number; revenue: number }
  >();
  for (const row of prospectsByStatus) {
    byStatus.set(row.status, {
      count: row._count._all,
      revenue: row._sum.revenue ?? 0,
    });
  }
  const pipeline: ReportPipelineStage[] = PRIMARY_PIPELINE_ORDER.map(
    (status) => {
      const v = byStatus.get(status);
      return {
        status,
        label: STATUS_LABELS[status],
        count: v?.count ?? 0,
        totalRevenue: v?.revenue ?? 0,
      };
    },
  );
  const otherStageCount = prospectsByStatus
    .filter((r) => !PRIMARY_PIPELINE_ORDER.includes(r.status))
    .reduce((sum, r) => sum + r._count._all, 0);

  return {
    orgName,
    range,
    rangeLabel: rangeLabel(range),
    rangeStart: start,
    generatedAt: now,
    overview,
    campaigns: campaignRows,
    cohorts,
    pipeline,
    otherStageCount,
  };
}
