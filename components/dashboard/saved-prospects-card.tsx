import Link from "next/link";
import { Building2, Target } from "lucide-react";
import type { Prospect } from "@prisma/client";

import { C, brandGradient, shadow } from "@/lib/design";
import { fmt } from "@/lib/format";

type Props = {
  prospects: Prospect[];
  total: number;
};

export function SavedProspectsCard({ prospects, total }: Props) {
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
          <Target size={18} color={C.amber} /> Saved Prospects
        </h3>
        <Link
          href="/discover"
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
          {total > 0 ? "View All" : "Search"}
        </Link>
      </div>
      <div style={{ borderTop: `1px solid ${C.border}` }}>
        {total === 0 ? (
          <div style={{ padding: "40px 26px", textAlign: "center" }}>
            <Building2
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
              Search IRS 990 filings to discover foundations aligned with your
              mission.
            </p>
          </div>
        ) : (
          prospects.map((p, i) => (
            <div
              key={p.id}
              style={{
                padding: "14px 26px",
                borderBottom:
                  i < prospects.length - 1
                    ? `1px solid ${C.borderSubtle}`
                    : "none",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div>
                <div style={{ fontSize: 15, fontWeight: 600 }}>{p.name}</div>
                {p.city && (
                  <div
                    style={{
                      fontSize: 12,
                      color: C.textTertiary,
                      marginTop: 2,
                    }}
                  >
                    {p.city}
                    {p.state ? `, ${p.state}` : ""}
                  </div>
                )}
              </div>
              {p.revenue != null && (
                <span
                  style={{
                    fontSize: 14,
                    fontWeight: 700,
                    color: C.amber,
                  }}
                >
                  {fmt(p.revenue)}
                </span>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
