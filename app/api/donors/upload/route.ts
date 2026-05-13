import { NextResponse } from "next/server";
import { z } from "zod";

import { effectivePlan } from "@/lib/billing/trial";
import { checkLimit } from "@/lib/billing/usage";
import { classifyDonors } from "@/lib/cohorts/classify";
import {
  buildEngagementAssignments,
  upsertEngagementCohorts,
} from "@/lib/cohorts/engagement";
import { seedSystemCohorts } from "@/lib/cohorts/seed";
import { notifyAdmin } from "@/lib/notifications/admin";
import { prisma } from "@/lib/prisma";
import {
  DEFAULT_LAPSED_THRESHOLD_MONTHS,
  scoreAll,
  type RawDonorRow,
} from "@/lib/scoring";
import { withOrg } from "@/lib/with-org";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const wireDonor = z.object({
  name: z.string().min(1).max(300),
  email: z.string().max(300).default(""),
  firstGiftDate: z.string().nullable(),
  lastGiftDate: z.string().nullable(),
  totalGifts: z.number().nonnegative(),
  totalGiven: z.number(),
  largestGift: z.number(),
  donorType: z.string().max(100).default("Individual"),
  notes: z.string().max(2000).default(""),
  firstGiftRaw: z.string().max(100).default(""),
  lastGiftRaw: z.string().max(100).default(""),
  /** Per-donor CSV-tag values for the selected engagement-cohort columns. */
  csvTags: z.record(z.string(), z.string()).optional().default({}),
});

const uploadSchema = z.object({
  fileName: z.string().min(1).max(300),
  thresholdMonths: z.number().int().min(1).max(120).default(
    DEFAULT_LAPSED_THRESHOLD_MONTHS,
  ),
  /** Columns from the CSV the user marked as cohort sources (engagement family). */
  cohortColumns: z.array(z.string().max(120)).max(20).optional().default([]),
  donors: z.array(wireDonor).min(1).max(10_000),
});

const toDate = (v: string | null): Date | null => {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
};

/**
 * POST /api/donors/upload
 *
 * Accepts a parsed-and-projected donor list from the client, **re-scores
 * it server-side** (so the persisted scores are canonical), creates the
 * DonorList row, and bulk-inserts the Donor rows in a single transaction.
 * Returns the persisted donors (with ids) so the client can render
 * directly without a follow-up GET.
 */
