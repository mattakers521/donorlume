/**
 * System cohort definitions — seeded per-org (Spec §2).
 *
 * Phase 1 ships the GIVING_BEHAVIOR + ENTITY_TYPE families. ENGAGEMENT
 * (CSV-tag-derived) is Phase 2; TRAJECTORY (rising star / churn risk /
 * upgrade candidate / stewardship priority) is Phase 3.
 *
 * Spec-listed cohorts intentionally omitted from Phase 1:
 *  • Upgraders / Downgraders — require per-gift records (we only store
 *    aggregates: totalGifts + totalGiven + largestGift). Deferred to
 *    Phase 3 along with the rest of the trajectory family.
 *
 * Spec-listed cohorts implemented with adapted rules:
 *  • Lapsed LYBUNT / SYBUNT — spec says "gave prior fiscal year". With
 *    no fiscal-year context we proxy on monthsSinceLastGift:
 *      LYBUNT = 12 ≤ months < 24, SYBUNT = months ≥ 24.
 *  • Recurring Sustainers — spec mentions "frequency is regular" which
 *    needs per-gift data; simplified to donorType match OR totalGifts ≥ 6.
 *  • Legacy/Planned Giving Prospects — spec mentions "age 60+" indicators
 *    which aren't in our data model; rule uses only tenureYears > 5 +
 *    totalGifts > 10.
 */

import type { Rule } from "@/lib/cohorts/rules";

export type SystemCohortDef = {
  slug: string;
  name: string;
  family: "GIVING_BEHAVIOR" | "ENTITY_TYPE";
  description: string;
  color: string;
  icon: string; // lucide icon name (used by UI but not enforced here)
  sortOrder: number;
  rule: Rule;
};

