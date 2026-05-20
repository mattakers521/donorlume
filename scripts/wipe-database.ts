/**
 * One-off pre-launch database wipe. Removes every row in every
 * business + auth table so the operator can sign up fresh with a
 * real email. Schema, migrations, and NextAuth structure are
 * untouched — only row data is deleted.
 *
 * Run with: npx tsx scripts/wipe-database.ts
 *
 * Safety: all deletes ride a single Prisma $transaction. If any
 * single deleteMany fails (FK constraint surprise, connectivity
 * blip, etc.), the entire transaction rolls back and the database
 * is left untouched.
 *
 * The order below is child-tables-first so each delete passes its
 * FK constraint cleanly even without CASCADE. Order matters; do
 * not rearrange without re-checking the schema relations.
 */
import { prisma } from "@/lib/prisma";

function maskedUrl(): string {
  const raw = process.env.DATABASE_URL ?? "(unset)";
  return raw.replace(/:\/\/[^@]+@/, "://***:***@");
}

async function countAll() {
  const [
    emailClicks,
    outreachDrafts,
    outreachCampaigns,
    donorCohorts,
    donors,
    donorLists,
    cohortDefinitions,
    prospects,
    invitations,
    orgSettings,
    orgUsers,
    accounts,
    verificationTokens,
    organizations,
    users,
  ] = await Promise.all([
    prisma.emailClick.count(),
    prisma.outreachDraft.count(),
    prisma.outreachCampaign.count(),
    prisma.donorCohort.count(),
    prisma.donor.count(),
    prisma.donorList.count(),
    prisma.cohortDefinition.count(),
    prisma.prospect.count(),
    prisma.invitation.count(),
    prisma.orgSettings.count(),
    prisma.orgUser.count(),
    prisma.account.count(),
    prisma.verificationToken.count(),
    prisma.organization.count(),
    prisma.user.count(),
  ]);
  return {
    EmailClick: emailClicks,
    OutreachDraft: outreachDrafts,
    OutreachCampaign: outreachCampaigns,
    DonorCohort: donorCohorts,
    Donor: donors,
    DonorList: donorLists,
    CohortDefinition: cohortDefinitions,
    Prospect: prospects,
    Invitation: invitations,
    OrgSettings: orgSettings,
    OrgUser: orgUsers,
    Account: accounts,
    VerificationToken: verificationTokens,
    Organization: organizations,
    User: users,
  };
}

function printTable(label: string, counts: Record<string, number>) {
  console.log(`\n${label}`);
  console.log("─".repeat(40));
  const rows = Object.entries(counts);
  const maxName = Math.max(...rows.map(([k]) => k.length));
  let total = 0;
  for (const [name, count] of rows) {
    console.log(`  ${name.padEnd(maxName + 2)}${count.toString().padStart(6)}`);
    total += count;
  }
  console.log("─".repeat(40));
  console.log(`  ${"TOTAL".padEnd(maxName + 2)}${total.toString().padStart(6)}`);
}

async function main() {
  console.log(`Target DB: ${maskedUrl()}\n`);

  const before = await countAll();
  printTable("BEFORE wipe", before);

  console.log("\nRunning wipe transaction…");
  await prisma.$transaction([
    prisma.emailClick.deleteMany(),
    prisma.outreachDraft.deleteMany(),
    prisma.outreachCampaign.deleteMany(),
    prisma.donorCohort.deleteMany(),
    prisma.donor.deleteMany(),
    prisma.donorList.deleteMany(),
    prisma.cohortDefinition.deleteMany(),
    prisma.prospect.deleteMany(),
    prisma.invitation.deleteMany(),
    prisma.orgSettings.deleteMany(),
    prisma.orgUser.deleteMany(),
    prisma.account.deleteMany(),
    prisma.verificationToken.deleteMany(),
    prisma.organization.deleteMany(),
    prisma.user.deleteMany(),
  ]);
  console.log("Transaction committed.");

  const after = await countAll();
  printTable("AFTER wipe", after);

  const remaining = Object.values(after).reduce((a, b) => a + b, 0);
  if (remaining === 0) {
    console.log("\n✓ Database is clean. Ready for a fresh signup.");
  } else {
    console.error(
      `\n✗ ${remaining} rows remain across all tables — unexpected, investigate before signup.`,
    );
    process.exitCode = 1;
  }
}

main()
  .then(() => process.exit(process.exitCode ?? 0))
  .catch((e) => {
    console.error("Wipe failed:", e);
    process.exit(1);
  });
