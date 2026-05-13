import Link from "next/link";
import type { OutreachCampaign } from "@prisma/client";
import { ChevronRight, Mail } from "lucide-react";

import { C, shadow } from "@/lib/design";
import { deriveCampaignMetrics } from "@/lib/outreach/insights";

type Props = {
  campaigns: OutreachCampaign[];
};

/**
 * Dashboard "Recent Outreach" widget — Spec §7. Up to 3 most-recent
 * campaigns, each row showing name + sent / open-rate / click-rate +
 * click-through to the campaign report.
 */
export function RecentOutreach({ campaigns }: Props) {
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
          padding: "20px 24px 16px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
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
          <Mail size={18} color={C.amber} /> Recent Outreach
        </h3>
        <Link
          href="/outreach"
          style={{
            fontSize: 12,
            color: C.amber,
            fontWeight: 700,
            textDecoration: "none",
            display: "inline-flex",
            alignItems: "center",
            gap: 2,
          }}
        >
          See all <ChevronRight size={12} />
        </Link>
      </div>

      {campaigns.length === 0 ? (
        <div
          style={{
            padding: "20px 24px 28px",
            fontSize: 13,
            color: C.textTertiary,
            borderTop: `1px solid ${C.borderSubtle}`,
            lineHeight: 1.6,
          }}
        >
          No campaigns yet.{" "}
          <Link
            href="/outreach/new"
            style={{
              color: C.amber,
              textDecoration: "none",
              fontWeight: 700,
            }}
          >
            Generate your first
          </Link>
          .
        </div>
      ) : (
        <div style={{ borderTop: `1px solid ${C.borderSubtle}` }}>
          {campaigns.map((c, i) => {
            const metrics = deriveCampaignMetrics(c);
            const dateLabel = new Date(c.createdAt).toLocaleDateString(
              "en-US",
              { month: "short", day: "numeric" },
            );
            const sentLine =
              metrics.sent > 0
                ? `${metrics.sent} sent · ${metrics.openPct} open · ${metrics.clickPct} click`
                : `${c.totalDrafts} draft${c.totalDrafts === 1 ? "" : "s"} · not sent`;
            return (
              <Link
                key={c.id}
                href={`/outreach/campaigns/${c.id}`}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "12px 24px",
                  textDecoration: "none",
                  color: "inherit",
                  borderTop:
                    i > 0 ? `1px solid ${C.borderSubtle}` : "none",
                  transition: "background 0.15s",
                }}
                className="campaign-row"
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 600,
                      color: C.text,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {c.name}
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      color: C.textTertiary,
                      marginTop: 2,
                      fontWeight: 500,
                    }}
                  >
                    {sentLine}
                  </div>
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: C.textTertiary,
                    fontWeight: 600,
                    whiteSpace: "nowrap",
                  }}
                >
                  {dateLabel}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
