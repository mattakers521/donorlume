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
 * dropped). Idempotent unless `?force=true` is passed (which clears
 * the engagement key before scoring — used when a prior backfill
 * produced empty scores because the year-recovery logic was too
 * narrow).
 *
 * Year recovery scans, in priority order:
 *
 *   1. Per-event cohort NAMES across EVERY cohort family the donor
 *      belongs to (not just ENGAGEMENT — VETLIFE's pre-existing
 *      cohorts may live in CUSTOM or another family depending on
 *      when they were created). Same year regex the upload-time
 *      parser uses. Lossless when the user kept the TAGS column.
 *   2. Cohort DESCRIPTIONS — the upload flow writes the raw tag
 *      value into description for ENGAGEMENT cohorts.
 *   3. Donor.notes — fallback for orgs that dumped tags into the
 *      notes column instead of a dedicated TAGS column.
 *   4. SYSTEM attendee-* slugs — bucket approximation.
 *
 * Returns `{ scanned, updated, cleared, sample, updates }`. `sample`
 * is a 5-donor dump (name + cohort names + recovered years + final
 * score) so the client console can see exactly what was found.
 */
/** Cap one POST at this many donors so it never approaches Vercel's
 *  function-timeout. Sequential prisma.donor.update calls are ~50-100ms
 *  each on Neon; 200 fits comfortably under a 60s budget with margin. */
const BATCH_SIZE = 200;

