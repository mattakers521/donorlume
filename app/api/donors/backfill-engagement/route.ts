import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";

import { extractAttendeeYears } from "@/lib/cohorts/attendee";
import { prisma } from "@/lib/prisma";
import { scoreEngagement } from "@/lib/scoring";
import { withOrg } from "@/lib/with-org";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/donors/backfill-engagement
 *
 * Computes engagement scores for attendee donors uploaded BEFORE the
 * engagement-scoring feature existed (or whose enrichmentData was
 * dropped for any other reason). Idempotent — only touches rows
 * matching ALL of:
 *
 *   1. No gift signal at all (lastGiftDate null + zero totals)
 *   2. No `enrichmentData.engagement` key already present
 *
 * For each match, derive the year set from the donor's existing
 * cohort assignments:
 *
 *   • ENGAGEMENT-family cohort NAMES often carry the year ("Vet Fest
 *     2024", "Gala 2023") because the upload flow seeded one cohort
 *     per unique (TAGS column, value) pair. Parsing those names back
 *     into years recovers the original signal precisely.
 *   • If no per-event cohort survived (the user skipped the TAGS
 *     column at upload), fall back to the four SYSTEM attendee-*
 *     cohorts: first-time → 1 year, multi-year → 2 (conservative
 *     floor), recent → most-recent within last calendar year, lapsed
 *     → 3 years ago.
 *
 * Approximations are clearly worse than the upload-time path, but
 * "approximate score" beats "no score at all" for the user trying to
 * triage an attendee list and decide who to call first.
 *
 * Returns `{ scanned, updated }`.
 */
export const POST = withOrg(async (_req, { auth }) => {
  // Pull every attendee donor in the org. Filtering happens in JS
  // because the JSON-key check (`engagement` exists in enrichmentData)
  // is awkward across Prisma + Postgres dialects.
  const donors = await prisma.donor.findMany({
    where: {
      donorList: { orgId: auth.org.id },
      lastGiftDate: null,
      AND: [
        {
          OR: [
            { totalGifts: null },
            { totalGifts: 0 },
          ],
        },
        {
          OR: [
            { totalGiven: null },
            { totalGiven: 0 },
          ],
        },
      ],
    },
    include: {
      cohorts: { include: { cohort: true } },
    },
  });

  const now = new Date();
  const updates: { id: string; enrichmentData: Prisma.InputJsonValue }[] =
    [];

  // Update sequentially. ~50-100ms × N is fine for the one-shot
  // backfill case (5000 attendees → a few minutes; typical orgs are
  // 100-1000 rows, well under a minute). If this becomes a hotspot
  // we'd batch into raw SQL.
  for (const donor of donors) {
    const enrichment = (donor.enrichmentData ?? {}) as Record<
      string,
      Prisma.InputJsonValue
    >;
    if (
      enrichment &&
      typeof enrichment === "object" &&
      "engagement" in enrichment
    ) {
      continue;
    }

    const years = recoverYears(donor.cohorts, now);
    const hasPhone =
      typeof enrichment.phone === "string" && enrichment.phone.length > 0;
    const hasAddress =
      typeof enrichment.address === "string" && enrichment.address.length > 0;

    const result = scoreEngagement(
      years,
      {
        hasEmail: !!donor.email,
        hasPhone,
        hasAddress,
      },
      now,
    );

    const nextEnrichment: Record<string, Prisma.InputJsonValue> = {
      ...enrichment,
      engagement: {
        score: result.totalScore,
        yearsAttended: result.yearsAttended,
        years: result.years,
        mostRecentYear: result.mostRecentYear,
        longestStreak: result.longestStreak,
        components: {
          frequency: result.frequencyScore,
          recency: result.recencyScore,
          consistency: result.consistencyScore,
          contact: result.contactScore,
        },
        backfilled: true,
      },
    };

    await prisma.donor.update({
      where: { id: donor.id },
      data: { enrichmentData: nextEnrichment },
    });
    updates.push({ id: donor.id, enrichmentData: nextEnrichment });
  }

  return NextResponse.json({
    scanned: donors.length,
    updated: updates.length,
    // Returning per-donor patches lets the client apply them inline
    // without a router.refresh() round trip — avoids prop-sync
    // gymnastics and keeps any optimistic state intact.
    updates,
  });
});

const ATTENDEE_SYSTEM_SLUGS = new Set([
  "attendee-first-time",
  "attendee-multi-year",
  "attendee-recent",
  "attendee-lapsed",
]);

/**
 * Recover a year set from a donor's cohort assignments.
 *
 * Priority 1 — per-event ENGAGEMENT cohorts. Their `name` field
 * carries the raw tag value (e.g. "Vet Fest 2024"); the same year
 * regex the upload-time parser uses pulls those years back out
 * cleanly. This is lossless when the user kept the TAGS column at
 * upload.
 *
 * Priority 2 — SYSTEM attendee-* cohorts. Approximate years from
 * which buckets the donor lives in. Worse signal but better than
 * nothing.
 */
function recoverYears(
  cohorts: { cohort: { slug: string; name: string; family: string } }[],
  now: Date,
): Set<number> {
  const years = new Set<number>();
  const tagBag: Record<string, string> = {};

  // Per-event ENGAGEMENT cohorts whose names carry years.
  let perEventIndex = 0;
  for (const dc of cohorts) {
    if (
      dc.cohort.family !== "ENGAGEMENT" ||
      ATTENDEE_SYSTEM_SLUGS.has(dc.cohort.slug)
    ) {
      continue;
    }
    tagBag[`backfill-${perEventIndex++}`] = dc.cohort.name;
  }
  if (perEventIndex > 0) {
    for (const y of extractAttendeeYears(tagBag)) years.add(y);
    if (years.size > 0) return years;
  }

  // Fallback: approximate from the SYSTEM attendee-* cohorts.
  const slugs = new Set(cohorts.map((dc) => dc.cohort.slug));
  const isFirstTime = slugs.has("attendee-first-time");
  const isMultiYear = slugs.has("attendee-multi-year");
  const isRecent = slugs.has("attendee-recent");
  const isLapsed = slugs.has("attendee-lapsed");

  if (!isFirstTime && !isMultiYear) return years; // no signal at all

  const currentYear = now.getUTCFullYear();
  const anchor = isRecent
    ? currentYear - 1 // "within current or previous calendar year" — pick previous as the conservative floor
    : isLapsed
      ? currentYear - 3 // "attended at some point but not since" — assume 3y ago
      : currentYear - 2; // unknown recency band — neutral middle

  years.add(anchor);
  if (isMultiYear) {
    // Add a second year so the consistency + frequency math reflects
    // multi-year attendance. We don't know exactly how many years —
    // 2 is the floor that triggered the multi-year bucket.
    years.add(anchor - 1);
  }
  return years;
}
