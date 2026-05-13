/**
 * Idempotent seeding of system cohort definitions for an org.
 * Safe to call on every CSV upload — `upsert` on (orgId, slug) is unique
 * and existing rows are no-ops as long as nothing actually changed.
 */

import "server-only";

import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { SYSTEM_COHORTS } from "@/lib/cohorts/system-cohorts";

export async function seedSystemCohorts(orgId: string): Promise<void> {
  // Sequential upserts — 13 cohorts, fast enough; createMany lacks
  // skipDuplicates-then-update semantics so we just upsert.
  for (const def of SYSTEM_COHORTS) {
    await prisma.cohortDefinition.upsert({
      where: { orgId_slug: { orgId, slug: def.slug } },
      create: {
        orgId,
        slug: def.slug,
        name: def.name,
        family: def.family,
        type: "SYSTEM",
        description: def.description,
        color: def.color,
        icon: def.icon,
        sortOrder: def.sortOrder,
        rule: def.rule as unknown as Prisma.InputJsonValue,
      },
      // Refresh name/description/color/rule if the seed file evolves —
      // org-specific custom cohorts (type=CUSTOM) are never touched.
      update: {
        name: def.name,
        family: def.family,
        description: def.description,
        color: def.color,
        icon: def.icon,
        sortOrder: def.sortOrder,
        rule: def.rule as unknown as Prisma.InputJsonValue,
      },
    });
  }
}
