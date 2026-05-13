import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Send } from "lucide-react";

import { C, brandGradient } from "@/lib/design";
import { cohortBreakdown, deriveCampaignMetrics } from "@/lib/outreach/insights";
import { prisma } from "@/lib/prisma";
import { getOrgContext } from "@/lib/with-org";
import { CampaignCohortBreakdown } from "@/components/outreach/campaign-cohort-breakdown";
import {
  CampaignDraftTable,
  type CampaignDraftRow,
} from "@/components/outreach/campaign-draft-table";
import { CampaignMetricsBar } from "@/components/outreach/campaign-metrics-bar";

export const dynamic = "force-dynamic";

const EMAIL_TYPE_LABEL: Record<string, string> = {
  reactivation: "Reactivation",
  impact_update: "Impact Update",
  event_invite: "Event Invite",
  year_end: "Year-End Appeal",
};

const TONE_LABEL: Record<string, string> = {
  warm: "Warm & Personal",
  professional: "Professional",
  impact: "Impact-Driven",
  casual: "Casual",
};

export default async function CampaignReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ onboarding?: string }>;
}) {
  const { id } = await params;
  const { onboarding } = await searchParams;
  const onboardingActive = onboarding === "1";
  const { org } = await getOrgContext();

  const campaign = await prisma.outreachCampaign.findFirst({
    where: { id, orgId: org.id },
    include: {
      drafts: {
        orderBy: { createdAt: "asc" },
        include: {
          donor: {
            include: {
              cohorts: {
                include: { cohort: true },
              },
            },
          },
        },
      },
    },
  });

  if (!campaign) notFound();

  const metrics = deriveCampaignMetrics(campaign);
  const breakdown = cohortBreakdown(campaign.drafts);
  const hasRealDonors = campaign.drafts.some((d) => d.donor != null);

  const tableRows: CampaignDraftRow[] = campaign.drafts.map((d) => ({
    id: d.id,
    recipientName: d.recipientName,
    recipientEmail: d.recipientEmail,
    subject: d.subject,
    body: d.body,
    status: d.status,
    sentAt: d.sentAt?.toISOString() ?? null,
    deliveredAt: d.deliveredAt?.toISOString() ?? null,
    openedAt: d.openedAt?.toISOString() ?? null,
    openCount: d.openCount,
    clickedAt: d.clickedAt?.toISOString() ?? null,
    clickCount: d.clickCount,
    bouncedAt: d.bouncedAt?.toISOString() ?? null,
    bounceReason: d.bounceReason,
    repliedAt: d.repliedAt?.toISOString() ?? null,
    cohorts:
      d.donor?.cohorts.map((dc) => ({
        id: dc.cohort.id,
        name: dc.cohort.name,
        color: dc.cohort.color ?? C.amber,
      })) ?? [],
  }));

  const subtitle = [
    campaign.campaign?.trim(),
    EMAIL_TYPE_LABEL[campaign.emailType] ?? campaign.emailType,
    TONE_LABEL[campaign.tone] ?? campaign.tone,
    new Date(campaign.createdAt).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }),
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div style={{ maxWidth: 1200 }}>
      <Link
        href="/outreach"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          fontSize: 14,
          color: C.amber,
          textDecoration: "none",
          marginBottom: 24,
          fontWeight: 600,
        }}
      >
        <ChevronLeft size={18} /> All campaigns
      </Link>

      {onboardingActive && <Step5Banner />}

      <header style={{ marginBottom: 24 }}>
        <h2
          style={{
            fontFamily: "var(--font-instrument-serif), Georgia, serif",
            fontSize: 30,
            fontWeight: 400,
            color: C.text,
            margin: 0,
            letterSpacing: -0.8,
            lineHeight: 1.15,
          }}
        >
          {campaign.name}
        </h2>
        {subtitle && (
          <p
            style={{
              fontSize: 13,
              color: C.textTertiary,
              margin: "6px 0 0",
              fontWeight: 500,
            }}
          >
            {subtitle}
          </p>
        )}
      </header>

      <CampaignMetricsBar
        totalDrafts={campaign.totalDrafts}
        metrics={metrics}
        deliveredCount={campaign.deliveredCount}
        openedCount={campaign.openedCount}
        clickedCount={campaign.clickedCount}
        repliedCount={campaign.repliedCount}
        bouncedCount={campaign.bouncedCount}
      />

      {hasRealDonors && breakdown.length > 0 && (
        <CampaignCohortBreakdown
          rows={breakdown}
          campaignMetrics={metrics}
        />
      )}

      <CampaignDraftTable drafts={tableRows} />
    </div>
  );
}

/**
 * Final-step onboarding banner. Rendered above the campaign header
 * when the user lands here via `?onboarding=1` (the step-5 CTA on the
 * dashboard checklist points here, and the AI Outreach Studio's
 * `firstCampaign` toast can also forward into this view).
 *
 * Disappears once the user navigates away from the onboarding link —
 * the `?onboarding=1` flag is opt-in, never sticky. After they send
 * their first draft, `OutreachDraft.messageId` flips and the dashboard
 * checklist closes step 5 on the next render; the banner only
 * surfaces on the explicit guided URL, so it stops appearing
 * organically once they're using the page on their own terms.
 */
function Step5Banner() {
  return (
    <div
      role="note"
      aria-label="Final onboarding step"
      style={{
        position: "relative",
        marginBottom: 20,
        borderRadius: 18,
        padding: 2,
        background: `linear-gradient(135deg, ${C.amber}, ${C.orange})`,
        boxShadow:
          "0 14px 36px rgba(232,134,12,0.20), 0 4px 12px rgba(212,74,26,0.10)",
      }}
    >
      <div
        style={{
          backgroundColor: C.amberLight,
          borderRadius: 16,
          padding: "20px clamp(20px, 3vw, 28px)",
          display: "flex",
          alignItems: "center",
          gap: 18,
          flexWrap: "wrap",
        }}
      >
        <div
          aria-hidden
          style={{
            width: 52,
            height: 52,
            borderRadius: 14,
            background: brandGradient,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            boxShadow: "0 8px 20px rgba(232,134,12,0.32)",
          }}
        >
          <Send size={20} color="#fff" strokeWidth={2.4} />
        </div>
        <div style={{ flex: 1, minWidth: 220 }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 800,
              color: C.amberDark,
              letterSpacing: 1.4,
              textTransform: "uppercase",
              marginBottom: 6,
            }}
          >
            Last step
          </div>
          <div
            style={{
              fontSize: 17,
              fontWeight: 700,
              color: C.text,
              lineHeight: 1.35,
              margin: 0,
            }}
          >
            Click{" "}
            <span
              style={{
                background: brandGradient,
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
                fontWeight: 800,
              }}
            >
              Send from DonorLume
            </span>{" "}
            on any draft below to start tracking opens, clicks, and replies.
          </div>
        </div>
      </div>
    </div>
  );
}
