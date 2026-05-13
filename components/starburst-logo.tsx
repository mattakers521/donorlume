/**
 * 16-ray radial-gradient starburst — DonorLume's brand mark.
 * Ported verbatim from `donorluma-app.jsx:72`.
 *
 * Each instance has its own SVG <defs> ids suffixed with a stable key
 * so multiple sizes can render on the same page without filter-id
 * collisions.
 */
type Props = {
  size?: number;
  /** Stable suffix for SVG defs ids (must be unique per logo on a page). */
  idKey?: string;
};

export function StarburstLogo({ size = 32, idKey = "default" }: Props) {
  const rays = 16;
  const cx = 50;
  const cy = 50;
  const gradId = `starGrad-${idKey}`;
  const filterId = `starGlow-${idKey}`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      style={{ display: "block" }}
      aria-hidden="true"
    >
      <defs>
        <radialGradient id={gradId} cx="50%" cy="50%">
          <stop offset="0%" stopColor="#F5B731" />
          <stop offset="40%" stopColor="#E8860C" />
          <stop offset="70%" stopColor="#D44A1A" />
          <stop offset="100%" stopColor="#B83A15" />
        </radialGradient>
        <filter id={filterId}>
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>
      <g filter={`url(#${filterId})`}>
        {Array.from({ length: rays }).map((_, i) => {
          const angle = (i / rays) * Math.PI * 2 - Math.PI / 2;
          const innerR = i % 2 === 0 ? 12 : 16;
          const outerR = i % 2 === 0 ? 38 : 30;
          const spread = (Math.PI / rays) * 0.45;
          const x1 = cx + Math.cos(angle - spread) * innerR;
          const y1 = cy + Math.sin(angle - spread) * innerR;
          const x2 = cx + Math.cos(angle) * outerR;
          const y2 = cy + Math.sin(angle) * outerR;
          const x3 = cx + Math.cos(angle + spread) * innerR;
          const y3 = cy + Math.sin(angle + spread) * innerR;
          return (
            <polygon
              key={i}
              points={`${cx},${cy} ${x1},${y1} ${x2},${y2} ${x3},${y3}`}
              fill={`url(#${gradId})`}
              opacity={0.85 + (i % 3) * 0.05}
            />
          );
        })}
        <circle cx={cx} cy={cy} r={5} fill="#F5B731" />
        <circle cx={cx} cy={cy} r={2.5} fill="#FFDD70" />
      </g>
    </svg>
  );
}
