import {
  AlertTriangle,
  CheckCircle2,
  Eye,
  Mail,
  MessageSquare,
  MousePointerClick,
  type LucideIcon,
} from "lucide-react";

import { C, shadow } from "@/lib/design";
import type { CampaignMetrics } from "@/lib/outreach/insights";

type Props = {
  totalDrafts: number;
  metrics: CampaignMetrics;
  bouncedCount: number;
  deliveredCount: number;
  openedCount: number;
  clickedCount: number;
  repliedCount: number;
};

type Tile = {
  Icon: LucideIcon;
  iconColor: string;
  iconBg: string;
  label: string;
  value: string;
  /** Right-aligned percentage, omitted when sent count is 0. */
  pct?: string;
};

/**
 * Six KPIs across the top of /outreach/campaigns/[id] — Spec §7
 * "Top metrics bar". Each tile renders the absolute count + the rate
 * vs. sent (when applicable).
 */
export function CampaignMetricsBar({
  totalDrafts,
  metrics,
  bouncedCount,
  deliveredCount,
  openedCount,
  clickedCount,
  repliedCount,
}: Props) {
  const sent = metrics.sent;
  const draftedNotSent = totalDrafts - sent;

  const tiles: Tile[] = [
    {
      Icon: Mail,
      iconColor: C.text,
      iconBg: "#F2F2F7",
      label: "Sent",
      value: sent.toLocaleString(),
      pct:
        draftedNotSent > 0
          ? `${draftedNotSent.toLocaleString()} unsent`
          : undefined,
    },
    {
      Icon: CheckCircle2,
      iconColor: C.blue,
      iconBg: "#E5F0FF",
      label: "Delivered",
      value: deliveredCount.toLocaleString(),
      pct: sent > 0 ? metrics.deliveredPct : undefined,
    },
    {
      Icon: Eye,
      iconColor: C.amberDark,
      iconBg: C.amberLight,
      label: "Opened",
      value: openedCount.toLocaleString(),
      pct: sent > 0 ? metrics.openPct : undefined,
    },
    {
      Icon: MousePointerClick,
      iconColor: C.amber,
      iconBg: C.amberLight,
      label: "Clicked",
      value: clickedCount.toLocaleString(),
      pct: sent > 0 ? metrics.clickPct : undefined,
    },
    {
      Icon: MessageSquare,
      iconColor: "#1B7A3D",
      iconBg: C.greenLight,
      label: "Replied",
      value: repliedCount.toLocaleString(),
      pct: sent > 0 ? metrics.replyPct : undefined,
    },
    {
      Icon: AlertTriangle,
      iconColor: C.orange,
      iconBg: C.orangeLight,
      label: "Bounced",
      value: bouncedCount.toLocaleString(),
      pct: sent > 0 ? metrics.bouncePct : undefined,
    },
  ];

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
        gap: 14,
        marginBottom: 28,
      }}
    >
      {tiles.map((t) => (
        <div
          key={t.label}
          style={{
            backgroundColor: C.surface,
            borderRadius: 16,
            boxShadow: shadow.sm,
            padding: "18px 20px",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 12,
            }}
          >
            <div
              style={{
                width: 30,
                height: 30,
                borderRadius: 9,
                backgroundColor: t.iconBg,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <t.Icon size={15} color={t.iconColor} />
            </div>
            <span
              style={{
                fontSize: 11,
                color: C.textTertiary,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: 1,
              }}
            >
              {t.label}
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            <span
              style={{
                fontSize: 26,
                fontWeight: 400,
                fontFamily:
                  "var(--font-instrument-serif), Georgia, serif",
                letterSpacing: -0.8,
                lineHeight: 1,
                color: C.text,
              }}
            >
              {t.value}
            </span>
            {t.pct && (
              <span
                style={{
                  fontSize: 12,
                  color: C.textTertiary,
                  fontWeight: 600,
                }}
              >
                {t.pct}
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
