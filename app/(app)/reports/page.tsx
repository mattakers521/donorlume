import Link from "next/link";
import {
  ArrowUpRight,
  Mail,
  MousePointerClick,
  PieChart,
  Reply,
  Target,
  TrendingUp,
  Users,
} from "lucide-react";

import { C, shadow } from "@/lib/design";
import { fmt } from "@/lib/format";
import { getReportData, parseRange } from "@/lib/reports/data";
import { getOrgContext } from "@/lib/with-org";
import { DateRangeSelector } from "@/components/reports/date-range-selector";
import { ExportButton } from "@/components/reports/export-button";
import { MetricTile } from "@/components/reports/metric-tile";

export const dynamic = "force-dynamic";

const formatPct = (v: number | null): string => {
  if (v === null) return "—";
  return `${(v * 100).toFixed(1)}%`;
};

const formatDate = (d: Date): string =>
  new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(d);

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const { org } = await getOrgContext();
  const params = await searchParams;
  const range = parseRange(params.range);
  const report = await getReportData(org.id, range);

  return (
    <div style={{ maxWidth: 1200 }}>
      {/* ─── Header row ─── */}
      <header
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 16,
          flexWrap: "wrap",
          marginBottom: 28,
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "5px 11px",
              borderRadius: 100,
              background: C.amberLight,
              color: C.amberDark,
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: 1.2,
              textTransform: "uppercase",
              marginBottom: 10,
            }}
          >
            <PieChart size={12} /> Board Report
          </div>
          <h1
            style={{
              fontFamily: "var(--font-instrument-serif), Georgia, serif",
              fontSize: "clamp(28px, 4vw, 36px)",
              fontWeight: 400,
              color: C.text,
              margin: "0 0 6px",
              letterSpacing: -1,
            }}
          >
            {report.orgName} — Fundraising Snapshot
          </h1>
          <p
            style={{
              fontSize: 14,
              color: C.textBody,
              fontWeight: 500,
              margin: 0,
            }}
          >
            {report.rangeLabel} ·{" "}
            <span style={{ color: C.textTertiary }}>
              Generated {formatDate(report.generatedAt)}
            </span>
          </p>
        </div>
        <ExportButton range={range} />
      </header>

      <div style={{ marginBottom: 28 }}>
        <DateRangeSelector current={range} />
      </div>

      {/* ─── Overview metrics ─── */}
      <Section
        title="Overview"
        sub="The six numbers your board will ask about first."
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(170px, 1fr))",
            gap: 14,
          }}
        >
          <MetricTile
            label="Prospects saved"
            value={fmtCount(report.overview.prospectsSaved)}
            sub={
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                <Target size={12} color={C.amber} /> In pipeline
              </span>
            }
          />
          <MetricTile
            label="Donors scored"
            value={fmtCount(report.overview.donorsScored)}
            sub={
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                <Users size={12} color={C.orange} /> Classified
              </span>
            }
          />
          <MetricTile
            label="Outreach sent"
            value={fmtCount(report.overview.outreachSent)}
            sub={
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                <Mail size={12} color={C.purple} /> Emails delivered
              </span>
            }
          />
          <MetricTile
            label="Open rate"
            value={formatPct(report.overview.openRate)}
            accent
            sub="Industry avg ~25%"
          />
          <MetricTile
            label="Click rate"
            value={formatPct(report.overview.clickRate)}
            accent
            sub={
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                <MousePointerClick size={12} color={C.amberDark} /> Of sent
              </span>
            }
          />
          <MetricTile
            label="Donors reactivated"
            value={fmtCount(report.overview.donorsReactivated)}
            accent
            sub={
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                <Reply size={12} color={C.amberDark} /> Replied to outreach
              </span>
            }
          />
        </div>
      </Section>

      {/* ─── Outreach Performance ─── */}
      <Section
        title="Outreach Performance"
        sub={
          report.campaigns.length === 0
            ? "No campaigns in this range yet."
            : "Click any campaign for the full delivery report."
        }
      >
        {report.campaigns.length === 0 ? (
          <EmptyState
            message="Start a campaign from the Outreach Studio to see performance here."
            href="/outreach/new"
            cta="New campaign"
          />
        ) : (
          <div
            style={{
              backgroundColor: C.surface,
              borderRadius: 18,
              boxShadow: shadow.sm,
              border: `1px solid ${C.border}`,
              overflow: "hidden",
            }}
          >
            <div className="app-scroll-x">
              <table
                style={{
                  width: "100%",
                  minWidth: 780,
                  borderCollapse: "collapse",
                }}
              >
                <thead>
                  <tr style={{ backgroundColor: C.bg }}>
                    <Th>Campaign</Th>
                    <Th>Date</Th>
                    <ThRight>Sent</ThRight>
                    <ThRight>Open rate</ThRight>
                    <ThRight>Click rate</ThRight>
                    <ThRight>Reply rate</ThRight>
                    <Th />
                  </tr>
                </thead>
                <tbody>
                  {report.campaigns.map((c) => (
                    <tr
                      key={c.id}
                      style={{
                        borderTop: `1px solid ${C.borderSubtle}`,
                      }}
                    >
                      <Td>
                        <Link
                          href={`/outreach/campaigns/${c.id}`}
                          style={{
                            color: C.text,
                            textDecoration: "none",
                            fontWeight: 700,
                          }}
                        >
                          {c.name}
                        </Link>
                      </Td>
                      <Td>
                        <span style={{ color: C.textSecondary }}>
                          {formatDate(c.createdAt)}
                        </span>
                      </Td>
                      <TdRight>{fmtCount(c.sentCount)}</TdRight>
                      <TdRight>{formatPct(c.openRate)}</TdRight>
                      <TdRight>{formatPct(c.clickRate)}</TdRight>
                      <TdRight>{formatPct(c.replyRate)}</TdRight>
                      <Td>
                        <Link
                          href={`/outreach/campaigns/${c.id}`}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                            color: C.amberDark,
                            fontSize: 12,
                            fontWeight: 700,
                            textDecoration: "none",
                          }}
                        >
                          Open <ArrowUpRight size={12} />
                        </Link>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Section>

      {/* ─── Cohort Health ─── */}
      <Section
        title="Cohort Health"
        sub={
          range === "all_time"
            ? "Trend isn't shown for All Time — every assignment counts as in-range."
            : "Cohorts that took on new members in this range are flagged Growing."
        }
      >
        {report.cohorts.length === 0 ? (
          <EmptyState
            message="Upload a donor list to populate cohort health."
            href="/lapsed"
            cta="Upload donors"
          />
        ) : (
          <div
            style={{
              backgroundColor: C.surface,
              borderRadius: 18,
              boxShadow: shadow.sm,
              border: `1px solid ${C.border}`,
              overflow: "hidden",
            }}
          >
            <div className="app-scroll-x">
              <table
                style={{
                  width: "100%",
                  minWidth: 760,
                  borderCollapse: "collapse",
                }}
              >
                <thead>
                  <tr style={{ backgroundColor: C.bg }}>
                    <Th>Cohort</Th>
                    <ThRight>Members</ThRight>
                    <ThRight>Lifetime value</ThRight>
                    <ThRight>Avg score</ThRight>
                    <ThRight>New in range</ThRight>
                    <ThRight>Trend</ThRight>
                  </tr>
                </thead>
                <tbody>
                  {report.cohorts.map((c) => (
                    <tr
                      key={c.id}
                      style={{
                        borderTop: `1px solid ${C.borderSubtle}`,
                      }}
                    >
                      <Td>
                        <Link
                          href={`/cohorts/${c.slug}`}
                          style={{
                            color: C.text,
                            textDecoration: "none",
                            fontWeight: 700,
                          }}
                        >
                          {c.name}
                        </Link>
                        <div
                          style={{
                            fontSize: 11,
                            color: C.textTertiary,
                            marginTop: 2,
                            textTransform: "uppercase",
                            letterSpacing: 0.6,
                            fontWeight: 700,
                          }}
                        >
                          {familyLabel(c.family)}
                        </div>
                      </Td>
                      <TdRight>{fmtCount(c.memberCount)}</TdRight>
                      <TdRight>{fmt(c.totalLifetimeValue)}</TdRight>
                      <TdRight>
                        {c.averageScore !== null ? c.averageScore : "—"}
                      </TdRight>
                      <TdRight>{fmtCount(c.newMembersInRange)}</TdRight>
                      <TdRight>
                        <TrendChip trend={c.trend} />
                      </TdRight>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Section>

      {/* ─── Prospect Pipeline ─── */}
      <Section
        title="Prospect Pipeline"
        sub="Funnel of saved foundations by stage. Revenue is summed from each prospect's most recent IRS filing."
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 12,
          }}
        >
          {report.pipeline.map((stage) => (
            <PipelineCard key={stage.status} stage={stage} />
          ))}
        </div>
        {report.otherStageCount > 0 && (
          <p
            style={{
              marginTop: 14,
              fontSize: 13,
              color: C.textSecondary,
              fontWeight: 500,
            }}
          >
            + {report.otherStageCount.toLocaleString()} prospect
            {report.otherStageCount === 1 ? "" : "s"} in advanced stages
            (Asked, Committed, Declined, Archived).
          </p>
        )}
      </Section>
    </div>
  );
}

// ─── Subcomponents ─────────────────────────────────────────────────

function Section({
  title,
  sub,
  children,
}: {
  title: string;
  sub?: string;
  children: React.ReactNode;
}) {
  return (
    <section style={{ marginBottom: 40 }}>
      <header
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 16,
          flexWrap: "wrap",
          marginBottom: 14,
        }}
      >
        <h2
          style={{
            fontFamily: "var(--font-instrument-serif), Georgia, serif",
            fontSize: 24,
            fontWeight: 400,
            color: C.text,
            margin: 0,
            letterSpacing: -0.5,
          }}
        >
          {title}
        </h2>
        {sub && (
          <p
            style={{
              fontSize: 13,
              color: C.textSecondary,
              fontWeight: 500,
              margin: 0,
              maxWidth: 480,
              textAlign: "right",
            }}
          >
            {sub}
          </p>
        )}
      </header>
      {children}
    </section>
  );
}

function Th({ children }: { children?: React.ReactNode }) {
  return (
    <th
      style={{
        padding: "14px 18px",
        textAlign: "left",
        fontSize: 11,
        fontWeight: 800,
        color: C.textTertiary,
        textTransform: "uppercase",
        letterSpacing: 1,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </th>
  );
}

function ThRight({ children }: { children?: React.ReactNode }) {
  return (
    <th
      style={{
        padding: "14px 18px",
        textAlign: "right",
        fontSize: 11,
        fontWeight: 800,
        color: C.textTertiary,
        textTransform: "uppercase",
        letterSpacing: 1,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </th>
  );
}

function Td({ children }: { children?: React.ReactNode }) {
  return (
    <td
      style={{
        padding: "14px 18px",
        fontSize: 14,
        color: C.text,
        verticalAlign: "middle",
      }}
    >
      {children}
    </td>
  );
}

function TdRight({ children }: { children?: React.ReactNode }) {
  return (
    <td
      style={{
        padding: "14px 18px",
        fontSize: 14,
        color: C.text,
        textAlign: "right",
        fontVariantNumeric: "tabular-nums",
        whiteSpace: "nowrap",
        fontWeight: 600,
      }}
    >
      {children}
    </td>
  );
}

function TrendChip({ trend }: { trend: "growing" | "stable" | "n/a" }) {
  if (trend === "growing") {
    return (
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
          padding: "4px 10px",
          borderRadius: 100,
          background: "rgba(52,199,89,0.12)",
          color: "#1B5E20",
          fontSize: 11,
          fontWeight: 800,
          letterSpacing: 0.6,
          textTransform: "uppercase",
        }}
      >
        <TrendingUp size={11} /> Growing
      </span>
    );
  }
  if (trend === "stable") {
    return (
      <span
        style={{
          padding: "4px 10px",
          borderRadius: 100,
          background: C.surfaceHover,
          color: C.textSecondary,
          fontSize: 11,
          fontWeight: 800,
          letterSpacing: 0.6,
          textTransform: "uppercase",
        }}
      >
        Stable
      </span>
    );
  }
  return (
    <span
      style={{
        color: C.textTertiary,
        fontSize: 13,
        fontWeight: 600,
      }}
    >
      —
    </span>
  );
}

function PipelineCard({
  stage,
}: {
  stage: {
    label: string;
    count: number;
    totalRevenue: number;
  };
}) {
  const empty = stage.count === 0;
  return (
    <div
      style={{
        padding: 18,
        borderRadius: 16,
        backgroundColor: empty ? C.bg : C.surface,
        border: empty
          ? `1px solid ${C.border}`
          : `1px solid rgba(232,134,12,0.18)`,
        boxShadow: empty ? "none" : shadow.sm,
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 800,
          color: empty ? C.textTertiary : C.amberDark,
          letterSpacing: 1.2,
          textTransform: "uppercase",
          marginBottom: 8,
        }}
      >
        {stage.label}
      </div>
      <div
        style={{
          fontFamily: "var(--font-instrument-serif), Georgia, serif",
          fontSize: 30,
          color: empty ? C.textTertiary : C.text,
          letterSpacing: -0.6,
          lineHeight: 1,
          marginBottom: 6,
        }}
      >
        {fmtCount(stage.count)}
      </div>
      <div
        style={{
          fontSize: 12.5,
          color: C.textBody,
          fontWeight: 600,
        }}
      >
        {stage.totalRevenue > 0
          ? `${fmt(stage.totalRevenue)} revenue`
          : "—"}
      </div>
    </div>
  );
}

function EmptyState({
  message,
  href,
  cta,
}: {
  message: string;
  href: string;
  cta: string;
}) {
  return (
    <div
      style={{
        padding: "32px 24px",
        borderRadius: 18,
        backgroundColor: C.surface,
        border: `1px dashed ${C.border}`,
        textAlign: "center",
      }}
    >
      <p
        style={{
          margin: "0 0 14px",
          color: C.textBody,
          fontSize: 14,
          fontWeight: 500,
        }}
      >
        {message}
      </p>
      <Link
        href={href}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          padding: "8px 16px",
          borderRadius: 10,
          background: `linear-gradient(135deg, ${C.amber}, ${C.orange})`,
          color: "#fff",
          fontSize: 13,
          fontWeight: 700,
          textDecoration: "none",
        }}
      >
        {cta} <ArrowUpRight size={13} />
      </Link>
    </div>
  );
}

// ─── helpers ───────────────────────────────────────────────────────

function fmtCount(n: number): string {
  return n.toLocaleString("en-US");
}

const FAMILY_LABELS: Record<string, string> = {
  GIVING_BEHAVIOR: "Giving behavior",
  ENTITY_TYPE: "Entity type",
  ENGAGEMENT: "Engagement",
  TRAJECTORY: "Trajectory",
  CUSTOM: "Custom",
};
function familyLabel(family: string): string {
  return FAMILY_LABELS[family] ?? family;
}
