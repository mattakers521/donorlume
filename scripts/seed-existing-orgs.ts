/**
 * One-shot backfill — seeds the Phase-1 system cohort definitions for
 * every existing organization in the database. Idempotent (upserts on
 * (orgId, slug)), so safe to re-run.
 *
 * Usage:  npx tsx scripts/seed-existing-orgs.ts
 *
 * Adds 13 cohort definitions per org (9 GIVING_BEHAVIOR + 4 ENTITY_TYPE).
 * Existing CUSTOM cohorts are never touched; existing SYSTEM rows get
 * their name / rule / color refreshed from the seed file.
 *
 * The seeding logic is duplicated from `lib/cohorts/seed.ts` instead of
 * imported because that file pulls in `server-only`, which throws when
 * loaded directly via Node (it's a Next.js-bundler-time barrier, not a
 * runtime module). The cohort definitions themselves are imported by
 * reference — `lib/cohorts/system-cohorts.ts` has no server-only guard.
 */

import { PrismaClient, type Prisma } from "@prisma/client";

import { SYSTEM_COHORTS } from "@/lib/cohorts/system-cohorts";

const prisma = new PrismaClient();

async function seedSystemCohorts(orgId: string): Promise<number> {
  let written = 0;
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
    written++;
  }
  return written;
}

async function main() {
  const orgs = await prisma.organization.findMany({
    select: { id: true, name: true },
  });

  if (orgs.length === 0) {
    console.log("No organizations found.");
    return;
  }

  console.log(`Seeding system cohorts for ${orgs.length} org(s)…\n`);

  for (const org of orgs) {
    process.stdout.write(`  ${org.name}  (${org.id})  …  `);
    const before = await prisma.cohortDefinition.count({
      where: { orgId: org.id, type: "SYSTEM" },
    });
    await seedSystemCohorts(org.id);
    const after = await prisma.cohortDefinition.count({
      where: { orgId: org.id, type: "SYSTEM" },
    });
    const added = after - before;
    if (before === 0) {
      console.log(`seeded ${after} cohort definitions`);
    } else if (added > 0) {
      console.log(`refreshed (${added} new, ${after} total)`);
    } else {
      console.log(`already up to date (${after} cohort definitions)`);
    }
  }

  console.log(`\n✓ Done.`);
}

main()
  .catch((e) => {
    console.error("Backfill failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
