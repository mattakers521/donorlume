import { Layers, RefreshCw, Send, Target } from "lucide-react";

import { C } from "@/lib/design";
import { getCohortInsights } from "@/lib/cohorts/insights";
import { dismissOnboarding } from "@/lib/onboarding/actions";
import { getOnboardingState } from "@/lib/onboarding/state";
import { prisma } from "@/lib/prisma";
import { getOrgContext } from "@/lib/with-org";
import { CohortSnapshot } from "@/components/dashboard/cohort-snapshot";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { LapsedCard } from "@/components/dashboard/lapsed-card";
import { OnboardingChecklist } from "@/components/dashboard/onboarding-checklist";
import { QuickActions } from "@/components/dashboard/quick-actions";
import { RecentOutreach } from "@/components/dashboard/recent-outreach";
import { SavedProspectsCard } from "@/components/dashboard/saved-prospects-card";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const { org, user } = await getOrgContext();

  // Onboarding state is memoized via React `cache()` so the layout's
  // progress bar and this page share one DB round trip.
  const onboarding = await getOnboardingState(
    {
      id: org.id,
      name: org.name,
      mission: org.mission,
      signupPath: org.signupPath,
    },
    user.dismissedOnboarding,
  );

  // All other dashboard queries — scoped to org.id (multi-tenant safe).
  const [
    prospectCount,
    topProspects,
    lapsedCount,
    topLapsed,
    cohortInsights,
    recentCampaigns,
    sentDraftCount,
  ] = await Promise.all([
    prisma.prospect.count({ where: { orgId: org.id } }),
    prisma.prospect.findMany({
      where: { orgId: org.id },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    prisma.donor.count({
      where: { donorList: { orgId: org.id }, isLapsed: true },
    }),
    prisma.donor.findMany({
      where: { donorList: { orgId: org.id }, isLapsed: true },
      orderBy: { reactivationScore: "desc" },
      take: 4,
    }),
    getCohortInsights(org.id),
    prisma.outreachCampaign.findMany({
      where: { orgId: org.id },
      orderBy: { createdAt: "desc" },
      take: 3,
    }),
    // "Outreach Sent" KPI — counts drafts that actually made it through
    // Resend (messageId set). Mirrors the same metric the onboarding
    // state uses so the dashboard and checklist agree.
    prisma.outreachDraft.count({
      where: {
        campaign: { orgId: org.id },
        messageId: { not: null },
      },
    }),
  ]);

  // Cohorts with at least one classified donor. Drives the "Cohorts
  // Identified" KPI and the dashboard widget (top 5 by member count).
  const populatedCohorts = cohortInsights.filter((i) => i.memberCount > 0);
  const populatedCohortCount = populatedCohorts.length;
  const topCohorts = populatedCohorts
    .sort((a, b) => b.memberCount - a.memberCount)
    .slice(0, 5);

  return (
    <div style={{ maxWidth: 1200 }}>
      {onboarding.showChecklist && (
        <OnboardingChecklist
          steps={onboarding.visibleSteps}
          dismissAction={dismissOnboarding}
          firstName={user.name?.trim().split(/\s+/)[0] ?? null}
        />
      )}

      {/* KPIs */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 20,
          marginBottom: 36,
        }}
      >
        <KpiCard
          label="Saved Prospects"
          value={prospectCount > 0 ? String(prospectCount) : "0"}
          sub={
            prospectCount > 0
              ? `${prospectCount} in pipeline`
              : "Search to start"
          }
          icon={<Target size={22} color={C.amber} />}
          iconBg={C.amberLight}
          href="/discover"
        />
        <KpiCard
          label="Lapsed Donors"
          value={lapsedCount > 0 ? String(lapsedCount) : "0"}
          sub={
            lapsedCount > 0 ? `${lapsedCount} scored` : "Upload a CSV"
          }
          icon={<RefreshCw size={22} color={C.orange} />}
          iconBg={C.orangeLight}
          href="/lapsed"
        />
        <KpiCard
          label="Cohorts Identified"
          value={populatedCohortCount > 0 ? String(populatedCohortCount) : "0"}
          sub={
            populatedCohortCount > 0
              ? `${populatedCohortCount === 1 ? "cohort" : "cohorts"} with donors`
              : "Upload to classify"
          }
          icon={<Layers size={22} color={C.purple} />}
          iconBg={C.purpleLight}
          href="/cohorts"
        />
        <KpiCard
          label="Outreach Sent"
          value={String(sentDraftCount)}
          sub={
            sentDraftCount > 0
              ? `${sentDraftCount === 1 ? "email" : "emails"} delivered`
              : "Send your first draft"
          }
          icon={<Send size={22} color={C.green} />}
          iconBg={C.greenLight}
          href="/outreach"
        />
      </div>

      {/* Two-column body — collapses to single-column under 900px */}
      <div
        className="dashboard-body-grid"
        style={{
          display: "grid",
          gap: 24,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <SavedProspectsCard
            prospects={topProspects}
            total={prospectCount}
          />
          <LapsedCard donors={topLapsed} total={lapsedCount} />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <QuickActions />
          <RecentOutreach campaigns={recentCampaigns} />
          <CohortSnapshot topCohorts={topCohorts} />
        </div>
      </div>
    </div>
  );
}
