"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { C, shadow } from "@/lib/design";
import { fmt } from "@/lib/format";
import type { CohortInsight } from "@/lib/cohorts/insights";

type Props = { insight: CohortInsight };

/**
 * Card on the /cohorts grid. Tinted left border + swatch in the brand
 * colour assigned to the cohort. Big serif member count. Three small
 * stats below: total lifetime value, avg score, lapsed share.
 */
export function CohortCard({ insight }: Props) {
  const { cohort, memberCount, totalLifetimeValue, averageScore, lapsedShare } =
    insight;
  const accent = cohort.color || C.amber;
  const empty = memberCount === 0;

  return (
    <Link
      href={`/cohorts/${cohort.slug}`}
      style={{
        display: "block",
        textDecoration: "none",
        color: "inherit",
      }}
    >
      <div
        style={{
          backgroundColor: C.surface,
          borderRadius: 18,
          padding: "22px 22px 18px",
          boxShadow: shadow.sm,
          borderLeft: `4px solid ${accent}`,
          opacity: empty ? 0.55 : 1,
          transition: "box-shadow 0.2s, transform 0.2s",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
        onMouseEnter={(e) => {
          if (!empty) {
            e.currentTarget.style.boxShadow = shadow.md;
            e.currentTarget.style.transform = "translateY(-2px)";
          }
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.boxShadow = shadow.sm;
          e.currentTarget.style.transform = "none";
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <span
            aria-hidden
            style={{
              width: 10,
              height: 10,
              borderRadius: 3,
              backgroundColor: accent,
              flexShrink: 0,
            }}
          />
          <div
            style={{
              fontSize: 15,
              fontWeight: 700,
              color: C.text,
              lineHeight: 1.25,
            }}
          >
            {cohort.name}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            gap: 8,
          }}
        >
          <span
            style={{
              fontFamily: "var(--font-instrument-serif), Georgia, serif",
              fontSize: 38,
              fontWeight: 400,
              letterSpacing: -1.5,
              color: C.text,
              lineHeight: 1,
            }}
          >
            {memberCount.toLocaleString()}
          </span>
          <span
            style={{
              fontSize: 13,
              color: C.textTertiary,
              fontWeight: 600,
            }}
          >
            {memberCount === 1 ? "donor" : "donors"}
          </span>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr",
            gap: 12,
            paddingTop: 6,
            borderTop: `1px solid ${C.borderSubtle}`,
          }}
        >
          <Stat label="Lifetime" value={fmt(totalLifetimeValue || null)} />
          <Stat
            label="Avg score"
            value={averageScore != null ? String(averageScore) : "—"}
          />
          <Stat
            label="Lapsed"
            value={
              memberCount > 0
                ? `${Math.round(lapsedShare * 100)}%`
                : "—"
            }
          />
        </div>

        {!empty && (
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: accent,
              display: "flex",
              alignItems: "center",
              gap: 4,
              marginTop: -2,
            }}
          >
            View members <ArrowRight size={12} />
          </div>
        )}
      </div>
    </Link>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div
        style={{
          fontSize: 10,
          fontWeight: 800,
          color: C.textTertiary,
          textTransform: "uppercase",
          letterSpacing: 1,
          marginBottom: 4,
          whiteSpace: "nowrap",
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 14,
          fontWeight: 700,
          color: C.text,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {value}
      </div>
    </div>
  );
}
