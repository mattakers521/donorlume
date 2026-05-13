import { prisma } from "@/lib/prisma";

async function main() {
  const user = await prisma.user.findUnique({
    where: { email: "toni@email.com" },
    select: {
      id: true,
      email: true,
      name: true,
      dismissedOnboarding: true,
      orgs: {
        select: {
          org: {
            select: {
              id: true,
              name: true,
              mission: true,
              signupPath: true,
            },
          },
        },
      },
    },
  });
  if (!user) {
    console.log("toni@email.com not found");
    return;
  }
  const org = user.orgs[0]?.org;
  if (!org) {
    console.log("no org");
    return;
  }

  const [donorListCount, prospectCount, campaignCount, sentDraftCount] =
    await Promise.all([
      prisma.donorList.count({ where: { orgId: org.id } }),
      prisma.prospect.count({ where: { orgId: org.id } }),
      prisma.outreachCampaign.count({ where: { orgId: org.id } }),
      prisma.outreachDraft.count({
        where: { campaign: { orgId: org.id }, messageId: { not: null } },
      }),
    ]);

  const steps = [
    {
      key: "profile",
      done: !!org.name?.trim() && !!org.mission?.trim(),
    },
    { key: "prospects", done: prospectCount > 0 },
    { key: "donors", done: donorListCount > 0 },
    { key: "outreach", done: campaignCount > 0 },
    { key: "send", done: sentDraftCount > 0 },
  ];
  const completed = steps.filter((s) => s.done).length;

  console.log(`User: ${user.email}  id=${user.id}`);
  console.log(`Org: ${org.name}  signupPath=${org.signupPath ?? "—"}`);
  console.log(`dismissedOnboarding: ${user.dismissedOnboarding}`);
  console.log(`Step completion (${completed}/5):`);
  for (const s of steps) {
    console.log(`  • ${s.key}: ${s.done ? "✓ done" : "○ pending"}`);
  }
  console.log("");
  console.log("Visibility under CURRENT rule (showChecklist = !dismissed && completed < 3):");
  console.log(`  → ${!user.dismissedOnboarding && completed < 3 ? "VISIBLE" : "HIDDEN"}`);
  console.log("");
  console.log("Visibility under NEW rule (showChecklist = !dismissed && completed < total):");
  console.log(`  → ${!user.dismissedOnboarding && completed < 5 ? "VISIBLE" : "HIDDEN"}`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
