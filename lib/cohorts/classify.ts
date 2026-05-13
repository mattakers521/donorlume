/**
 * Cohort classification — Spec §3.
 *
 * Takes the org's cohort definitions and a batch of (persisted) donors
 * and returns the (donorId, cohortDefinitionId) pairs that should land
 * in DonorCohort. The caller is responsible for the bulk insert.
 *
 * Phase 1 evaluates GIVING_BEHAVIOR + ENTITY_TYPE families directly from
 * the rule JSON. ENGAGEMENT (CSV tags) and TRAJECTORY (computed) come in
 * later phases.
 */

import type { CohortDefinition, Donor } from "@prisma/client";

import { evaluateRule, type Rule } from "@/lib/cohorts/rules";

export type ClassificationAssignment = {
  donorId: string;
  cohortDefinitionId: string;
  assignmentType: "auto";
};

export function classifyDonors(
  donors: Donor[],
  cohorts: CohortDefinition[],
): ClassificationAssignment[] {
  const now = Date.now();
  // Phase 1 only auto-classifies these two families. SYSTEM ENGAGEMENT/
  // TRAJECTORY cohorts (when they arrive) shouldn't be matched against
  // this rule-eval path — they have their own pipelines.
  const phase1 = cohorts.filter(
    (c) =>
      c.type === "SYSTEM" &&
      (c.family === "GIVING_BEHAVIOR" || c.family === "ENTITY_TYPE") &&
      c.rule != null,
  );

  const out: ClassificationAssignment[] = [];
  for (const donor of donors) {
    for (const cohort of phase1) {
      const rule = cohort.rule as unknown as Rule;
      if (evaluateRule(rule, donor, now)) {
        out.push({
          donorId: donor.id,
          cohortDefinitionId: cohort.id,
          assignmentType: "auto",
        });
      }
    }
  }
  return out;
}
