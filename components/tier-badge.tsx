import { C } from "@/lib/design";

type Props = {
  tier: string | null | undefined;
};

const TIER_STYLES: Record<string, { color: string; bg: string }> = {
  High: { color: "#1B7A3D", bg: C.greenLight },
  Medium: { color: C.amberDark, bg: C.amberLight },
  Low: { color: C.orange, bg: C.orangeLight },
  Cold: { color: C.textTertiary, bg: "#F2F2F7" },
};

/** Tier pill — port of `TierBadge` from donorluma-app.jsx:126. */
export function TierBadge({ tier }: Props) {
  const key = tier && TIER_STYLES[tier] ? tier : "Cold";
  const style = TIER_STYLES[key];
  return (
    <span
      style={{
        padding: "4px 12px",
        borderRadius: 100,
        fontSize: 11,
        fontWeight: 700,
        color: style.color,
        backgroundColor: style.bg,
        letterSpacing: 0.5,
        textTransform: "uppercase",
      }}
    >
      {key}
    </span>
  );
}
