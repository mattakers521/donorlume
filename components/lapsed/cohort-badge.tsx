"use client";

import type { CohortDefinition } from "@prisma/client";

import { C } from "@/lib/design";

type Props = {
  cohort: Pick<CohortDefinition, "id" | "name" | "color">;
  active?: boolean;
  onClick?: () => void;
  size?: "sm" | "md";
};

/**
 * Cohort pill. Color comes from the cohort's stored hex; text is white
 * on color when active and uses the color tint when inactive — so the
 * filter-bar selected pill looks "lit" vs the row badges.
 */
export function CohortBadge({
  cohort,
  active = false,
  onClick,
  size = "sm",
}: Props) {
  const accent = cohort.color || C.amber;
  const padding = size === "sm" ? "3px 9px" : "5px 12px";
  const fontSize = size === "sm" ? 11 : 12;

  const tint = `${accent}1F`; // ~12% alpha — hex shorthand "1F" ≈ 0.12

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      title={cohort.name}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding,
        borderRadius: 8,
        border: "none",
        fontSize,
        fontWeight: 700,
        backgroundColor: active ? accent : tint,
        color: active ? "#fff" : accent,
        cursor: onClick ? "pointer" : "default",
        whiteSpace: "nowrap",
        fontFamily: "var(--font-jakarta), -apple-system, sans-serif",
        letterSpacing: 0.2,
        lineHeight: 1.2,
      }}
    >
      {cohort.name}
    </button>
  );
}

/** "+N more" overflow chip — neutral coloring. */
export function CohortOverflow({ count }: { count: number }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "3px 9px",
        borderRadius: 8,
        fontSize: 11,
        fontWeight: 700,
        backgroundColor: "#F2F2F7",
        color: C.textTertiary,
        whiteSpace: "nowrap",
        lineHeight: 1.2,
      }}
    >
      +{count} more
    </span>
  );
}
