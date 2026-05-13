import type { CohortDefinition, Donor, DonorCohort } from "@prisma/client";

import { isInUnpaidTrial } from "@/lib/billing/trial";
import type { DonorContext } from "@/lib/outreach/prompt";
import { prisma } from "@/lib/prisma";
import { SAMPLE_DONORS } from "@/lib/outreach/sample-donors";
import { getOrgContext } from "@/lib/with-org";
import { OutreachClient } from "@/components/outreach/outreach-client";
import { TrialAiCounter } from "@/components/outreach/trial-ai-counter";

export const dynamic = "force-dynamic";

type RealDonorWithCohorts = Donor & {
  cohorts: (DonorCohort & { cohort: CohortDefinition })[];
};

export default async function OutreachPage({
  searchParams,
}: {
  searchParams: Promise<{
    donors?: string;
    cohort?: string;
    onboarding?: string;
  }>;
}) {
  console.log("[server-trace] OUTREACH NEW PAGE entry (before getOrgContext)");
  const { org, user } = await getOrgContext();
  console.log(
    `[server-trace] OUTREACH NEW PAGE: getOrgContext OK org=${org.id} user=${user.id}`,
  );
  const params = await searchParams;
  // ?onboarding=1 is appended by the dashboard checklist's step 4 CTA.
  // When present, the OutreachClient renders inline helper banners that
  // guide the user from one sub-step to the next.
  const onboardingActive = params.onboarding === "1";

  const donorIds = (params.donors ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  // Pull both selection sources in parallel: explicit ?donors=ids (from
  // /lapsed handoff) AND ?cohort=slug (from cohort detail's "Generate
  // outreach for this cohort" CTA). Either or both may be present.
  const [byIdList, byCohortList] = await Promise.all([
    donorIds.length > 0
      ? prisma.donor.findMany({
          where: {
            id: { in: donorIds },
            donorList: { orgId: org.id },
          },
          include: { cohorts: { include: { cohort: true } } },
        })
      : Promise.resolve<RealDonorWithCohorts[]>([]),
    params.cohort
      ? prisma.donor.findMany({
          where: {
            donorList: { orgId: org.id },
            cohorts: {
              some: {
                cohort: { orgId: org.id, slug: params.cohort },
              },
            },
          },
          include: { cohorts: { include: { cohort: true } } },
        })
      : Promise.resolve<RealDonorWithCohorts[]>([]),
  ]);

  // Dedupe by donor id — a donor could match both selection paths.
  const realDonorsMap = new Map<string, RealDonorWithCohorts>();
  for (const d of [...byIdList, ...byCohortList]) realDonorsMap.set(d.id, d);
  const realDonors = [...realDonorsMap.values()];

  // Fetch org settings + all cohort defs for the filter bar.
  const [settings, allCohorts] = await Promise.all([
    prisma.orgSettings.findUnique({ where: { orgId: org.id } }),
    prisma.cohortDefinition.findMany({
      where: { orgId: org.id, isArchived: false },
      orderBy: [{ family: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
    }),
  ]);

  const realDonorsForClient = realDonors.map((d) => ({
    id: d.id,
    donorId: d.id,
    isReal: true as const,
    ctx: donorToContext(d),
    cohorts: d.cohorts.map((dc) => ({
      id: dc.cohort.id,
      name: dc.cohort.name,
      color: dc.cohort.color ?? "#E8860C",
    })),
  }));

  const sampleDonorsForClient = SAMPLE_DONORS.map((s) => ({
    id: s.id,
    donorId: null,
    isReal: false as const,
    ctx: {
      name: s.name,
      email: s.email ?? null,
      donorType: s.donorType ?? null,
      totalGifts: s.totalGifts ?? null,
      totalGiven: s.totalGiven ?? null,
      largestGift: s.largestGift ?? null,
      averageGift: s.averageGift ?? null,
      lastGiftLabel: s.lastGiftLabel ?? null,
      lapsedMonths: s.lapsedMonths ?? null,
      reactivationScore: s.reactivationScore ?? null,
      tier: s.tier ?? null,
      activeElsewhere: s.activeElsewhere ?? null,
      notes: s.notes ?? null,
      cohorts: [],
    } satisfies DonorContext,
    cohorts: [] as { id: string; name: string; color: string }[],
  }));

  // If the user arrived via ?cohort=slug, pre-apply that cohort filter
  // on the selection screen so the list is already narrowed.
  const initialCohortFilterId = params.cohort
    ? allCohorts.find((c) => c.slug === params.cohort)?.id ?? null
    : null;

  // Trial-cap counter — only renders for unpaid-trial orgs.
  const inUnpaidTrial = isInUnpaidTrial({
    trialEndsAt: org.trialEndsAt,
    stripeSubscriptionId: org.stripeSubscriptionId,
  });
  const trialDraftsUsed = inUnpaidTrial
    ? await prisma.outreachDraft.count({
        where: { campaign: { orgId: org.id } },
      })
    : 0;

  return (
    <>
      {inUnpaidTrial && <TrialAiCounter used={trialDraftsUsed} />}
      <OutreachClient
        defaults={{
          orgName: org.name,
          mission: org.mission ?? "",
          senderName: settings?.senderName ?? user.name ?? "",
          senderTitle: settings?.senderTitle ?? "",
          tone: settings?.defaultTone ?? "warm",
          emailType: settings?.defaultEmailType ?? "reactivation",
          customInstructions: settings?.customInstructions ?? "",
        }}
        realDonors={realDonorsForClient}
        sampleDonors={sampleDonorsForClient}
        cohorts={allCohorts}
        initialCohortFilterId={initialCohortFilterId}
        onboardingActive={onboardingActive}
      />
    </>
  );
}

function donorToContext(d: RealDonorWithCohorts): DonorContext {
  const ms = d.lastGiftDate ? new Date(d.lastGiftDate).getTime() : null;
  const lapsedMonths =
    ms != null ? Math.floor((Date.now() - ms) / (30 * 86_400_000)) : null;
  const lastGiftLabel = d.lastGiftDate
    ? new Date(d.lastGiftDate).toLocaleDateString("en-US", {
        month: "short",
        year: "numeric",
      })
    : null;
  const avg =
    d.totalGifts && d.totalGiven && d.totalGifts > 0
      ? Math.round(d.totalGiven / d.totalGifts)
      : null;
  return {
    name: d.name,
    email: d.email,
    donorType: d.donorType,
    totalGifts: d.totalGifts,
    totalGiven: d.totalGiven,
    largestGift: d.largestGift,
    averageGift: avg,
    lastGiftLabel,
    lapsedMonths,
    reactivationScore: d.reactivationScore,
    tier: d.tier,
    activeElsewhere: d.activeElsewhere,
    notes: d.notes,
    // AI prompt enhancement (Spec §7) — donor's cohort names threaded
    // through to the prompt builder via DonorContext.cohorts.
    cohorts: d.cohorts.map((dc) => dc.cohort.name),
  };
}
