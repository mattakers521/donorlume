import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Mail } from "lucide-react";

import { C, brandGradient, shadow } from "@/lib/design";
import { fmt } from "@/lib/format";
import { getCohortBySlug } from "@/lib/cohorts/insights";
import { getOrgContext } from "@/lib/with-org";
import { CohortMemberTable } from "@/components/cohorts/cohort-member-table";
import { ExportCohortButton } from "@/components/cohorts/export-cohort-button";
import { ScoreDistribution } from "@/components/cohorts/score-distribution";

export const dynamic = "force-dynamic";

export default async function CohortDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { org } = await getOrgContext();

  const result = await getCohortBySlug(org.id, slug);
  if (!result) notFound();

  const { insight, donors } = result;
  const { cohort, memberCount, totalLifetimeValue, averageGift, averageScore, lapsedShare, tierCounts } = insight;
  const accent = cohort.color || C.amber;

  return (
    <div style={{ maxWidth: 1200 }}>
      <Link
        href="/cohorts"
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
        <ChevronLeft size={18} /> All cohorts
      </Link>

      {/* Header card */}
      <div
        style={{
          backgroundColor: C.surface,
          borderRadius: 24,
          boxShadow: shadow.md,
          padding: "28px 32px",
          marginBottom: 24,
          borderLeft: `4px solid ${accent}`,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            flexWrap: "wrap",
            gap: 16,
            marginBottom: 14,
          }}
        >
          <div style={{ flex: 1, minWidth: 260 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                marginBottom: 10,
              }}
            >
              <span
                aria-hidden
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: 3,
                  backgroundColor: accent,
                }}
              />
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  color: accent,
                  textTransform: "uppercase",
                  letterSpacing: 1.4,
                }}
              >
                {cohort.family.replace("_", " ")}
              </span>
            </div>
            <h2
              style={{
                fontFamily: "var(--font-instrument-serif), Georgia, serif",
                fontSize: 30,
                fontWeight: 400,
                margin: "0 0 8px",
                color: C.text,
                letterSpacing: -0.8,
                lineHeight: 1.15,
              }}
            >
              {cohort.name}
            </h2>
            {cohort.description && (
              <p
                style={{
                  fontSize: 14,
                  color: C.textSecondary,
                  margin: 0,
                  lineHeight: 1.6,
                  maxWidth: 720,
                }}
              >
                {cohort.description}
              </p>
            )}
          </div>

          <div style={{ display: "flex", gap: 10, flexShrink: 0 }}>
            <ExportCohortButton
              cohortSlug={cohort.slug}
              cohortName={cohort.name}
              donors={donors}
            />
            {memberCount > 0 && (
              <Link
                href={`/outreach/new?cohort=${encodeURIComponent(cohort.slug)}`}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "10px 18px",
                  borderRadius: 12,
                  background: brandGradient,
                  color: "#fff",
                  fontSize: 13,
                  fontWeight: 700,
                  textDecoration: "none",
                  boxShadow: shadow.sm,
                }}
              >
                <Mail size={14} /> Generate outreach
              </Link>
            )}
          </div>
        </div>

        {/* Key stats row */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 24,
            paddingTop: 22,
            borderTop: `1px solid ${C.borderSubtle}`,
          }}
        >
          <HeaderStat label="Members" value={memberCount.toLocaleString()} />
          <HeaderStat
            label="Lifetime value"
            value={fmt(totalLifetimeValue || null)}
          />
          <HeaderStat
            label="Avg gift"
            value={fmt(averageGift)}
          />
          <HeaderStat
            label="Avg score"
            value={averageScore != null ? `${averageScore}/100` : "—"}
          />
        </div>
      </div>

      {memberCount === 0 ? (
        <div
          style={{
            backgroundColor: C.surface,
            borderRadius: 20,
            boxShadow: shadow.sm,
            padding: 56,
            textAlign: "center",
            color: C.textTertiary,
            fontSize: 14,
          }}
        >
          No donors are currently in this cohort. Upload more donor data or
          adjust your CSV column mappings.
        </div>
      ) : (
        <>
          {/* Distribution + lapsed share row */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "2fr 1fr",
              gap: 20,
              marginBottom: 24,
            }}
            className="cohort-detail-row"
          >
            <div
              style={{
                backgroundColor: C.surface,
                borderRadius: 20,
                boxShadow: shadow.sm,
                padding: "22px 26px",
              }}
            >
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: C.textSecondary,
                  marginBottom: 18,
                }}
              >
                Reactivation-score distribution
              </div>
              <ScoreDistribution tierCounts={tierCounts} />
            </div>

            <div
              style={{
                backgroundColor: C.surface,
                borderRadius: 20,
                boxShadow: shadow.sm,
                padding: "22px 26px",
              }}
            >
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: C.textSecondary,
                  marginBottom: 18,
                }}
              >
                Lapsed share
              </div>
              <div
                style={{
                  fontFamily: "var(--font-instrument-serif), Georgia, serif",
                  fontSize: 56,
                  fontWeight: 400,
                  letterSpacing: -2,
                  color: C.text,
                  lineHeight: 1,
                  marginBottom: 10,
                }}
              >
                {Math.round(lapsedShare * 100)}%
              </div>
              <p
                style={{
                  fontSize: 13,
                  color: C.textTertiary,
                  margin: 0,
                  lineHeight: 1.6,
                }}
              >
                {Math.round(lapsedShare * memberCount).toLocaleString()} of{" "}
                {memberCount.toLocaleString()} members have lapsed at the
                org&rsquo;s current threshold.
              </p>
            </div>
          </div>

          <CohortMemberTable donors={donors} />
        </>
      )}
    </div>
  );
}

function HeaderStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div
        style={{
          fontSize: 11,
          fontWeight: 800,
          color: C.textTertiary,
          textTransform: "uppercase",
          letterSpacing: 1.2,
          marginBottom: 6,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: "var(--font-instrument-serif), Georgia, serif",
          fontSize: 26,
          fontWeight: 400,
          color: C.text,
          letterSpacing: -1,
          lineHeight: 1,
        }}
      >
        {value}
      </div>
    </div>
  );
}
