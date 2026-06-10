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
  claimedBy: { id: string; name: string | null; email: string } | null;
};

export default async function OutreachPage({
  searchParams,
}: {
  searchParams: Promise<{
    donors?: string;
    cohort?: string;
    onboarding?: string;
    /**
     * `from=selection` is set by the AttendeeView "Generate Outreach"
     * CTA after it stashes the chosen donor ids in sessionStorage.
     * URL-based ?donors= breaks past ~14kb of cuids; sessionStorage
     * has no such limit. The server treats this exactly like the
     * "no selection params" path — load every org donor — and the
     * OutreachClient narrows the initial selection to the
     * sessionStorage subset on mount.
     */
    from?: string;
  }>;
}) {
  console.log("[server-trace] OUTREACH NEW PAGE entry (before getOrgContext)");
  const { org, user, userId } = await getOrgContext();
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
  // outreach for this cohort" CTA). When NEITHER is present (e.g. the
  // user landed on /outreach/new from the sidebar or a dashboard
  // quick-action), default to every real donor in the org so attendees
  // and unlapsed contacts surface on the selection screen without
  // having to hop back to /upload or /cohorts. Cap at MAX_DEFAULT_LOAD
  // so a 50k-donor org doesn't ship the whole table to the client.
  const MAX_DEFAULT_LOAD = 2000;
  const fromSelection = params.from === "selection";
  // Load every org donor on the no-params path AND on the
  // sessionStorage-handoff path. The client narrows the selection on
  // mount in the second case.
  const noSelectionParams =
    (donorIds.length === 0 && !params.cohort) || fromSelection;

  const [byIdList, byCohortList, allOrgDonors] = await Promise.all([
    donorIds.length > 0
      ? prisma.donor.findMany({
          where: {
            id: { in: donorIds },
            donorList: { orgId: org.id },
          },
          include: {
            cohorts: { include: { cohort: true } },
            claimedBy: { select: { id: true, name: true, email: true } },
          },
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
          include: {
            cohorts: { include: { cohort: true } },
            claimedBy: { select: { id: true, name: true, email: true } },
          },
        })
      : Promise.resolve<RealDonorWithCohorts[]>([]),
    noSelectionParams
      ? prisma.donor.findMany({
          where: {
            donorList: { orgId: org.id },
            // Donors must have an email to be useful for outreach —
            // mirrors the upload-flow's name+email requirement.
            email: { not: null },
          },
          include: {
            cohorts: { include: { cohort: true } },
            claimedBy: { select: { id: true, name: true, email: true } },
          },
          // Recent uploads first so the post-upload "Generate outreach"
          // path lands on the new list at the top.
          orderBy: [
            { donorList: { processedAt: "desc" } },
            { reactivationScore: "desc" },
          ],
          take: MAX_DEFAULT_LOAD,
        })
      : Promise.resolve<RealDonorWithCohorts[]>([]),
  ]);

  // Dedupe by donor id — a donor could match multiple selection paths
  // (e.g. explicit ?donors= overlapping the default org-wide load).
  const realDonorsMap = new Map<string, RealDonorWithCohorts>();
  for (const d of [...byIdList, ...byCohortList, ...allOrgDonors])
    realDonorsMap.set(d.id, d);
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
    claimedBy: d.claimedBy,
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
    // Samples + manual contacts have no claim provenance — always null.
    claimedBy: null as {
      id: string;
      name: string | null;
      email: string;
    } | null,
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
        currentUserId={userId}
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
