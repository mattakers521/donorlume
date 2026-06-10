/* eslint-disable no-console */
/**
 * End-to-end VETLIFE re-ingest with full logging.
 *
 * Steps:
 *   1. Resolve matt.akers@vibrantcauses.com → org.
 *   2. Delete every DonorList in that org (cascades to Donor +
 *      DonorCohort).
 *   3. Parse the VETLIFE CSV with the same Papaparse config the
 *      upload-zone uses (BOM strip, header trim, skipEmptyLines).
 *   4. Project every row through detectColumns + projectRow so the
 *      pipeline is identical to what the API would do if the user
 *      hand-uploaded the file.
 *   5. Per attendee, parse years from TAGS via extractAttendeeYears,
 *      compute engagement via scoreEngagement, persist on Donor with
 *      the full enrichmentData JSON.
 *   6. Build per-event ENGAGEMENT cohorts (one per unique year tag),
 *      assign donors to them.
 *   7. Build SYSTEM attendee-* cohorts (first-time / multi-year /
 *      recent / lapsed) and assign.
 *   8. Print aggregate stats + top 10 + bottom 10 engagement scores
 *      so the user can verify the math.
 *
 * Inlines the few server-only helpers (attendee.ts module flags itself
 * "server-only" which throws on direct tsx import — same pattern as
 * scripts/seed-existing-orgs.ts).
 */

import fs from "node:fs";

import { PrismaClient, type Prisma } from "@prisma/client";
import Papa from "papaparse";

import { detectColumns, projectRow } from "@/lib/csv-mapping";
import { scoreEngagement } from "@/lib/scoring";

const CSV_PATH =
  "/Users/mattakers521/Downloads/Vet Fest Combined List (2).csv";
const OWNER_EMAIL = "matt.akers@vibrantcauses.com";

const prisma = new PrismaClient();

// ─── Inlined from lib/cohorts/attendee.ts (server-only) ────────────

const YEAR_MIN = 2000;
const YEAR_MAX = 2099;
const TAG_VALUE_SPLIT = /[;,|/\n]+/;

type AttendeeCohortKey =
  | "first-time"
  | "multi-year"
  | "recent"
  | "lapsed";

const ATTENDEE_SPECS: Record<
  AttendeeCohortKey,
  { slug: string; name: string; description: string; color: string }
> = {
  "first-time": {
    slug: "attendee-first-time",
    name: "First-Time Attendees",
    description:
      "Attended exactly one event year — prime first-time-donor conversion targets.",
    color: "#0EA5E9",
  },
  "multi-year": {
    slug: "attendee-multi-year",
    name: "Multi-Year Attendees",
    description:
      "Attended 2+ event years. Repeat engagement suggests strong affinity even without a recorded gift.",
    color: "#10B981",
  },
  recent: {
    slug: "attendee-recent",
    name: "Recent Attendees",
    description:
      "Attended in the current or previous calendar year. Warmest follow-up window.",
    color: "#E8860C",
  },
  lapsed: {
    slug: "attendee-lapsed",
    name: "Lapsed Attendees",
    description:
      "Attended at some point but not in the current or previous year. Re-engagement opportunity.",
    color: "#D44A1A",
  },
};

function extractAttendeeYears(tags: Record<string, string>): Set<number> {
  const years = new Set<number>();
  for (const raw of Object.values(tags)) {
    if (!raw) continue;
    for (const piece of String(raw).split(TAG_VALUE_SPLIT)) {
      const re = /\b(20\d{2})\b/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(piece)) !== null) {
        const y = Number(m[1]);
        if (y >= YEAR_MIN && y <= YEAR_MAX) years.add(y);
      }
    }
  }
  return years;
}

function attendeeCohortsFor(
  years: Set<number>,
  now: Date,
): AttendeeCohortKey[] {
  if (years.size === 0) return [];
  const out: AttendeeCohortKey[] = [];
  const currentYear = now.getUTCFullYear();
  const recentThreshold = currentYear - 1;
  const hasRecent = [...years].some((y) => y >= recentThreshold);
  if (hasRecent) out.push("recent");
  else out.push("lapsed");
  if (years.size === 1) out.push("first-time");
  else out.push("multi-year");
  return out;
}

// ─── Engagement-cohort slugging (inlined from engagement.ts) ───────

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-+|-+$)/g, "")
    .slice(0, 80);
}

function engagementSlug(column: string, value: string): string {
  return `eng-${slugify(column)}-${slugify(value)}`;
}

// Stable palette for engagement cohort colors.
const PALETTE = [
  "#0EA5E9",
  "#10B981",
  "#F97316",
  "#A855F7",
  "#EC4899",
  "#14B8A6",
  "#F59E0B",
  "#8B5CF6",
];
function paletteFor(slug: string): string {
  let h = 0;
  for (let i = 0; i < slug.length; i++) h = (h * 31 + slug.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length]!;
}

