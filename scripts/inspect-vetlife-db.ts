/* eslint-disable no-console */
/**
 * Direct DB inspection — print enrichmentData for the first 3 + last 3
 * donors in the org's most-recent list, plus an aggregate over all
 * donors so we can see whether the scores I wrote with reload-vetlife
 * are intact or whether something overwrote them.
 *
 * Usage: npx tsx scripts/inspect-vetlife-db.ts
 */

import { PrismaClient } from "@prisma/client";

const OWNER_EMAIL = "matt.akers@vibrantcauses.com";
const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findUnique({
    where: { email: OWNER_EMAIL },
    include: { orgs: { include: { org: true } } },
  });
  if (!user) throw new Error(`No user ${OWNER_EMAIL}`);
  const org = user.orgs[0]!.org;
  console.log(`org=${org.id} (${org.name})`);

  const list = await prisma.donorList.findFirst({
    where: { orgId: org.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      totalDonors: true,
      processedAt: true,
    },
  });
  if (!list) {
    console.log("no donor lists");
    return;
  }
  console.log(`list=${list.id} name=${list.name} total=${list.totalDonors}`);

  // First 3 + last 3 raw rows so we can see whether enrichmentData
  // contains real engagement objects or whether something stripped
  // them down.
  const donors = await prisma.donor.findMany({
    where: { donorListId: list.id },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: { id: true, name: true, email: true, enrichmentData: true },
  });
  console.log(`\nactual donor count: ${donors.length}`);

  console.log("\n──── first 3 donors ────");
  for (const d of donors.slice(0, 3)) {
    console.log(`\n${d.name} <${d.email}>  id=${d.id}`);
    console.log(`enrichmentData: ${JSON.stringify(d.enrichmentData, null, 2)}`);
  }

  console.log("\n──── last 3 donors ────");
  for (const d of donors.slice(-3)) {
    console.log(`\n${d.name} <${d.email}>  id=${d.id}`);
    console.log(`enrichmentData: ${JSON.stringify(d.enrichmentData, null, 2)}`);
  }

  // Aggregate: how many donors have engagement.score, what's the
  // distribution, how many have backfilled:true.
  console.log("\n──── aggregate over all donors ────");
  let withEngagement = 0;
  let withYears = 0;
  let backfilledTrue = 0;
  let backfilledFalse = 0;
  let scoreSum = 0;
  let yearsSum = 0;
  const scoreBuckets = new Map<string, number>();
  for (const d of donors) {
    const enr = d.enrichmentData as
      | { engagement?: {
          score?: number;
          yearsAttended?: number;
          backfilled?: boolean;
        } }
      | null;
    const e = enr?.engagement;
    if (!e) continue;
    withEngagement++;
    if ((e.yearsAttended ?? 0) > 0) withYears++;
    if (e.backfilled === true) backfilledTrue++;
    else backfilledFalse++;
    scoreSum += e.score ?? 0;
    yearsSum += e.yearsAttended ?? 0;
    const b =
      (e.score ?? 0) >= 80
        ? "80-100"
        : (e.score ?? 0) >= 60
          ? "60-79"
          : (e.score ?? 0) >= 40
            ? "40-59"
            : (e.score ?? 0) >= 20
              ? "20-39"
              : "0-19";
    scoreBuckets.set(b, (scoreBuckets.get(b) ?? 0) + 1);
  }
  console.log(`donors with enrichmentData.engagement:    ${withEngagement}/${donors.length}`);
  console.log(`donors with yearsAttended > 0:            ${withYears}/${donors.length}`);
  console.log(`donors with engagement.backfilled = true: ${backfilledTrue}`);
  console.log(`donors with engagement.backfilled = false/absent: ${backfilledFalse}`);
  console.log(`avg score:        ${(scoreSum / Math.max(withEngagement, 1)).toFixed(1)}`);
  console.log(`avg yearsAttended: ${(yearsSum / Math.max(withEngagement, 1)).toFixed(2)}`);
  console.log(
    `score buckets:    ${JSON.stringify(
      Object.fromEntries(
        [...scoreBuckets.entries()].sort(
          ([a], [b]) =>
            Number(a.split("-")[0]) - Number(b.split("-")[0]),
        ),
      ),
    )}`,
  );

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error("FAILED:", e);
  await prisma.$disconnect();
  process.exit(1);
});
