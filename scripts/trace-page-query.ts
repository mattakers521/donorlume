/* eslint-disable no-console */
/**
 * Runs the EXACT prisma query from app/(app)/lapsed/page.tsx,
 * serializes the first 3 donors the way Next.js's RSC payload would,
 * and prints what the client component sees. Catches any subtle
 * Prisma include/select issue or JSON serialization quirk between
 * DB and client mount.
 */

import { PrismaClient } from "@prisma/client";

const OWNER_EMAIL = "matt.akers@vibrantcauses.com";
const MAX_DONORS_PER_RENDER = 2500;

const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findUnique({
    where: { email: OWNER_EMAIL },
    include: { orgs: true },
  });
  if (!user) throw new Error("no user");
  const orgId = user.orgs[0]!.orgId;

  console.log("──── running the EXACT page query ────");
  const list = await prisma.donorList.findFirst({
    where: { orgId },
    orderBy: { createdAt: "desc" },
    include: {
      donors: {
        orderBy: { reactivationScore: "desc" },
        take: MAX_DONORS_PER_RENDER,
        include: {
          cohorts: { include: { cohort: true } },
          claimedBy: { select: { id: true, name: true, email: true } },
        },
      },
    },
  });

  if (!list) {
    console.log("no list");
    return;
  }
  console.log(`list.donors.length = ${list.donors.length}`);
  console.log(
    `list.donors[0] keys: ${Object.keys(list.donors[0]!).join(", ")}`,
  );

  // Serialize the first 3 the way Next.js would for the RSC payload.
  // JSON.stringify hits the Date toISOString path and recursively
  // serializes JsonValue, so anything that survives is exactly what
  // the client gets on the other end of the boundary.
  for (let i = 0; i < Math.min(3, list.donors.length); i++) {
    const d = list.donors[i]!;
    console.log(`\n──── donor[${i}] ${d.name} ────`);
    console.log(`raw .enrichmentData JS type: ${typeof d.enrichmentData}`);
    console.log(
      `raw .enrichmentData === null: ${d.enrichmentData === null}`,
    );
    console.log(
      `raw .enrichmentData: ${JSON.stringify(d.enrichmentData, null, 2)}`,
    );

    // Simulate the AttendeeView read path verbatim.
    const enrichment = d.enrichmentData as
      | { engagement?: { score: number; yearsAttended: number; years: number[] } }
      | null;
    console.log(`enrichment?.engagement:`, enrichment?.engagement);
    console.log(`engagement.score: ${enrichment?.engagement?.score}`);
    console.log(
      `engagement.yearsAttended: ${enrichment?.engagement?.yearsAttended}`,
    );
    console.log(`engagement.years:`, enrichment?.engagement?.years);
  }

  // Now serialize the ENTIRE first donor through JSON and back, then
  // re-read enrichmentData. That's the round-trip the RSC payload
  // does on its way to the client.
  console.log("\n──── round-trip JSON test (mimics RSC serialization) ────");
  const d0 = list.donors[0]!;
  const serialized = JSON.stringify(d0);
  console.log(`serialized payload size: ${serialized.length} bytes`);
  const roundTripped = JSON.parse(serialized) as typeof d0;
  console.log(
    `roundTripped.enrichmentData: ${JSON.stringify(roundTripped.enrichmentData, null, 2)}`,
  );
  console.log(
    `roundTripped engagement.score: ${(roundTripped.enrichmentData as { engagement?: { score?: number } })?.engagement?.score}`,
  );

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error("FAILED:", e);
  await prisma.$disconnect();
  process.exit(1);
});
