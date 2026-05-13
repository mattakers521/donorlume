/**
 * JSON rule evaluator for cohort classification (Spec §3).
 *
 * A rule is either:
 *  - a leaf:     `{ field, op, value? }`
 *  - a compound: `{ logic: "and" | "or" | "not", rules: Rule[] }`
 *
 * Leaf operators supported in Phase 1:
 *   eq, gt, gte, lt, lte           — numeric comparisons (null → false)
 *   contains_any                   — string contains any of value[] (case-insensitive)
 *   blank                          — value is null/undefined/empty string
 *
 * Virtual fields computed from the donor at evaluation time:
 *   monthsSinceLastGift  — derived from lastGiftDate vs now
 *   tenureYears          — derived from (lastGiftDate − firstGiftDate)
 */

import type { Donor } from "@prisma/client";

export type LeafRule = {
  field: string;
  op:
    | "eq"
    | "gt"
    | "gte"
    | "lt"
    | "lte"
    | "contains_any"
    | "blank";
  value?: unknown;
};

export type CompoundRule = {
  logic: "and" | "or" | "not";
  rules: Rule[];
};

export type Rule = LeafRule | CompoundRule;

const MS_PER_DAY = 86_400_000;
const MS_PER_MONTH = MS_PER_DAY * 30;
const MS_PER_YEAR = MS_PER_DAY * 365;

function getField(donor: Donor, now: number, field: string): unknown {
  switch (field) {
    case "monthsSinceLastGift":
      return donor.lastGiftDate
        ? Math.floor((now - new Date(donor.lastGiftDate).getTime()) / MS_PER_MONTH)
        : null;
    case "tenureYears":
      return donor.firstGiftDate && donor.lastGiftDate
        ? (new Date(donor.lastGiftDate).getTime() -
            new Date(donor.firstGiftDate).getTime()) /
            MS_PER_YEAR
        : null;
    default:
      return (donor as unknown as Record<string, unknown>)[field];
  }
}

function isCompound(r: Rule): r is CompoundRule {
  return (r as CompoundRule).logic !== undefined;
}

export function evaluateRule(
  rule: Rule | null | undefined,
  donor: Donor,
  now: number = Date.now(),
): boolean {
  if (!rule) return false;

  if (isCompound(rule)) {
    if (rule.logic === "and") return rule.rules.every((r) => evaluateRule(r, donor, now));
    if (rule.logic === "or") return rule.rules.some((r) => evaluateRule(r, donor, now));
    if (rule.logic === "not")
      return rule.rules.length === 1 && !evaluateRule(rule.rules[0], donor, now);
    return false;
  }

  const raw = getField(donor, now, rule.field);

  switch (rule.op) {
    case "blank":
      return raw == null || (typeof raw === "string" && raw.trim() === "");

    case "eq":
      return raw === rule.value;

    case "gt":
    case "gte":
    case "lt":
    case "lte": {
      if (raw == null || rule.value == null) return false;
      const a = Number(raw);
      const b = Number(rule.value);
      if (Number.isNaN(a) || Number.isNaN(b)) return false;
      if (rule.op === "gt") return a > b;
      if (rule.op === "gte") return a >= b;
      if (rule.op === "lt") return a < b;
      return a <= b;
    }

    case "contains_any": {
      if (raw == null) return false;
      const haystack = String(raw).toLowerCase();
      const needles = Array.isArray(rule.value)
        ? (rule.value as unknown[])
        : [rule.value];
      return needles.some((n) => haystack.includes(String(n).toLowerCase()));
    }

    default:
      return false;
  }
}