export const SYSTEM_COHORTS: SystemCohortDef[] = [
  // ─── GIVING_BEHAVIOR ───
  {
    slug: "major-donors",
    name: "Major Donors",
    family: "GIVING_BEHAVIOR",
    description: "Total giving ≥ $10K, or any single gift ≥ $5K.",
    color: "#E8860C", // amber
    icon: "Crown",
    sortOrder: 10,
    rule: {
      logic: "or",
      rules: [
        { field: "totalGiven", op: "gte", value: 10000 },
        { field: "largestGift", op: "gte", value: 5000 },
      ],
    },
  },
  {
    slug: "mid-level-donors",
    name: "Mid-Level Donors",
    family: "GIVING_BEHAVIOR",
    description: "Total giving between $1K and $10K.",
    color: "#F5B731", // gold
    icon: "TrendingUp",
    sortOrder: 20,
    rule: {
      logic: "and",
      rules: [
        { field: "totalGiven", op: "gte", value: 1000 },
        { field: "totalGiven", op: "lt", value: 10000 },
      ],
    },
  },
  {
    slug: "small-donors",
    name: "Small / Grassroots Donors",
    family: "GIVING_BEHAVIOR",
    description: "Total giving above $0 and under $1K.",
    color: "#6E6E73", // gray
    icon: "Users",
    sortOrder: 30,
    rule: {
      logic: "and",
      rules: [
        { field: "totalGiven", op: "gt", value: 0 },
        { field: "totalGiven", op: "lt", value: 1000 },
      ],
    },
  },
  {
    slug: "recurring-sustainers",
    name: "Recurring Sustainers",
    family: "GIVING_BEHAVIOR",
    description:
      "donorType marked as recurring/monthly, or 6+ lifetime gifts.",
    color: "#34C759", // green
    icon: "Repeat",
    sortOrder: 40,
    rule: {
      logic: "or",
      rules: [
        {
          field: "donorType",
          op: "contains_any",
          value: ["recurring", "sustainer", "monthly"],
        },
        { field: "totalGifts", op: "gte", value: 6 },
      ],
    },
  },
  {
    slug: "first-time-donors",
    name: "First-Time Donors",
    family: "GIVING_BEHAVIOR",
    description: "Exactly one lifetime gift.",
    color: "#007AFF", // blue
    icon: "Sparkles",
    sortOrder: 50,
    rule: { field: "totalGifts", op: "eq", value: 1 },
  },
  {
    slug: "one-time-donors",
    name: "One-Time Donors",
    family: "GIVING_BEHAVIOR",
    description:
      "Single lifetime gift, last given more than 12 months ago.",
    color: "#AEAEB2", // light gray
    icon: "Clock",
    sortOrder: 60,
    rule: {
      logic: "and",
      rules: [
        { field: "totalGifts", op: "eq", value: 1 },
        { field: "monthsSinceLastGift", op: "gt", value: 12 },
      ],
    },
  },
  {
    slug: "lapsed-lybunt",
    name: "Lapsed (LYBUNT)",
    family: "GIVING_BEHAVIOR",
    description:
      "Gave 12–24 months ago. Proxy for last-year-but-unfortunately-not-this-year.",
    color: "#D44A1A", // orange
    icon: "AlertTriangle",
    sortOrder: 70,
    rule: {
      logic: "and",
      rules: [
        { field: "monthsSinceLastGift", op: "gte", value: 12 },
        { field: "monthsSinceLastGift", op: "lt", value: 24 },
      ],
    },
  },
  {
    slug: "lapsed-sybunt",
    name: "Lapsed (SYBUNT)",
    family: "GIVING_BEHAVIOR",
    description:
      "Last gift was more than 24 months ago. Proxy for some-year-but-not-recent.",
    color: "#B91C1C", // deep red
    icon: "AlertOctagon",
    sortOrder: 80,
    rule: { field: "monthsSinceLastGift", op: "gte", value: 24 },
  },
  {
    slug: "legacy-prospects",
    name: "Legacy / Planned Giving Prospects",
    family: "GIVING_BEHAVIOR",
    description:
      "Long-tenured donors (5+ years) with 10+ lifetime gifts. Likely planned-giving candidates.",
    color: "#AF52DE", // purple
    icon: "Gem",
    sortOrder: 90,
    rule: {
      logic: "and",
      rules: [
        { field: "tenureYears", op: "gt", value: 5 },
        { field: "totalGifts", op: "gt", value: 10 },
      ],
    },
  },

  // ─── ENTITY_TYPE ───
  {
    slug: "individual-donors",
    name: "Individual Donors",
    family: "ENTITY_TYPE",
    description: 'donorType matches "individual" or is blank.',
    color: "#1D1D1F",
    icon: "User",
    sortOrder: 110,
    rule: {
      logic: "or",
      rules: [
        { field: "donorType", op: "contains_any", value: ["individual"] },
        { field: "donorType", op: "blank" },
      ],
    },
  },
  {
    slug: "corporate-donors",
    name: "Corporate Donors",
    family: "ENTITY_TYPE",
    description:
      'donorType matches "corporate" / "company" / "business" / "sponsor".',
    color: "#0F766E",
    icon: "Building",
    sortOrder: 120,
    rule: {
      field: "donorType",
      op: "contains_any",
      value: ["corporate", "company", "business", "sponsor"],
    },
  },
  {
    slug: "foundation-donors",
    name: "Foundation / Grantmaker",
    family: "ENTITY_TYPE",
    description:
      'donorType matches "foundation" / "trust" / "fund" / "grantmaker".',
    color: "#7C3AED",
    icon: "Landmark",
    sortOrder: 130,
    rule: {
      field: "donorType",
      op: "contains_any",
      value: ["foundation", "trust", "fund", "grantmaker"],
    },
  },
  {
    slug: "daf-donors",
    name: "Donor-Advised Fund",
    family: "ENTITY_TYPE",
    description:
      'donorType matches "daf" / "donor advised" / "donor-advised".',
    color: "#0EA5E9",
    icon: "Wallet",
    sortOrder: 140,
    rule: {
      field: "donorType",
      op: "contains_any",
      value: ["daf", "donor advised", "donor-advised"],
    },
  },
];
