import { prisma } from "@/lib/prisma";

async function main() {
  const userId = "cmp3ingk4001qjpf2zerzr6m5"; // from the dev log
  const orgUser = await prisma.orgUser.findFirst({
    where: { userId },
    include: { org: true, user: { select: { name: true, email: true } } },
  });
  if (!orgUser) { console.log("no orgUser"); return; }
  console.log(`User: ${orgUser.user.email} | Org: ${orgUser.org.name} (${orgUser.org.id})`);
  const [campaigns, donors, prospects, drafts] = await Promise.all([
    prisma.outreachCampaign.count({ where: { orgId: orgUser.org.id } }),
    prisma.donorList.count({ where: { orgId: orgUser.org.id } }),
    prisma.prospect.count({ where: { orgId: orgUser.org.id } }),
    prisma.outreachDraft.count({ where: { campaign: { orgId: orgUser.org.id }, messageId: { not: null } } }),
  ]);
  console.log({ campaigns, donorLists: donors, prospects, sentDrafts: drafts });
  console.log({
    mission_set: !!orgUser.org.mission,
    name_set: !!orgUser.org.name,
    dismissedOnboarding: (await prisma.user.findUnique({ where: { id: userId }, select: { dismissedOnboarding: true } }))?.dismissedOnboarding,
  });
}
main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
