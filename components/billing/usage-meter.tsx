import { C } from "@/lib/design";

type Props = {
  label: string;
  current: number;
  /** `null` means unlimited — meter renders as a full amber bar. */
  limit: number | null;
};

/**
 * Small bordered card showing a single usage dimension.
 * - With a finite limit: shows "X / Y" + a proportional bar that turns
 *   amber → orange → red as the percentage climbs.
 * - With a null limit (unlimited): shows just "X" + a flat full-amber bar.
 */
export function UsageMeter({ label, current, limit }: Props) {
  const pct =
    limit === null ? 1 : Math.min(1, current / Math.max(1, limit));
  const color =
    limit === null
      ? C.amber
      : pct >= 0.9
        ? C.red
        : pct >= 0.7
          ? C.orange
          : C.amber;

  return (
    <div
      style={{
        backgroundColor: C.bg,
        borderRadius: 14,
        padding: 16,
        border: `1px solid ${C.border}`,
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 800,
          color: C.textTertiary,
          letterSpacing: 1.2,
          textTransform: "uppercase",
          marginBottom: 8,
        }}
      >
        {label}
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: 6,
          marginBottom: 10,
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-instrument-serif), Georgia, serif",
            fontSize: 26,
            color: C.text,
            letterSpacing: -0.5,
            lineHeight: 1,
          }}
        >
          {current.toLocaleString()}
        </span>
        <span
          style={{
            fontSize: 13,
            color: C.textSecondary,
            fontWeight: 600,
          }}
        >
          {limit === null ? "/ unlimited" : `/ ${limit.toLocaleString()}`}
        </span>
      </div>
      <div
        style={{
          height: 6,
          borderRadius: 100,
          backgroundColor: "rgba(0,0,0,0.06)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${pct * 100}%`,
            height: "100%",
            background:
              color === C.amber
                ? `linear-gradient(90deg, ${C.amber}, ${C.orange})`
                : color,
            transition: "width 0.4s ease",
          }}
        />
      </div>
    </div>
  );
}
