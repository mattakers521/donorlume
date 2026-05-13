"use client";

import Link from "next/link";
import { ChevronRight, Layers } from "lucide-react";

import { C, shadow } from "@/lib/design";
import { fmt } from "@/lib/format";
import type { CohortInsight } from "@/lib/cohorts/insights";

type Props = {
  /** Top-N cohort insights, already sorted by member count desc. */
  topCohorts: CohortInsight[];
};

/**
 * Dashboard cohort widget — Spec §5.6. Top 5 cohorts by size, each row
 * clickable into the cohort detail page.
 */
export function CohortSnapshot({ topCohorts }: Props) {
  return (
    <div
      style={{
        backgroundColor: C.surface,
        borderRadius: 20,
        boxShadow: shadow.sm,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          padding: "20px 24px 16px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <h3
          style={{
            fontSize: 17,
            fontWeight: 700,
            margin: 0,
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <Layers size={18} color={C.amber} /> Cohort Snapshot
        </h3>
        <Link
          href="/cohorts"
          style={{
            fontSize: 12,
            color: C.amber,
            fontWeight: 700,
            textDecoration: "none",
            display: "inline-flex",
            alignItems: "center",
            gap: 2,
          }}
        >
          See all <ChevronRight size={12} />
        </Link>
      </div>

      {topCohorts.length === 0 ? (
        <div
          style={{
            padding: "20px 24px 28px",
            fontSize: 13,
            color: C.textTertiary,
            borderTop: `1px solid ${C.borderSubtle}`,
            lineHeight: 1.6,
          }}
        >
          Upload a donor list to see cohorts here.
        </div>
      ) : (
        <div style={{ borderTop: `1px solid ${C.borderSubtle}` }}>
          {topCohorts.map((insight, i) => {
            const c = insight.cohort;
            const accent = c.color || C.amber;
            return (
              <Link
                key={c.id}
                href={`/cohorts/${c.slug}`}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "12px 24px",
                  textDecoration: "none",
                  color: "inherit",
                  borderTop:
                    i > 0 ? `1px solid ${C.borderSubtle}` : "none",
                  transition: "background 0.15s",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = C.surfaceHover;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "transparent";
                }}
              >
                <span
                  aria-hidden
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 2,
                    backgroundColor: accent,
                    flexShrink: 0,
                  }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 600,
                      color: C.text,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {c.name}
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      color: C.textTertiary,
                      marginTop: 2,
                      fontWeight: 500,
                    }}
                  >
                    {fmt(insight.totalLifetimeValue || null)} lifetime
                  </div>
                </div>
                <div
                  style={{
                    fontSize: 22,
                    fontWeight: 400,
                    color: C.text,
                    fontFamily:
                      "var(--font-instrument-serif), Georgia, serif",
                    letterSpacing: -0.5,
                    lineHeight: 1,
                  }}
                >
                  {insight.memberCount.toLocaleString()}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
