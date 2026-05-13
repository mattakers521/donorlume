"use client";

import { C, brandGradient } from "@/lib/design";
import { StarburstLogo } from "@/components/starburst-logo";

type Props = {
  current: number;
  total: number;
};

export function OutreachProgress({ current, total }: Props) {
  const pct = total > 0 ? (current / total) * 100 : 0;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: 500,
      }}
    >
      <div style={{ textAlign: "center", maxWidth: 400, width: "100%" }}>
        <div
          style={{
            margin: "0 auto 28px",
            display: "flex",
            justifyContent: "center",
          }}
        >
          <StarburstLogo size={80} idKey="outreach-progress" />
        </div>
        <h2
          style={{
            fontSize: 24,
            fontWeight: 400,
            margin: 0,
            fontFamily: "var(--font-instrument-serif), Georgia, serif",
          }}
        >
          Crafting your outreach
        </h2>
        <p style={{ fontSize: 15, color: C.textSecondary, marginTop: 10 }}>
          Email {current} of {total}…
        </p>
        <div
          style={{
            marginTop: 28,
            height: 6,
            backgroundColor: C.border,
            borderRadius: 3,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              height: "100%",
              borderRadius: 3,
              background: brandGradient,
              width: `${pct}%`,
              transition: "width 0.4s",
            }}
          />
        </div>
      </div>
    </div>
  );
}
