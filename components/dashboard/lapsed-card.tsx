import Link from "next/link";
import { RefreshCw, Upload } from "lucide-react";
import type { Donor } from "@prisma/client";

import { C, brandGradient, shadow } from "@/lib/design";
import { fmt } from "@/lib/format";
import { ScoreRing } from "@/components/score-ring";
import { TierBadge } from "@/components/tier-badge";

type Props = {
  donors: Donor[];
  total: number;
};

const dateFmt = new Intl.DateTimeFormat("en-US", {
  month: "short",
  year: "numeric",
});

export function LapsedCard({ donors, total }: Props) {
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
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "20px 26px",
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
          <RefreshCw size={18} color={C.orange} /> Top Reactivation Candidates
        </h3>
        <Link
          href="/lapsed"
          style={{
            fontSize: 13,
            padding: "8px 18px",
            borderRadius: 10,
            background: brandGradient,
            color: "#fff",
            fontWeight: 700,
            textDecoration: "none",
          }}
        >
          {total > 0 ? "View All" : "Upload CSV"}
        </Link>
      </div>
      <div style={{ borderTop: `1px solid ${C.border}` }}>
        {total === 0 ? (
          <div style={{ padding: "40px 26px", textAlign: "center" }}>
            <Upload
              size={32}
              color={C.textTertiary}
              style={{ marginBottom: 12, opacity: 0.4 }}
            />
            <p
              style={{
                color: C.textTertiary,
                fontSize: 14,
                margin: 0,
              }}
            >
              Upload a donor CSV to score lapsed donors and find who to
              re-engage first.
            </p>
          </div>
        ) : (
          donors.map((d, i) => (
            <div
              key={d.id}
              style={{
                padding: "14px 26px",
                borderBottom:
                  i < donors.length - 1
                    ? `1px solid ${C.borderSubtle}`
                    : "none",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div>
                <div style={{ fontSize: 15, fontWeight: 600 }}>{d.name}</div>
                <div
                  style={{
                    fontSize: 12,
                    color: C.textTertiary,
                    marginTop: 2,
                  }}
                >
                  Last gift: {d.lastGiftDate ? dateFmt.format(d.lastGiftDate) : "—"}
                  {d.totalGiven != null && ` · ${fmt(d.totalGiven)}`}
                </div>
              </div>
              <div
                style={{ display: "flex", alignItems: "center", gap: 10 }}
              >
                <ScoreRing score={d.reactivationScore ?? 0} size={38} />
                <TierBadge tier={d.tier} />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
