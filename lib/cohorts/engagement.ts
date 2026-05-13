/**
 * Engagement cohorts — derived from CSV "tag columns" the user marked
 * during upload. One cohort per unique (column, value) pair.
 *
 * Slug shape: `eng-{column}-{value}` (kebab-cased) — column included so
 * the same value (e.g. "Yes") across different source columns stays
 * unique. Display name is just the raw value, matching the spec's
 * examples ("Gala 2024" → "Gala 2024").
 */

import "server-only";

import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

/** Per-donor CSV tag map: { columnName → originalValue }. */
export type CsvTags = Record<string, string>;

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-+|-+$)/g, "")
    .slice(0, 80);
}

export function engagementSlug(column: string, value: string): string {
  return `eng-${slugify(column)}-${slugify(value)}`;
}

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
  return PALETTE[h % PALETTE.length];
}

/**
 * Walk every donor's csvTags, build the unique (column, value) set,
 * upsert one ENGAGEMENT CohortDefinition per pair, and return
 * `{ slug → cohortDefinitionId }` for the classifier to assign donors.
 */
export async function upsertEngagementCohorts(
  orgId: string,
  donorTags: { donorId: string; tags: CsvTags }[],
): Promise<Map<string, string>> {
  // Collect unique (column, value) pairs.
  const pairs = new Map<string, { column: string; value: string }>();
  for (const { tags } of donorTags) {
    for (const [column, value] of Object.entries(tags)) {
      const slug = engagementSlug(column, value);
      if (!pairs.has(slug)) pairs.set(slug, { column, value });
    }
  }

  const slugToId = new Map<string, string>();

  // Upsert sequentially — count is bounded by user-confirmed columns ×
  // their unique values; not enough volume to need batching tricks.
  for (const [slug, { column, value }] of pairs) {
    const def = await prisma.cohortDefinition.upsert({
      where: { orgId_slug: { orgId, slug } },
      create: {
        orgId,
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
        // Re-derive name/desc/sourceValue in case the column was renamed.
        name: value,
        description: `Auto-derived from CSV column "${column}".`,
        sourceColumn: column,
        sourceValue: value,
      },
    });
    slugToId.set(slug, def.id);
  }

  return slugToId;
}

/**
 * Build the (donorId, cohortDefinitionId) assignment rows for engagement
 * cohorts. assignmentType="csv" so it's distinguishable from rule-based
 * "auto" rows when we eventually surface that.
 */
export function buildEngagementAssignments(
  donorTags: { donorId: string; tags: CsvTags }[],
  slugToId: Map<string, string>,
): Prisma.DonorCohortCreateManyInput[] {
  const out: Prisma.DonorCohortCreateManyInput[] = [];
  for (const { donorId, tags } of donorTags) {
    for (const [column, value] of Object.entries(tags)) {
      const slug = engagementSlug(column, value);
      const cohortDefinitionId = slugToId.get(slug);
      if (cohortDefinitionId) {
        out.push({ donorId, cohortDefinitionId, assignmentType: "csv" });
      }
    }
  }
  return out;
}
