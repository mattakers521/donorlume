/**
 * Attendee cohort derivation — Phase 1.5.
 *
 * Bridges the "post-event attendee list" use case (VetLife, GiveButter,
 * OneCause exports etc.) into the segment system. Donor rows without
 * giving history but WITH event-year tags get assigned into four
 * recency/frequency cohorts the AI outreach + reports surfaces can
 * filter on:
 *
 *   • First-time attendees — recorded for exactly one event year.
 *   • Multi-year attendees — recorded for 2+ event years.
 *   • Recent attendees    — attended within current or previous
 *                            calendar year.
 *   • Lapsed attendees    — attended at some point but not in the
 *                            current or previous year.
 *
 * Event years are parsed from CSV tag values via a 4-digit-year regex
 * (clamped to 2000–2099 to ignore stray numeric noise). Multi-value
 * cells like "Vet Fest 2025; Vet Fest 2024" are split on common
 * delimiters so a single TAGS column still yields a complete year set
 * per donor.
 *
 * These cohorts live in the ENGAGEMENT family because they're derived
 * from CSV metadata, not from rule-evaluated giving fields — same
 * family classify.ts already skips, so the rule-eval path never sees
 * them.
 */

import "server-only";

import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

/** Lower/upper bound for "looks like a calendar year" — 2000–2099. */
const YEAR_MIN = 2000;
const YEAR_MAX = 2099;
const YEAR_REGEX = /\b(20\d{2})\b/g;
/** Splits combined tag cells like "Event 2024; Event 2023" or "A | B". */
const TAG_VALUE_SPLIT = /[;,|/\n]+/;

export type AttendeeCohortKey =
  | "first-time"
  | "multi-year"
  | "recent"
  | "lapsed";

type Spec = {
  slug: string;
  name: string;
  description: string;
  color: string;
};

const SPECS: Record<AttendeeCohortKey, Spec> = {
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

/**
 * Parse the set of event years out of a donor's csvTags map. Walks
 * every tag VALUE (not just selected cohort columns) so the parser
 * works regardless of which TAGS column the user opted in.
 */
export function extractAttendeeYears(
  tags: Record<string, string>,
): Set<number> {
  const years = new Set<number>();
  for (const raw of Object.values(tags)) {
    if (!raw) continue;
    // Split combined cells so each event token contributes its own year.
    for (const piece of String(raw).split(TAG_VALUE_SPLIT)) {
      let match: RegExpExecArray | null;
      const re = new RegExp(YEAR_REGEX.source, "g");
      while ((match = re.exec(piece)) !== null) {
        const y = Number(match[1]);
        if (y >= YEAR_MIN && y <= YEAR_MAX) {
          years.add(y);
        }
      }
    }
  }
  return years;
}

/**
 * Decide which attendee cohorts apply to a year set. A donor can land
 * in two cohorts simultaneously (e.g. "multi-year" + "recent"); the
 * caller stitches the assignments into DonorCohort rows.
 */
export function attendeeCohortsFor(
  years: Set<number>,
  now = new Date(),
): AttendeeCohortKey[] {
  if (years.size === 0) return [];
  const out: AttendeeCohortKey[] = [];

  // Recency band — current year OR previous year.
  const currentYear = now.getUTCFullYear();
  const recentThreshold = currentYear - 1;
  const hasRecent = [...years].some((y) => y >= recentThreshold);
  if (hasRecent) out.push("recent");
  else out.push("lapsed");

  if (years.size === 1) out.push("first-time");
  else out.push("multi-year");

  return out;
}

/**
 * Upsert the four ENGAGEMENT attendee cohorts for an org. Idempotent
 * via the (orgId, slug) unique. Re-runs on every upload that has at
 * least one attendee — the upsert is cheap and keeps name/description
 * in sync if the spec changes.
 *
 * Returns slug → CohortDefinition.id so the assignment builder can
 * pair donor rows with cohort rows without an extra query.
 */
export async function upsertAttendeeCohorts(
  orgId: string,
  keys: Iterable<AttendeeCohortKey>,
): Promise<Map<AttendeeCohortKey, string>> {
  const out = new Map<AttendeeCohortKey, string>();
  const unique = new Set(keys);
  for (const key of unique) {
    const spec = SPECS[key];
    const def = await prisma.cohortDefinition.upsert({
      where: { orgId_slug: { orgId, slug: spec.slug } },
      create: {
        orgId,
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
    out.set(key, def.id);
  }
  return out;
}

/**
 * Build (donorId, cohortDefinitionId) rows for every attendee in the
 * batch, given each donor's tag map. Returns the assignment-create
 * shape directly so the caller can pass it to `prisma.donorCohort.createMany`.
 *
 * Donors with zero parsed years get no rows back — they're either
 * proper donors (giving history present) or contact-only rows without
 * event metadata, neither of which belong in the attendee family.
 */
export async function assignAttendeeCohorts(
  orgId: string,
  donorTags: { donorId: string; tags: Record<string, string> }[],
  now = new Date(),
): Promise<Prisma.DonorCohortCreateManyInput[]> {
  // First pass: parse year sets + figure out which cohort definitions
  // we'll actually need. Skip upsert if zero attendees were detected.
  const perDonor: { donorId: string; keys: AttendeeCohortKey[] }[] = [];
  const neededKeys = new Set<AttendeeCohortKey>();
  for (const { donorId, tags } of donorTags) {
    const years = extractAttendeeYears(tags);
    if (years.size === 0) continue;
    const keys = attendeeCohortsFor(years, now);
    perDonor.push({ donorId, keys });
    for (const k of keys) neededKeys.add(k);
  }
  if (neededKeys.size === 0) return [];

  const keyToId = await upsertAttendeeCohorts(orgId, neededKeys);
  const rows: Prisma.DonorCohortCreateManyInput[] = [];
  for (const { donorId, keys } of perDonor) {
    for (const k of keys) {
      const cohortDefinitionId = keyToId.get(k);
      if (cohortDefinitionId) {
        rows.push({
          donorId,
          cohortDefinitionId,
          assignmentType: "csv",
        });
      }
    }
  }
  return rows;
}