export const POST = withOrg(async (req, { auth }) => {
  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = uploadSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const {
    fileName,
    thresholdMonths,
    cohortColumns,
    donors: wireDonors,
  } = parsed.data;

  // Re-hydrate dates and carry csvTags alongside so we can wire up
  // engagement cohorts after persistence.
  const rawWithTags: { raw: RawDonorRow; tags: Record<string, string> }[] =
    wireDonors.map((d) => ({
      raw: {
        name: d.name,
        email: d.email,
        firstGiftDate: toDate(d.firstGiftDate),
        lastGiftDate: toDate(d.lastGiftDate),
        totalGifts: d.totalGifts,
        totalGiven: d.totalGiven,
        largestGift: d.largestGift,
        donorType: d.donorType,
        notes: d.notes,
        firstGiftRaw: d.firstGiftRaw,
        lastGiftRaw: d.lastGiftRaw,
      },
      tags: d.csvTags ?? {},
    }));

  // Drop rows the scorer can't handle (no last-gift date) — preserving
  // the parallel (raw, tags) shape.
  const scoreable = rawWithTags.filter((r) => r.raw.lastGiftDate !== null);
  if (scoreable.length === 0) {
    return NextResponse.json(
      { error: "No rows had a parseable last-gift date." },
      { status: 400 },
    );
  }

  const scored = scoreAll(
    scoreable.map((r) => r.raw),
    new Date(),
    thresholdMonths,
  );
  const lapsedCount = scored.filter((d) => d.isLapsed).length;

  // ─── Plan-limit gate (donor record count) ──────────────────────────
  // Existing donor rows + the new batch must fit under the plan cap.
  const existingDonorCount = await prisma.donor.count({
    where: { donorList: { orgId: auth.org.id } },
  });
  const planCheck = checkLimit(
    effectivePlan(auth.org.plan, auth.org.trialEndsAt),
    "donorRecords",
    existingDonorCount,
    scored.length,
  );
  if (!planCheck.ok) {
    return NextResponse.json(
      {
        error: `${planCheck.planName} plan supports ${planCheck.limit.toLocaleString()} donor records. You'd be at ${(existingDonorCount + scored.length).toLocaleString()} after this upload. Upgrade your plan to continue.`,
        limit: planCheck.limit,
        current: existingDonorCount,
        attempted: scored.length,
        kind: planCheck.kind,
      },
      { status: 402 },
    );
  }

  // Snapshot — used after persist to fire the "first upload" Slack ping.
  const priorListCount = await prisma.donorList.count({
    where: { orgId: auth.org.id },
  });

  const list = await prisma.$transaction(async (tx) => {
    const created = await tx.donorList.create({
      data: {
        orgId: auth.org.id,
        name: fileName,
        fileName,
        totalDonors: scored.length,
        lapsedCount,
        processedAt: new Date(),
      },
    });

    await tx.donor.createMany({
      data: scored.map((d) => ({
        donorListId: created.id,
        name: d.name,
        email: d.email || null,
        donorType: d.donorType || null,
        firstGiftDate: d.firstGiftDate,
        lastGiftDate: d.lastGiftDate,
        totalGifts: d.totalGifts || null,
        totalGiven: d.totalGiven || null,
        largestGift: d.largestGift || null,
        notes: d.notes || null,
        isLapsed: d.isLapsed,
        reactivationScore: d.reactivationScore,
        tier: d.tier,
        recencyScore: d.recencyScore,
        frequencyScore: d.frequencyScore,
        monetaryScore: d.monetaryScore,
        tenureScore: d.tenureScore,
        activeElsewhere: d.activeElsewhere,
        searchIntent: d.searchIntent,
      })),
    });

    return created;
  });

  // Fetch back in insert order so we can pair each persisted donor with
  // its original csvTags by index. cuid is monotonic per Node process,
  // and createMany inserts in array order, so (createdAt, id) ASC
  // reconstructs the input order reliably.
  const persistedInOrder = await prisma.donor.findMany({
    where: { donorListId: list.id },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });

  // ─── Cohort classification (Spec §3) ───
  await seedSystemCohorts(auth.org.id);
  const cohortDefs = await prisma.cohortDefinition.findMany({
    where: { orgId: auth.org.id, isArchived: false },
  });

  // 1. Rule-based GIVING_BEHAVIOR + ENTITY_TYPE assignments.
  const ruleAssignments = classifyDonors(persistedInOrder, cohortDefs);

  // 2. ENGAGEMENT cohorts — only built if the user opted columns in.
  const engagementAssignments: typeof ruleAssignments = [];
  if (cohortColumns.length > 0) {
    // Filter to the user-selected columns only, then pair with persisted donors.
    const donorTags = persistedInOrder
      .map((p, i) => {
        const rawTags = scoreable[i]?.tags ?? {};
        const tags: Record<string, string> = {};
        for (const col of cohortColumns) {
          if (rawTags[col]) tags[col] = rawTags[col];
        }
        return { donorId: p.id, tags };
      })
      .filter((dt) => Object.keys(dt.tags).length > 0);

    if (donorTags.length > 0) {
      const slugToId = await upsertEngagementCohorts(auth.org.id, donorTags);
      const built = buildEngagementAssignments(donorTags, slugToId);
      for (const a of built) {
        engagementAssignments.push({
          donorId: a.donorId!,
          cohortDefinitionId: a.cohortDefinitionId!,
          assignmentType: "auto", // shape-compatible with classifyDonors output
        });
      }
    }
  }

  const allAssignments = [...ruleAssignments, ...engagementAssignments];
  if (allAssignments.length > 0) {
    await prisma.donorCohort.createMany({
      data: allAssignments.map((a, i) => ({
        donorId: a.donorId,
        cohortDefinitionId: a.cohortDefinitionId,
        // Engagement assignments are tagged "csv" so their provenance is
        // visible (assignmentType="auto" for the rule-based ones above).
        assignmentType:
          i >= ruleAssignments.length ? "csv" : a.assignmentType,
      })),
      skipDuplicates: true,
    });
  }

  // Re-fetch cohort defs so any newly-upserted engagement cohorts are
  // included in the response payload (powers the /lapsed filter bar
  // immediately after upload).
  const allCohortDefs = await prisma.cohortDefinition.findMany({
    where: { orgId: auth.org.id, isArchived: false },
    orderBy: [{ family: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
  });

  // Re-fetch donors with cohort joins so the client renders badges immediately.
  const donorsWithCohorts = await prisma.donor.findMany({
    where: { donorListId: list.id },
    orderBy: { reactivationScore: "desc" },
    include: { cohorts: { include: { cohort: true } } },
  });

  if (priorListCount === 0) {
    notifyAdmin("first-upload", {
      orgName: auth.org.name,
      totalDonors: list.totalDonors,
      lapsedCount: list.lapsedCount ?? 0,
      fileName,
    });
  }

  return NextResponse.json(
    {
      listId: list.id,
      list,
      donors: donorsWithCohorts,
      cohorts: allCohortDefs,
      // Onboarding signal — caller fires the "step complete" toast when true.
      firstUpload: priorListCount === 0,
    },
    { status: 201 },
  );
});