// ─── Helpers ──────────────────────────────────────────────────────

function splitTagCell(value: string): string[] {
  // VETLIFE-style cell looks like: `"Vet Fest 2025","Vet Fest 2024"`
  // — quoted strings comma-separated inside one cell. Strip outer
  // quotes from each segment so the cohort name reads cleanly
  // ("Vet Fest 2025" not "\"Vet Fest 2025\"").
  if (!value) return [];
  return value
    .split(TAG_VALUE_SPLIT)
    .map((s) => s.trim().replace(/^['"]+|['"]+$/g, "").trim())
    .filter(Boolean);
}

// ─── MAIN ─────────────────────────────────────────────────────────

async function main() {
  console.log(`──── Step 1: resolve owner ${OWNER_EMAIL} ────`);
  const user = await prisma.user.findUnique({
    where: { email: OWNER_EMAIL },
    include: { orgs: { include: { org: true } } },
  });
  if (!user) throw new Error(`No user found for ${OWNER_EMAIL}`);
  const orgMembership = user.orgs[0];
  if (!orgMembership)
    throw new Error(`User ${OWNER_EMAIL} has no org membership`);
  const org = orgMembership.org;
  console.log(`user.id=${user.id} org.id=${org.id} org.name=${org.name}`);

  console.log("\n──── Step 2: delete existing donor lists ────");
  const existingLists = await prisma.donorList.findMany({
    where: { orgId: org.id },
    select: { id: true, name: true, totalDonors: true },
  });
  console.log(`Found ${existingLists.length} existing list(s):`);
  for (const l of existingLists) {
    console.log(`  - ${l.name} (${l.totalDonors} donors) id=${l.id}`);
  }
  const delResult = await prisma.donorList.deleteMany({
    where: { orgId: org.id },
  });
  console.log(`Deleted ${delResult.count} DonorList row(s).`);
  // Clear stale attendee cohort assignments. Cohorts themselves stay
  // (cohort defs are per-org, not per-list) — we re-upsert by slug
  // anyway and skipDuplicates will keep things clean.

  console.log("\n──── Step 3: parse CSV ────");
  const raw = fs.readFileSync(CSV_PATH, "utf8");
  const cleaned = raw.replace(/^﻿/, "").trim();
  const papa = Papa.parse<Record<string, unknown>>(cleaned, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });
  if (papa.errors.length > 0) {
    console.warn("Papaparse errors:", papa.errors.slice(0, 5));
  }
  const headers = papa.meta.fields ?? [];
  console.log(`headers (${headers.length}): ${JSON.stringify(headers)}`);
  console.log(`raw rows: ${papa.data.length}`);

  console.log("\n──── Step 4: detect columns ────");
  const map = detectColumns(headers);
  console.log(JSON.stringify(map, null, 2));

  console.log("\n──── Step 5: project + score ────");
  const projected: {
    raw: ReturnType<typeof projectRow>;
    csvRow: Record<string, unknown>;
    tagsValue: string;
    years: number[];
  }[] = [];

  let droppedNoNameOrEmail = 0;
  let withTagsValue = 0;
  let withYears = 0;
  const yearCountHist = new Map<number, number>();

  for (let i = 0; i < papa.data.length; i++) {
    const row = papa.data[i]!;
    const p = projectRow(row, map, i);
    if (!p) {
      droppedNoNameOrEmail++;
      continue;
    }
    const tagsValue =
      map.notes && row[map.notes]
        ? String(row[map.notes])
        : row.TAGS != null
          ? String(row.TAGS)
          : "";
    if (tagsValue.trim()) withTagsValue++;

    // Build the csvTag map for the year extractor: the same column the
    // user-facing upload preview would have offered as a categorical.
    const csvTags: Record<string, string> = {};
    if (tagsValue.trim()) csvTags.TAGS = tagsValue;
    const years = extractAttendeeYears(csvTags);
    if (years.size > 0) withYears++;
    yearCountHist.set(years.size, (yearCountHist.get(years.size) ?? 0) + 1);

    projected.push({ raw: p, csvRow: row, tagsValue, years: [...years] });
  }

  console.log(`rows parsed:                ${papa.data.length}`);
  console.log(`rows dropped (no name/email): ${droppedNoNameOrEmail}`);
  console.log(`rows projected:             ${projected.length}`);
  console.log(`rows with TAGS value:       ${withTagsValue}`);
  console.log(`rows with extracted years:  ${withYears}`);
  console.log(
    `year-count histogram (years → rows):`,
    Object.fromEntries(
      [...yearCountHist.entries()].sort((a, b) => a[0] - b[0]),
    ),
  );

  console.log("\n──── Step 6: dedup by email ────");
  const seenEmails = new Set<string>();
  const uniqueProjected: typeof projected = [];
  let duplicateCount = 0;
  for (const p of projected) {
    const key = p.raw!.email.trim().toLowerCase();
    if (!key || seenEmails.has(key)) {
      duplicateCount++;
      continue;
    }
    seenEmails.add(key);
    uniqueProjected.push(p);
  }
  console.log(
    `after dedup: ${uniqueProjected.length} unique rows (${duplicateCount} duplicates dropped)`,
  );

  console.log("\n──── Step 7: compute engagement per row ────");
  const now = new Date();
  const scored = uniqueProjected.map((p) => {
    const yearSet = new Set(p.years);
    const engagement = scoreEngagement(
      yearSet,
      {
        hasEmail: !!p.raw!.email,
        hasPhone: !!p.raw!.phone,
        hasAddress: !!p.raw!.address,
      },
      now,
    );
    return { ...p, engagement };
  });

  const scoreHist = new Map<string, number>();
  for (const s of scored) {
    const bucket =
      s.engagement.totalScore >= 80
        ? "80-100"
        : s.engagement.totalScore >= 60
          ? "60-79"
          : s.engagement.totalScore >= 40
            ? "40-59"
            : s.engagement.totalScore >= 20
              ? "20-39"
              : "0-19";
    scoreHist.set(bucket, (scoreHist.get(bucket) ?? 0) + 1);
  }
  console.log(
    `engagement score buckets:`,
    Object.fromEntries(
      [...scoreHist.entries()].sort(
        ([a], [b]) => Number(a.split("-")[0]) - Number(b.split("-")[0]),
      ),
    ),
  );

  console.log("\n──── Step 8: create DonorList + bulk Donor insert ────");
  const list = await prisma.donorList.create({
    data: {
      orgId: org.id,
      name: "Vet Fest Combined List.csv",
      fileName: "Vet Fest Combined List.csv",
      totalDonors: scored.length,
      lapsedCount: 0,
      processedAt: now,
      uploadedByUserId: user.id,
    },
  });
  console.log(`created DonorList id=${list.id} totalDonors=${list.totalDonors}`);

  // Bulk insert donors with full enrichmentData (phone, address,
  // engagement breakdown).
  await prisma.donor.createMany({
    data: scored.map((s) => {
      const enrichment: Record<string, Prisma.InputJsonValue> = {};
      if (s.raw!.phone) enrichment.phone = s.raw!.phone;
      if (s.raw!.address) enrichment.address = s.raw!.address;
      enrichment.engagement = {
        score: s.engagement.totalScore,
        yearsAttended: s.engagement.yearsAttended,
        years: s.engagement.years,
        mostRecentYear: s.engagement.mostRecentYear,
        longestStreak: s.engagement.longestStreak,
        components: {
          frequency: s.engagement.frequencyScore,
          recency: s.engagement.recencyScore,
          consistency: s.engagement.consistencyScore,
          contact: s.engagement.contactScore,
        },
      };
      return {
        donorListId: list.id,
        name: s.raw!.name,
        email: s.raw!.email,
        donorType: s.raw!.donorType || null,
        firstGiftDate: null,
        lastGiftDate: null,
        totalGifts: null,
        totalGiven: null,
        largestGift: null,
        notes: null,
        isLapsed: false,
        reactivationScore: 0,
        tier: "Attendee",
        recencyScore: 0,
        frequencyScore: 0,
        monetaryScore: 0,
        tenureScore: 0,
        activeElsewhere: false,
        searchIntent: false,
        enrichmentData: enrichment,
      };
    }),
  });
  const persistedDonors = await prisma.donor.findMany({
    where: { donorListId: list.id },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: { id: true, name: true, email: true },
  });
  console.log(`persisted ${persistedDonors.length} donors`);

  console.log("\n──── Step 9: upsert per-event ENGAGEMENT cohorts ────");
  // Build unique (column, value) pairs across all donors.
  const eventPairs = new Map<
    string,
    { column: string; value: string; donorIndices: number[] }
  >();
  scored.forEach((s, idx) => {
    if (!s.tagsValue) return;
    for (const value of splitTagCell(s.tagsValue)) {
      const slug = engagementSlug("TAGS", value);
      const existing = eventPairs.get(slug);
      if (existing) existing.donorIndices.push(idx);
      else
        eventPairs.set(slug, {
          column: "TAGS",
          value,
          donorIndices: [idx],
        });
    }
  });
  console.log(`unique per-event tags: ${eventPairs.size}`);

  const eventSlugToId = new Map<string, string>();
  for (const [slug, { column, value }] of eventPairs) {
    const def = await prisma.cohortDefinition.upsert({
      where: { orgId_slug: { orgId: org.id, slug } },
      create: {
        orgId: org.id,
        slug,
        name: value,
        family: "ENGAGEMENT",
        type: "SYSTEM",
        description: `Auto-derived from CSV column "${column}".`,
        sourceColumn: column,
        sourceValue: value,
        color: paletteFor(slug),
        icon: "Tag",
        sortOrder: 200,
      },
      update: {
        name: value,
        description: `Auto-derived from CSV column "${column}".`,
        sourceColumn: column,
        sourceValue: value,
      },
    });
    eventSlugToId.set(slug, def.id);
  }

  const eventAssignments: Prisma.DonorCohortCreateManyInput[] = [];
  for (const [slug, { donorIndices }] of eventPairs) {
    const cohortDefinitionId = eventSlugToId.get(slug)!;
    for (const idx of donorIndices) {
      const donorId = persistedDonors[idx]!.id;
      eventAssignments.push({
        donorId,
        cohortDefinitionId,
        assignmentType: "csv",
      });
    }
  }
  if (eventAssignments.length > 0) {
    await prisma.donorCohort.createMany({
      data: eventAssignments,
      skipDuplicates: true,
    });
  }
  console.log(
    `created ${eventAssignments.length} per-event cohort assignments`,
  );

  console.log("\n──── Step 10: upsert SYSTEM attendee-* cohorts ────");
  const usedAttendeeKeys = new Set<AttendeeCohortKey>();
  const attendeeCohortKeysPerDonor: AttendeeCohortKey[][] = scored.map(
    (s) => {
      const keys = attendeeCohortsFor(new Set(s.years), now);
      for (const k of keys) usedAttendeeKeys.add(k);
      return keys;
    },
  );
  const attendeeKeyToId = new Map<AttendeeCohortKey, string>();
  for (const key of usedAttendeeKeys) {
    const spec = ATTENDEE_SPECS[key];
    const def = await prisma.cohortDefinition.upsert({
      where: { orgId_slug: { orgId: org.id, slug: spec.slug } },
      create: {
        orgId: org.id,
        slug: spec.slug,
        name: spec.name,
        family: "ENGAGEMENT",
        type: "SYSTEM",
        description: spec.description,
        color: spec.color,
        icon: "Users",
        sortOrder: 250,
      },
      update: {
        name: spec.name,
        description: spec.description,
        color: spec.color,
      },
    });
    attendeeKeyToId.set(key, def.id);
  }

  const attendeeAssignments: Prisma.DonorCohortCreateManyInput[] = [];
  attendeeCohortKeysPerDonor.forEach((keys, idx) => {
    const donorId = persistedDonors[idx]!.id;
    for (const key of keys) {
      attendeeAssignments.push({
        donorId,
        cohortDefinitionId: attendeeKeyToId.get(key)!,
        assignmentType: "csv",
      });
    }
  });
  if (attendeeAssignments.length > 0) {
    await prisma.donorCohort.createMany({
      data: attendeeAssignments,
      skipDuplicates: true,
    });
  }
  console.log(
    `created ${attendeeAssignments.length} attendee-* cohort assignments`,
  );
  console.log(
    `used attendee keys: ${JSON.stringify([...usedAttendeeKeys])}`,
  );

  console.log("\n──── Step 11: top 10 + bottom 10 engagement scores ────");
  const sortedByScore = [...scored].sort(
    (a, b) => b.engagement.totalScore - a.engagement.totalScore,
  );
  const printRow = (
    s: (typeof scored)[number],
    rank: number,
    persisted: { id: string; name: string; email: string | null },
  ) => {
    const e = s.engagement;
    console.log(
      `  #${String(rank).padStart(2)} ${e.totalScore.toString().padStart(3)} / 100 — ${persisted.name}`,
    );
    console.log(
      `       email=${persisted.email} phone=${!!s.raw!.phone} address=${!!s.raw!.address}`,
    );
    console.log(
      `       years=[${e.years.join(", ")}] (count=${e.yearsAttended}, streak=${e.longestStreak}, mostRecent=${e.mostRecentYear})`,
    );
    console.log(
      `       components: freq=${e.frequencyScore}/40  recency=${e.recencyScore}/30  consistency=${e.consistencyScore}/15  contact=${e.contactScore}/15`,
    );
  };

  console.log("\nTop 10:");
  sortedByScore.slice(0, 10).forEach((s, i) => {
    const idx = scored.indexOf(s);
    printRow(s, i + 1, persistedDonors[idx]!);
  });

  console.log("\nBottom 10:");
  sortedByScore
    .slice(-10)
    .reverse()
    .forEach((s, i) => {
      const idx = scored.indexOf(s);
      printRow(s, scored.length - i, persistedDonors[idx]!);
    });

  console.log("\n──── DONE ────");
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error("FAILED:", e);
  await prisma.$disconnect();
  process.exit(1);
});
