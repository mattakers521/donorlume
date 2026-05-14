"use client";

import { Fragment, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  Clock,
  Eye,
  Layers,
  Loader as LoaderIcon,
  Mail,
  MessageSquare,
  MousePointerClick,
  Send,
} from "lucide-react";

import { C, brandGradient, shadow } from "@/lib/design";
import { CohortBadge, CohortOverflow } from "@/components/lapsed/cohort-badge";

export type CampaignDraftRow = {
  id: string;
  recipientName: string;
  recipientEmail: string | null;
  subject: string;
  body: string;
  status: "DRAFT" | "APPROVED" | "SENT" | "OPENED" | "REPLIED" | "BOUNCED";
  sentAt: string | null;
  deliveredAt: string | null;
  openedAt: string | null;
  openCount: number;
  clickedAt: string | null;
  clickCount: number;
  bouncedAt: string | null;
  bounceReason: string | null;
  repliedAt: string | null;
  cohorts: { id: string; name: string; color: string }[];
  /**
   * Other campaigns this donor is also included in (excluding the
   * current one). Newest-first. Drives the "Also in: X, Y" badge so
   * campaign managers can spot over-communication without leaving
   * the report.
   */
  otherCampaigns: { id: string; name: string }[];
};

type Props = {
  drafts: CampaignDraftRow[];
};

/**
 * Per-draft table for the campaign report page. Read-only history: each
 * row shows recipient + cohorts + send date + status + opens + clicks.
 * Clicking a row expands an inline panel with the rendered subject and
 * body. DRAFT-status rows also expose a Send button that POSTs to the
 * existing `/api/outreach/drafts/[id]/send` endpoint, then refreshes the
 * server-rendered page so the new state lands across the metrics bar +
 * cohort breakdown in one shot.
 */
