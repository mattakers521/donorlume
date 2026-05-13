import type { ReactNode } from "react";

import { C, shadow } from "@/lib/design";

type Props = {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  /** Adds a subtle amber-tinted background to highlight headline metrics. */
  accent?: boolean;
};

/**
 * Single KPI tile for the report overview row. Matches the dashboard's
 * KpiCard visual rhythm (serif value, uppercase label) but tightens the
 * padding since the report packs six tiles in one row.
 */
export function MetricTile({ label, value, sub, accent }: Props) {
  return (
    <div
      style={{
        backgroundColor: accent ? C.amberLight : C.surface,
        border: accent
          ? `1px solid rgba(232,134,12,0.25)`
          : `1px solid ${C.border}`,
        borderRadius: 18,
        padding: 20,
        boxShadow: shadow.sm,
        display: "flex",
        flexDirection: "column",
        gap: 6,
        minWidth: 0,
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 800,
          color: accent ? C.amberDark : C.textTertiary,
          letterSpacing: 1.2,
          textTransform: "uppercase",
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: "var(--font-instrument-serif), Georgia, serif",
          fontSize: "clamp(26px, 3.2vw, 34px)",
          color: C.text,
          letterSpacing: -0.8,
          lineHeight: 1.05,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {value}
      </div>
      {sub && (
        <div
          style={{
            fontSize: 12.5,
            color: C.textBody,
            fontWeight: 500,
          }}
        >
          {sub}
        </div>
      )}
    </div>
  );
}
