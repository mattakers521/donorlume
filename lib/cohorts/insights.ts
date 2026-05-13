/**
 * Org-scoped cohort aggregates for the overview grid, detail header,
 * and dashboard widget.
 *
 * One Prisma query gives us cohort defs + their members in a single
 * round-trip; everything else is computed in memory.
 */

import "server-only";

import type { CohortDefinition, Donor } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export type CohortInsight = {
  cohort: CohortDefinition;
  memberCount: number;
  totalLifetimeValue: number;
  averageScore: number | null;
  averageGift: number | null;
  lapsedShare: number; // 0..1 — fraction of members where isLapsed=true
  tierCounts: { High: number; Medium: number; Low: number; Cold: number; Unscored: number };
};

type TierKey = "High" | "Medium" | "Low" | "Cold" | "Unscored";

function emptyTiers(): CohortInsight["tierCounts"] {
  return { High: 0, Medium: 0, Low: 0, Cold: 0, Unscored: 0 };
}

function tierOf(d: Donor): TierKey {
  switch (d.tier) {
    case "High":
    case "Medium":
    case "Low":
    case "Cold":
      return d.tier as TierKey;
    default:
      return "Unscored";
  }
}

/**
 * Hydrate every (non-archived) cohort for an org with its membership +
 * aggregate stats. Pulls every donor that belongs to at least one cohort
 * in one query, then groups in memory.
 */
export async function getCohortInsights(
  orgId: string,
): Promise<CohortInsight[]> {
  const cohorts = await prisma.cohortDefinition.findMany({
    where: { orgId, isArchived: false },
    orderBy: [{ family: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
    include: {
      members: {
        include: {
          donor: true,
        },
      },
    },
  });

  return cohorts.map((c) => buildInsight(c, c.members.map((m) => m.donor)));
}

/**
 * Single-cohort variant used by /cohorts/[slug]. Pulls just the one
 * cohort + its donors, scoped to the org via cohort's own orgId.
 */
export async function getCohortBySlug(
  orgId: string,
  slug: string,
): Promise<{ insight: CohortInsight; donors: Donor[] } | null> {
  const cohort = await prisma.cohortDefinition.findUnique({
    where: { orgId_slug: { orgId, slug } },
  });
  if (!cohort) return null;

  const members = await prisma.donor.findMany({
    where: { cohorts: { some: { cohortDefinitionId: cohort.id } } },
    orderBy: [{ reactivationScore: "desc" }, { totalGiven: "desc" }],
  });

  return { insight: buildInsight(cohort, members), donors: members };
}

function buildInsight(cohort: CohortDefinition, donors: Donor[]): CohortInsight {
  const tierCounts = emptyTiers();
  let totalValue = 0;
  let totalGifts = 0;
  let scoreSum = 0;
  let scoredCount = 0;
  let lapsed = 0;

  for (const d of donors) {
    tierCounts[tierOf(d)]++;
    if (d.totalGiven != null) totalValue += d.totalGiven;
    if (d.totalGifts != null) totalGifts += d.totalGifts;
    if (d.reactivationScore != null) {
      scoreSum += d.reactivationScore;
      scoredCount++;
    }
    if (d.isLapsed) lapsed++;
  }

  return {
    cohort,
    memberCount: donors.length,
    totalLifetimeValue: totalValue,
    averageScore: scoredCount > 0 ? Math.round(scoreSum / scoredCount) : null,
    averageGift: totalGifts > 0 ? Math.round(totalValue / totalGifts) : null,
    lapsedShare: donors.length > 0 ? lapsed / donors.length : 0,
    tierCounts,
  };
}