export function CampaignDraftTable({ drafts }: Props) {
  const router = useRouter();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [sending, setSending] = useState<string | null>(null);
  const [errorById, setErrorById] = useState<Record<string, string>>({});

  const sendDraft = async (id: string) => {
    setSending(id);
    setErrorById((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    try {
      const res = await fetch(
        `/api/outreach/drafts/${encodeURIComponent(id)}/send`,
        { method: "POST" },
      );
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      const body = (await res.json().catch(() => ({}))) as {
        firstSend?: boolean;
      };
      if (body.firstSend) {
        // First-ever send earns the celebration screen — full-page
        // "You're all set!" with the starburst pulse + Go to Dashboard
        // CTA. Replaces the disappearing toast so the milestone
        // actually registers with the user.
        console.log(
          "[outreach-trace] CampaignDraftTable.sendDraft firstSend=true → router.push('/celebrate')",
        );
        router.push("/celebrate");
        router.refresh();
        return;
      }
      console.log(
        "[outreach-trace] CampaignDraftTable.sendDraft success → router.refresh() (no nav)",
      );
      // Re-fetch the server-rendered campaign page so every aggregate
      // (metrics bar, counters, cohort breakdown) reflects the new send.
      router.refresh();
    } catch (e) {
      setErrorById((prev) => ({
        ...prev,
        [id]: e instanceof Error ? e.message : "Send failed",
      }));
    } finally {
      setSending(null);
    }
  };

  if (drafts.length === 0) {
    return (
      <div
        style={{
          backgroundColor: C.surface,
          borderRadius: 20,
          boxShadow: shadow.sm,
          padding: 48,
          textAlign: "center",
          color: C.textTertiary,
          fontSize: 14,
        }}
      >
        No drafts in this campaign.
      </div>
    );
  }

  return (
    <div
      style={{
        backgroundColor: C.surface,
        borderRadius: 20,
        boxShadow: shadow.sm,
        overflow: "hidden",
      }}
    >
      <div className="app-scroll-x">
      <table
        style={{ width: "100%", minWidth: 780, borderCollapse: "collapse" }}
      >
        <thead>
          <tr>
            {[
              "Recipient",
              "Sent",
              "Status",
              "Opens",
              "Clicks",
              "",
            ].map((h) => (
              <th
                key={h}
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: C.textTertiary,
                  textAlign: "left",
                  padding: "12px 18px",
                  textTransform: "uppercase",
                  letterSpacing: 0.5,
                  whiteSpace: "nowrap",
                }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {drafts.map((d) => {
            const expanded = expandedId === d.id;
            const isSending = sending === d.id;
            const error = errorById[d.id];
            const visibleCohorts = d.cohorts.slice(0, 2);
            const overflow = Math.max(
              0,
              d.cohorts.length - visibleCohorts.length,
            );

            return (
              <Fragment key={d.id}>
                <tr
                  onClick={() =>
                    setExpandedId(expanded ? null : d.id)
                  }
                  style={{
                    borderTop: `1px solid ${C.borderSubtle}`,
                    cursor: "pointer",
                  }}
                >
                  <td style={{ padding: "14px 18px" }}>
                    <div style={{ fontSize: 15, fontWeight: 700 }}>
                      {d.recipientName}
                    </div>
                    <div
                      style={{
                        fontSize: 12,
                        color: C.textTertiary,
                        marginTop: 2,
                      }}
                    >
                      {d.recipientEmail ?? "no email"}
                    </div>
                    {(visibleCohorts.length > 0 || overflow > 0) && (
                      <div
                        style={{
                          display: "flex",
                          gap: 5,
                          marginTop: 7,
                          flexWrap: "wrap",
                          alignItems: "center",
                        }}
                      >
                        {visibleCohorts.map((c) => (
                          <CohortBadge key={c.id} cohort={c} />
                        ))}
                        {overflow > 0 && (
                          <CohortOverflow count={overflow} />
                        )}
                      </div>
                    )}
                    {d.otherCampaigns.length > 0 && (
                      <OverlapBadge
                        otherCampaigns={d.otherCampaigns}
                      />
                    )}
                  </td>
                  <td
                    style={{
                      padding: "14px 18px",
                      fontSize: 13,
                      color: C.textSecondary,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {d.sentAt
                      ? new Date(d.sentAt).toLocaleString("en-US", {
                          month: "short",
                          day: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        })
                      : "—"}
                  </td>
                  <td style={{ padding: "14px 18px" }}>
                    <DraftStatusPill draft={d} />
                  </td>
                  <td
                    style={{
                      padding: "14px 18px",
                      fontSize: 14,
                      fontWeight: 600,
                      color: d.openCount > 0 ? C.text : C.textTertiary,
                    }}
                  >
                    {d.openCount}
                  </td>
                  <td
                    style={{
                      padding: "14px 18px",
                      fontSize: 14,
                      fontWeight: 600,
                      color: d.clickCount > 0 ? C.text : C.textTertiary,
                    }}
                  >
                    {d.clickCount}
                  </td>
                  <td style={{ padding: "14px 18px", textAlign: "right" }}>
                    <ChevronDown
                      size={16}
                      color={C.textTertiary}
                      style={{
                        transform: expanded ? "rotate(180deg)" : "none",
                        transition: "transform 0.2s",
                      }}
                    />
                  </td>
                </tr>
                {expanded && (
                  <tr style={{ borderTop: `1px solid ${C.borderSubtle}` }}>
                    <td
                      colSpan={6}
                      style={{
                        padding: "20px 24px 24px",
                        backgroundColor: C.surfaceHover,
                      }}
                    >
                      <div
                        style={{
                          fontSize: 11,
                          fontWeight: 800,
                          color: C.textTertiary,
                          textTransform: "uppercase",
                          letterSpacing: 1,
                          marginBottom: 6,
                        }}
                      >
                        Subject
                      </div>
                      <div
                        style={{
                          fontSize: 16,
                          fontWeight: 700,
                          marginBottom: 16,
                          color: C.text,
                        }}
                      >
                        {d.subject}
                      </div>
                      <div
                        style={{
                          fontSize: 11,
                          fontWeight: 800,
                          color: C.textTertiary,
                          textTransform: "uppercase",
                          letterSpacing: 1,
                          marginBottom: 6,
                        }}
                      >
                        Body
                      </div>
                      <div
                        style={{
                          fontSize: 14,
                          lineHeight: 1.75,
                          whiteSpace: "pre-wrap",
                          color: C.text,
                          marginBottom: 16,
                        }}
                      >
                        {d.body}
                      </div>

                      {/* Bounce reason inline if applicable */}
                      {d.bounceReason && (
                        <div
                          style={{
                            backgroundColor: C.orangeLight,
                            color: C.orange,
                            fontSize: 13,
                            fontWeight: 600,
                            padding: "10px 14px",
                            borderRadius: 10,
                            marginBottom: 16,
                          }}
                        >
                          Bounce reason: {d.bounceReason}
                        </div>
                      )}

                      {/* Send action — only for never-sent drafts */}
                      {d.status === "DRAFT" && d.recipientEmail && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            sendDraft(d.id);
                          }}
                          disabled={isSending}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 6,
                            padding: "10px 18px",
                            borderRadius: 10,
                            border: "none",
                            background: isSending
                              ? "#E5E5EA"
                              : brandGradient,
                            color: "#fff",
                            fontSize: 13,
                            fontWeight: 700,
                            cursor: isSending ? "default" : "pointer",
                            fontFamily:
                              "var(--font-jakarta), -apple-system, sans-serif",
                          }}
                        >
                          {isSending ? (
                            <>
                              <LoaderIcon size={14} className="spin" />{" "}
                              Sending…
                            </>
                          ) : (
                            <>
                              <Send size={14} /> Send from DonorLume
                            </>
                          )}
                        </button>
                      )}
                      {error && (
                        <div
                          role="alert"
                          style={{
                            marginTop: 10,
                            fontSize: 12,
                            color: C.orange,
                            backgroundColor: C.orangeLight,
                            padding: "8px 12px",
                            borderRadius: 8,
                            fontWeight: 600,
                          }}
                        >
                          Send failed — {error}
                        </div>
                      )}
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
      </div>
    </div>
  );
}

// Status pill — same priority order as the results-screen DeliveryBadge.
function DraftStatusPill({ draft }: { draft: CampaignDraftRow }) {
  if (draft.status === "DRAFT" || draft.status === "APPROVED") {
    return (
      <Pill
        icon={<Mail size={11} />}
        label="Draft"
        color={C.textTertiary}
        bg="#F2F2F7"
      />
    );
  }
  if (draft.status === "BOUNCED" || draft.bouncedAt) {
    return (
      <Pill
        icon={<AlertTriangle size={11} />}
        label="Bounced"
        color={C.orange}
        bg={C.orangeLight}
        title={draft.bounceReason ?? "Delivery failed"}
      />
    );
  }
  if (draft.repliedAt) {
    return (
      <Pill
        icon={<MessageSquare size={11} />}
        label="Replied"
        color="#1B7A3D"
        bg={C.greenLight}
      />
    );
  }
  if (draft.clickCount > 0) {
    return (
      <Pill
        icon={<MousePointerClick size={11} />}
        label="Clicked"
        color={C.amberDark}
        bg={C.amberLight}
      />
    );
  }
  if (draft.openCount > 0) {
    return (
      <Pill
        icon={<Eye size={11} />}
        label="Opened"
        color={C.amberDark}
        bg={C.amberLight}
      />
    );
  }
  if (draft.deliveredAt) {
    return (
      <Pill
        icon={<CheckCircle2 size={11} />}
        label="Delivered"
        color={C.blue}
        bg="#E5F0FF"
      />
    );
  }
  return (
    <Pill
      icon={<Clock size={11} />}
      label="Sent"
      color={C.textSecondary}
      bg="#F2F2F7"
    />
  );
}

function Pill({
  icon,
  label,
  color,
  bg,
  title,
}: {
  icon: React.ReactNode;
  label: string;
  color: string;
  bg: string;
  title?: string;
}) {
  return (
    <span
      title={title ?? label}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        padding: "4px 9px 4px 8px",
        borderRadius: 100,
        backgroundColor: bg,
        color,
        fontSize: 11,
        fontWeight: 700,
        whiteSpace: "nowrap",
        lineHeight: 1.2,
      }}
    >
      {icon}
      {label}
    </span>
  );
}

/**
 * "Also in: Campaign A, Campaign B" overlap signal. Surfaced under
 * each draft row so a campaign manager can spot donors caught in
 * multiple campaigns simultaneously — the over-communication
 * warning. Each name is a Link to that other campaign's report so
 * the manager can investigate in one click.
 *
 * Compact form: shows up to two names inline, then "+N more" for the
 * rest (full list available via tooltip on the chip). Click on the
 * chip itself stops propagation so it doesn't toggle the row expand.
 */
function OverlapBadge({
  otherCampaigns,
}: {
  otherCampaigns: { id: string; name: string }[];
}) {
  if (otherCampaigns.length === 0) return null;
  const visible = otherCampaigns.slice(0, 2);
  const overflow = otherCampaigns.length - visible.length;
  const allNames = otherCampaigns.map((c) => c.name).join(", ");

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        marginTop: 7,
        flexWrap: "wrap",
        fontSize: 11.5,
        fontFamily: "var(--font-jakarta), -apple-system, sans-serif",
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <span
        title={`This donor is also in: ${allNames}`}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
          padding: "3px 8px",
          borderRadius: 6,
          fontSize: 11,
          fontWeight: 800,
          backgroundColor: C.purpleLight,
          color: C.purple,
          textTransform: "uppercase",
          letterSpacing: 0.5,
        }}
      >
        <Layers size={11} strokeWidth={2.4} />
        Also in
      </span>
      {visible.map((c, i) => (
        <span
          key={c.id}
          style={{ display: "inline-flex", alignItems: "center", gap: 4 }}
        >
          <Link
            href={`/outreach/campaigns/${c.id}`}
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: C.text,
              textDecoration: "none",
              borderBottom: `1px dashed ${C.textTertiary}`,
              maxWidth: 200,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
            title={c.name}
          >
            {c.name}
          </Link>
          {i < visible.length - 1 && (
            <span style={{ color: C.textTertiary }}>·</span>
          )}
        </span>
      ))}
      {overflow > 0 && (
        <span
          title={allNames}
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: C.textTertiary,
            padding: "3px 6px",
            borderRadius: 6,
            backgroundColor: "#F2F2F7",
          }}
        >
          +{overflow} more
        </span>
      )}
    </div>
  );
}

