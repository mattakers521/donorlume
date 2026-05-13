import { C, shadow } from "@/lib/design";
import type {
  CampaignMetrics,
  CohortBreakdownRow,
} from "@/lib/outreach/insights";

type Props = {
  rows: CohortBreakdownRow[];
  campaignMetrics: CampaignMetrics;
};

const VISIBLE = 6;

/**
 * Spec §7 "Cohort breakdown". Shows per-cohort open/click rates next to
 * the campaign-wide averages so the user can see which cohorts
 * outperformed.
 *
 * Empty result (no sent drafts had cohort-linked donors) renders nothing
 * — the page composition decides whether to surface a "no cohorts in
 * this campaign" hint.
 */
export function CampaignCohortBreakdown({ rows, campaignMetrics }: Props) {
  if (rows.length === 0) return null;

  const visible = rows.slice(0, VISIBLE);
  const overflow = rows.length - visible.length;

  return (
    <section
      style={{
        backgroundColor: C.surface,
        borderRadius: 20,
        boxShadow: shadow.sm,
        padding: "22px 26px 18px",
        marginBottom: 28,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          marginBottom: 18,
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <h3
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: C.textSecondary,
            margin: 0,
          }}
        >
          Performance by cohort
        </h3>
        <span
          style={{
            fontSize: 11,
            color: C.textTertiary,
            fontWeight: 600,
          }}
        >
          Campaign average: {campaignMetrics.openPct} opens ·{" "}
          {campaignMetrics.clickPct} clicks
        </span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {visible.map((r) => (
          <Row
            key={r.cohortId}
            row={r}
            campaignOpenRate={campaignMetrics.openRate}
            campaignClickRate={campaignMetrics.clickRate}
          />
        ))}
        {overflow > 0 && (
          <p
            style={{
              fontSize: 12,
              color: C.textTertiary,
              margin: "6px 0 0",
              textAlign: "center",
            }}
          >
            + {overflow} more cohort{overflow === 1 ? "" : "s"} (sort by send
            volume — least-shipped omitted)
          </p>
        )}
      </div>
    </section>
  );
}

function Row({
  row,
  campaignOpenRate,
  campaignClickRate,
}: {
  row: CohortBreakdownRow;
  campaignOpenRate: number;
  campaignClickRate: number;
}) {
  const accent = row.cohortColor || C.amber;
  const openLift = row.openRate - campaignOpenRate;
  const clickLift = row.clickRate - campaignClickRate;

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(180px, 1.4fr) 80px 1fr 1fr",
        alignItems: "center",
        gap: 14,
        padding: "10px 12px",
        borderRadius: 12,
        backgroundColor: C.bg,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          minWidth: 0,
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
        <span
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: C.text,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {row.cohortName}
        </span>
      </div>
      <span style={{ fontSize: 13, color: C.textSecondary }}>
        {row.sent} sent
      </span>
      <RateCell label="Open" pct={row.openPct} lift={openLift} />
      <RateCell label="Click" pct={row.clickPct} lift={clickLift} />
    </div>
  );
}

function RateCell({
  label,
  pct,
  lift,
}: {
  label: string;
  pct: string;
  lift: number;
}) {
  const sigLift = Math.abs(lift) >= 0.01; // hide noise < 1pp
  const liftLabel = sigLift
    ? `${lift > 0 ? "+" : ""}${Math.round(lift * 100)}pp`
    : null;
  const liftColor = lift > 0 ? "#1B7A3D" : C.orange;

  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
      <span style={{ fontSize: 11, color: C.textTertiary, fontWeight: 600 }}>
        {label}
      </span>
      <span
        style={{
          fontFamily: "var(--font-instrument-serif), Georgia, serif",
          fontSize: 18,
          fontWeight: 400,
          color: C.text,
          letterSpacing: -0.5,
          lineHeight: 1,
        }}
      >
        {pct}
      </span>
      {liftLabel && (
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: liftColor,
          }}
        >
          {liftLabel}
        </span>
      )}
    </div>
  );
}
