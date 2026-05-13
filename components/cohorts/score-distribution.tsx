import { C } from "@/lib/design";

type Props = {
  tierCounts: {
    High: number;
    Medium: number;
    Low: number;
    Cold: number;
    Unscored: number;
  };
};

const TIERS = [
  { key: "High" as const, label: "High", color: C.green },
  { key: "Medium" as const, label: "Medium", color: C.amber },
  { key: "Low" as const, label: "Low", color: C.orange },
  { key: "Cold" as const, label: "Cold", color: C.textTertiary },
];

/**
 * Lightweight 4-bar histogram of reactivation-score tiers across the
 * cohort. Heights scale to the largest bucket. Unscored donors are
 * shown as a faint footnote count below.
 */
export function ScoreDistribution({ tierCounts }: Props) {
  const maxCount = Math.max(
    tierCounts.High,
    tierCounts.Medium,
    tierCounts.Low,
    tierCounts.Cold,
    1, // never divide by zero
  );

  return (
    <div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 16,
          alignItems: "end",
          height: 140,
          marginBottom: 14,
        }}
      >
        {TIERS.map((t) => {
          const count = tierCounts[t.key];
          // Floor of 4% so empty buckets still render a sliver.
          const heightPct = Math.max(4, (count / maxCount) * 100);
          return (
            <div
              key={t.key}
              style={{ display: "flex", flexDirection: "column", height: "100%" }}
            >
              <div
                style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "flex-end",
                }}
              >
                <div
                  title={`${t.label}: ${count}`}
                  style={{
                    height: `${heightPct}%`,
                    background: `linear-gradient(180deg, ${t.color}33, ${t.color})`,
                    borderRadius: 10,
                    minHeight: 8,
                    transition: "height 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 16,
        }}
      >
        {TIERS.map((t) => (
          <div key={t.key} style={{ textAlign: "left" }}>
            <div
              style={{
                fontSize: 18,
                fontWeight: 800,
                color: C.text,
                lineHeight: 1,
              }}
            >
              {tierCounts[t.key].toLocaleString()}
            </div>
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: t.color,
                textTransform: "uppercase",
                letterSpacing: 1,
                marginTop: 4,
              }}
            >
              {t.label}
            </div>
          </div>
        ))}
      </div>
      {tierCounts.Unscored > 0 && (
        <div
          style={{
            marginTop: 12,
            fontSize: 12,
            color: C.textTertiary,
          }}
        >
          {tierCounts.Unscored.toLocaleString()} unscored
        </div>
      )}
    </div>
  );
}
