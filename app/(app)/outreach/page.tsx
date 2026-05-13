import Link from "next/link";
import { ArrowRight, Mail, Plus } from "lucide-react";

import { isInUnpaidTrial } from "@/lib/billing/trial";
import { C, brandGradient, shadow } from "@/lib/design";
import { deriveCampaignMetrics } from "@/lib/outreach/insights";
import { prisma } from "@/lib/prisma";
import { getOrgContext } from "@/lib/with-org";
import { TrialAiCounter } from "@/components/outreach/trial-ai-counter";

export const dynamic = "force-dynamic";

const EMAIL_TYPE_LABEL: Record<string, string> = {
  reactivation: "Reactivation",
  impact_update: "Impact Update",
  event_invite: "Event Invite",
  year_end: "Year-End Appeal",
};

export default async function OutreachListPage() {
  const { org } = await getOrgContext();

  // Trial-cap counter — only fetched + rendered for unpaid-trial orgs.
  const inUnpaidTrial = isInUnpaidTrial({
    trialEndsAt: org.trialEndsAt,
    stripeSubscriptionId: org.stripeSubscriptionId,
  });
  const trialDraftsUsed = inUnpaidTrial
    ? await prisma.outreachDraft.count({
        where: { campaign: { orgId: org.id } },
      })
    : 0;

  const campaigns = await prisma.outreachCampaign.findMany({
    where: { orgId: org.id },
    orderBy: { createdAt: "desc" },
  });

  if (campaigns.length === 0) {
    return (
      <>
        {inUnpaidTrial && <TrialAiCounter used={trialDraftsUsed} />}
        <EmptyState />
      </>
    );
  }

  return (
    <div style={{ maxWidth: 1100 }}>
      {inUnpaidTrial && <TrialAiCounter used={trialDraftsUsed} />}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 24,
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <p
          style={{
            fontSize: 14,
            color: C.textSecondary,
            margin: 0,
          }}
        >
          {campaigns.length} campaign{campaigns.length === 1 ? "" : "s"} ·
          showing newest first
        </p>
        <Link
          href="/outreach/new"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "10px 20px",
            borderRadius: 12,
            background: brandGradient,
            color: "#fff",
            fontSize: 14,
            fontWeight: 700,
            textDecoration: "none",
            boxShadow: shadow.sm,
          }}
        >
          <Plus size={16} /> New Campaign
        </Link>
      </div>

      <div
        style={{
          backgroundColor: C.surface,
          borderRadius: 20,
          boxShadow: shadow.sm,
          overflow: "hidden",
        }}
      >
        {campaigns.map((c, i) => {
          const metrics = deriveCampaignMetrics(c);
          const subtitle = [
            c.campaign?.trim(),
            EMAIL_TYPE_LABEL[c.emailType] ?? c.emailType,
            new Date(c.createdAt).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            }),
          ]
            .filter(Boolean)
            .join(" · ");

          return (
            <Link
              key={c.id}
              href={`/outreach/campaigns/${c.id}`}
              style={{
                display: "block",
                padding: "20px 26px",
                textDecoration: "none",
                color: "inherit",
                borderTop:
                  i > 0 ? `1px solid ${C.borderSubtle}` : "none",
                transition: "background 0.15s",
              }}
              className="campaign-row"
            >
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1.6fr 0.7fr 0.7fr 0.7fr 30px",
                  alignItems: "center",
                  gap: 18,
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 16,
                      fontWeight: 700,
                      color: C.text,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {c.name}
                  </div>
                  {subtitle && (
                    <div
                      style={{
                        fontSize: 12,
                        color: C.textTertiary,
                        marginTop: 2,
                        fontWeight: 500,
                      }}
                    >
                      {subtitle}
                    </div>
                  )}
                </div>

                <Metric
                  label="Sent"
                  value={
                    metrics.sent > 0
                      ? metrics.sent.toLocaleString()
                      : `${c.totalDrafts} draft${c.totalDrafts === 1 ? "" : "s"}`
                  }
                  muted={metrics.sent === 0}
                />
                <Metric
                  label="Open rate"
                  value={metrics.openPct}
                  muted={metrics.sent === 0}
                />
                <Metric
                  label="Click rate"
                  value={metrics.clickPct}
                  muted={metrics.sent === 0}
                />

                <ArrowRight size={16} color={C.textTertiary} />
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  muted = false,
}: {
  label: string;
  value: string;
  muted?: boolean;
}) {
  return (
    <div>
      <div
        style={{
          fontSize: 10,
          fontWeight: 800,
          color: C.textTertiary,
          textTransform: "uppercase",
          letterSpacing: 1,
          marginBottom: 4,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: "var(--font-instrument-serif), Georgia, serif",
          fontSize: 22,
          fontWeight: 400,
          color: muted ? C.textTertiary : C.text,
          letterSpacing: -0.5,
          lineHeight: 1,
        }}
      >
        {value}
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: 480,
        textAlign: "center",
        padding: 40,
      }}
    >
      <div
        style={{
          width: 80,
          height: 80,
          borderRadius: 24,
          backgroundColor: C.amberLight,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 24,
          boxShadow: shadow.glow,
        }}
      >
        <Mail size={36} color={C.amber} />
      </div>
      <h2
        style={{
          fontSize: 26,
          fontWeight: 400,
          margin: 0,
          fontFamily: "var(--font-instrument-serif), Georgia, serif",
        }}
      >
        No campaigns yet.
      </h2>
      <p
        style={{
          fontSize: 16,
          color: C.textSecondary,
          maxWidth: 460,
          marginTop: 14,
          lineHeight: 1.6,
        }}
      >
        Generate your first set of donor outreach emails — pick donors,
        choose a tone, and the AI writes personalized drafts you can edit
        and send from here.
      </p>
      <Link
        href="/outreach/new"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          marginTop: 32,
          padding: "14px 28px",
          borderRadius: 14,
          background: brandGradient,
          color: "#fff",
          fontSize: 15,
          fontWeight: 700,
          textDecoration: "none",
          boxShadow: shadow.md,
        }}
      >
        <Plus size={18} /> New Campaign
      </Link>
    </div>
  );
}
