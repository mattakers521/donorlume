import { prisma } from "@/lib/prisma";
import { getOrgContext } from "@/lib/with-org";
import { LapsedClient } from "@/components/lapsed/lapsed-client";

export const dynamic = "force-dynamic";

export default async function LapsedPage() {
  const { org, userId, user, orgRole } = await getOrgContext();

  // Show the most-recent DonorList for this org. Older lists stay in the
  // database but aren't surfaced until we add a list-selector UI.
  const list = await prisma.donorList.findFirst({
    where: { orgId: org.id },
    orderBy: { createdAt: "desc" },
    include: {
      donors: {
        orderBy: { reactivationScore: "desc" },
        include: {
          cohorts: { include: { cohort: true } },
          claimedBy: { select: { id: true, name: true, email: true } },
        },
      },
    },
  });

  // Cohort definitions power the filter bar. Phase 1 surfaces the
  // GIVING_BEHAVIOR + ENTITY_TYPE families that the classifier writes to.
  const cohorts = await prisma.cohortDefinition.findMany({
    where: { orgId: org.id, isArchived: false },
    orderBy: [{ family: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
  });

  return (
    <LapsedClient
      initialList={list}
      lapsedThresholdMonths={12}
      cohorts={cohorts}
      currentUser={{ id: userId, name: user.name, email: user.email }}
      orgRole={orgRole}
    />
  );
}