export const POST = withOrg(async (req, { auth }) => {
  const url = new URL(req.url);
  const force = url.searchParams.get("force") === "true";
  const offset = Math.max(0, Number(url.searchParams.get("offset") ?? 0));
  const requestedLimit = Number(
    url.searchParams.get("limit") ?? BATCH_SIZE,
  );
  const limit = Math.max(
    1,
    Math.min(BATCH_SIZE, Number.isFinite(requestedLimit) ? requestedLimit : BATCH_SIZE),
  );

  console.log(
    `[backfill-engagement] start org=${auth.org.id} offset=${offset} limit=${limit} force=${force}`,
  );

  // Page through attendee donors by (createdAt, id) so the client can
  // call repeatedly with rising offsets until done. Stable order across
  // calls — no donor skipped, no donor double-processed.
  const donors = await prisma.donor.findMany({
    where: {
      donorList: { orgId: auth.org.id },
      lastGiftDate: null,
      AND: [
        {
          OR: [{ totalGifts: null }, { totalGifts: 0 }],
        },
        {
          OR: [{ totalGiven: null }, { totalGiven: 0 }],
        },
      ],
    },
    include: {
      cohorts: { include: { cohort: true } },
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    skip: offset,
    take: limit,
  });

  // Total count so the client knows when to stop looping. Cheap —
  // same WHERE, just count.
  const totalAttendees = await prisma.donor.count({
    where: {
      donorList: { orgId: auth.org.id },
      lastGiftDate: null,
      AND: [
        {
          OR: [{ totalGifts: null }, { totalGifts: 0 }],
        },
        {
          OR: [{ totalGiven: null }, { totalGiven: 0 }],
        },
      ],
    },
  });

  console.log(
    `[backfill-engagement] batch loaded=${donors.length} totalAttendees=${totalAttendees}`,
  );

  const now = new Date();
  const updates: { id: string; enrichmentData: Prisma.InputJsonValue }[] =
    [];
  let cleared = 0;
  const sample: Array<{
    name: string;
    cohortCount: number;
    cohortNames: string[];
    recoveredYears: number[];
    finalScore: number;
  }> = [];

  for (const donor of donors) {
    const incomingEnrichment = (donor.enrichmentData ?? {}) as Record<
      string,
      Prisma.InputJsonValue
    >;
    const hasEngagement =
      incomingEnrichment &&
      typeof incomingEnrichment === "object" &&
      "engagement" in incomingEnrichment;

    if (hasEngagement && !force) continue;

    // Working copy without the engagement key — gets re-attached
    // after scoring. When `force`, we strip the existing key first
    // so the broader recovery logic can overwrite it.
    const enrichment: Record<string, Prisma.InputJsonValue> = {
      ...incomingEnrichment,
    };
    if (hasEngagement && force) {
      delete enrichment.engagement;
      cleared++;
    }

    const { years, debugCohortNames } = recoverYears(
      donor.cohorts,
      donor.notes,
      now,
    );
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

    if (sample.length < 5) {
      sample.push({
        name: donor.name,
        cohortCount: donor.cohorts.length,
        cohortNames: debugCohortNames,
        recoveredYears: [...years].sort((a, b) => a - b),
        finalScore: result.totalScore,
      });
    }
  }

  const nextOffset = offset + donors.length;
  // Done when the batch returned fewer than `limit` rows (final page)
  // OR when nextOffset has caught up to the total count.
  const done = donors.length < limit || nextOffset >= totalAttendees;

  console.log(
    `[backfill-engagement] done scanned=${donors.length} updated=${updates.length} cleared=${cleared} nextOffset=${nextOffset} done=${done}`,
  );
  if (sample.length > 0) {
    console.log(
      "[backfill-engagement] sample",
      JSON.stringify(sample, null, 2),
    );
  }

  return NextResponse.json({
    scanned: donors.length,
    updated: updates.length,
    cleared,
    sample,
    totalAttendees,
    nextOffset: done ? null : nextOffset,
    done,
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
 * Recover a year set from everything we know about the donor.
 *
 * Returns both the year set AND the cohort names actually scanned so
 * the route can log them when the recovery comes up empty — that's
 * the smoking gun for "the original upload didn't preserve year
 * info anywhere we can reach now".
 */
function recoverYears(
  cohorts: { cohort: { slug: string; name: string; family: string; description: string | null } }[],
  notes: string | null,
  now: Date,
): { years: Set<number>; debugCohortNames: string[] } {
  const years = new Set<number>();
  const tagBag: Record<string, string> = {};
  const debugCohortNames: string[] = [];

  // Scan every non-system cohort name + description. Old VETLIFE
  // uploads may have classified the per-event cohorts under any
  // family (the upload flow has evolved); we cast the widest net so
  // the recovery doesn't miss them.
  let scanIndex = 0;
  for (const dc of cohorts) {
    if (ATTENDEE_SYSTEM_SLUGS.has(dc.cohort.slug)) continue;
    debugCohortNames.push(`${dc.cohort.family}:${dc.cohort.name}`);
    tagBag[`name-${scanIndex}`] = dc.cohort.name;
    if (dc.cohort.description) {
      tagBag[`desc-${scanIndex}`] = dc.cohort.description;
    }
    scanIndex++;
  }
  // Donor.notes is a free-text field but some upload paths dump TAGS
  // into it when no dedicated TAGS column was selected.
  if (notes && notes.trim()) {
    tagBag.notes = notes;
  }
  if (Object.keys(tagBag).length > 0) {
    for (const y of extractAttendeeYears(tagBag)) years.add(y);
    if (years.size > 0) return { years, debugCohortNames };
  }

  // Fallback: approximate from the SYSTEM attendee-* cohorts.
  const slugs = new Set(cohorts.map((dc) => dc.cohort.slug));
  const isFirstTime = slugs.has("attendee-first-time");
  const isMultiYear = slugs.has("attendee-multi-year");
  const isRecent = slugs.has("attendee-recent");
  const isLapsed = slugs.has("attendee-lapsed");

  if (!isFirstTime && !isMultiYear) {
    return { years, debugCohortNames };
  }

  const currentYear = now.getUTCFullYear();
  const anchor = isRecent
    ? currentYear - 1
    : isLapsed
      ? currentYear - 3
      : currentYear - 2;

  years.add(anchor);
  if (isMultiYear) years.add(anchor - 1);
  return { years, debugCohortNames };
}
