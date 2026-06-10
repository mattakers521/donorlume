/* eslint-disable no-console */
/**
 * Delete every DonorList in the matt.akers@vibrantcauses.com org.
 * Cascade onDelete on Donor + DonorCohort cleans up the dependents,
 * but the cohort definitions themselves stay (they're keyed by org +
 * slug and re-upsert cleanly on the next upload).
 *
 * Use this after fixing the upload pipeline so the next UI upload
 * starts from a clean slate.
 */

import { PrismaClient } from "@prisma/client";

const OWNER_EMAIL = "matt.akers@vibrantcauses.com";
const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findUnique({
    where: { email: OWNER_EMAIL },
    include: { orgs: true },
  });
  if (!user) throw new Error("no user");
  const orgId = user.orgs[0]!.orgId;

  const before = await prisma.donorList.findMany({
    where: { orgId },
    select: { id: true, name: true, totalDonors: true },
  });
  console.log(`org=${orgId} existing lists=${before.length}`);
  for (const l of before) {
    console.log(`  - ${l.name} (${l.totalDonors} donors) id=${l.id}`);
  }

  const result = await prisma.donorList.deleteMany({ where: { orgId } });
  console.log(`deleted ${result.count} DonorList row(s)`);

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error("FAILED:", e);
  await prisma.$disconnect();
  process.exit(1);
});
