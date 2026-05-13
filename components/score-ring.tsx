import { C } from "@/lib/design";

type Props = {
  score: number;
  size?: number;
};

/** Animated radial score ring — port of `ScoreRing` from donorluma-app.jsx:111. */
export function ScoreRing({ score, size = 42 }: Props) {
  const r = (size - 5) / 2;
  const circ = 2 * Math.PI * r;
  const color =
    score >= 80
      ? C.green
      : score >= 55
        ? C.amber
        : score >= 30
          ? C.orange
          : C.textTertiary;
  return (
    <div style={{ position: "relative", width: size, height: size }}>
      <svg
        width={size}
        height={size}
        style={{ transform: "rotate(-90deg)" }}
        aria-hidden="true"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={C.border}
          strokeWidth={2.5}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={2.5}
          strokeDasharray={circ}
          strokeDashoffset={circ - (score / 100) * circ}
          strokeLinecap="round"
          style={{
            transition: "stroke-dashoffset 0.8s cubic-bezier(0.4,0,0.2,1)",
          }}
        />
      </svg>
      <span
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 12,
          fontWeight: 700,
          color,
        }}
      >
        {score}
      </span>
    </div>
  );
}
