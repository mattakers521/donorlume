import { prisma } from "@/lib/prisma";
import { getOrgContext } from "@/lib/with-org";
import { LapsedClient } from "@/components/lapsed/lapsed-client";

export const dynamic = "force-dynamic";

/**
 * Cap the donor fetch so a 2k+ row attendee list doesn't blow past
 * Vercel's serverless memory/time limits during the RSC payload
 * serialization. Raised to 2,500 after VETLIFE-scale uploads
 * (2,178 attendees) were being truncated to 1,500 in the UI — the
 * cap was leftover from an earlier crash-safety pass before we
 * trimmed the per-donor payload.
 *
 * If the list is bigger than this, we slice to the most-recent
 * batch. Anything that needs cross-list aggregates already lives
 * on /donors and /reports which paginate properly.
 */
const MAX_DONORS_PER_RENDER = 2500;

export default async function LapsedPage() {
  const { org, userId, user, orgRole } = await getOrgContext();

  // Show the most-recent DonorList for this org. Older lists stay in the
  // database but aren't surfaced until we add a list-selector UI.
  let list: Awaited<ReturnType<typeof loadList>> = null;
  let loadError: string | null = null;
  try {
    list = await loadList(org.id);
  } catch (e) {
    // Log + render an empty-state instead of throwing — a transient
    // DB timeout shouldn't blank-screen the whole route.
    console.error("[lapsed-page] donorList load failed", e);
    loadError =
      e instanceof Error ? e.message : "Couldn't load your donor list.";
  }

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
      loadError={loadError}
    />
  );
}

async function loadList(orgId: string) {
  return prisma.donorList.findFirst({
    where: { orgId },
    orderBy: { createdAt: "desc" },
    include: {
      donors: {
        // For attendee lists every score is 0, so the order is
        // effectively insertion order anyway — still cheap, still
        // deterministic.
        orderBy: { reactivationScore: "desc" },
        take: MAX_DONORS_PER_RENDER,
        include: {
          cohorts: { include: { cohort: true } },
          claimedBy: { select: { id: true, name: true, email: true } },
        },
      },
    },
  });
}
