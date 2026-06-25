"use client";

import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowDown,
  BarChart3,
  Check,
  CheckCircle,
  CheckCircle2,
  ChevronDown,
  Clock,
  Copy,
  Download,
  Edit3,
  Eye,
  Loader as LoaderIcon,
  Mail,
  MessageSquare,
  MousePointerClick,
  RefreshCw,
  Send,
  Sparkles,
  X,
} from "lucide-react";

import { C, brandGradient, inputStyle, shadow } from "@/lib/design";

/** Delivery / engagement lifecycle, mirrors OutreachDraft fields the
 *  send + tracking pipeline writes to. `status` here is the persisted
 *  DraftStatus (DRAFT|APPROVED|SENT|OPENED|REPLIED|BOUNCED), not the
 *  client-side generation status above. */
export type DeliveryStatus = {
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
};

export type DraftView = {
  id: string;
  donorName: string;
  donorEmail: string | null;
  subject: string;
  body: string;
  /** Generation status of the AI draft. Distinct from `delivery.status`. */
  status: "ready" | "loading" | "error";
  error?: string;
  /** Current send action state. */
  sending?: "idle" | "sending" | "error";
  sendError?: string;
  /** Resend lifecycle data, populated after first /api/outreach/drafts/:id/send. */
  delivery?: DeliveryStatus;
};

/**
 * Server snapshot of send-pacing state. Hourly cap is a fixed 50;
 * daily cap varies by plan tier (Starter 100 / Growth 250 / Scale 500 /
 * Enterprise unlimited). Refreshed inline on every successful send.
 */
export type LimitsSnapshot = {
  hourly: {
    used: number;
    cap: number | null;
    remaining: number | null;
    nextSlotAt: string | null;
    resetsAt: string;
  };
  daily: {
    used: number;
    cap: number | null;
    remaining: number | null;
    nextSlotAt: string | null;
    resetsAt: string;
    planName: string;
  };
};

/**
 * State machine for the "Send All" auto-pacer.
 *
 * `running` → drafts are being processed sequentially.
 * `paused-cap` → hit the rolling 50/hour cap; resumes at `resumeAt`.
 * `paused-dedup` → opened the dedup confirm modal mid-loop.
 * `blocked-daily` → daily plan cap exhausted, stop entirely.
 * `done` / `stopped` → loop finished cleanly / aborted by the user.
 */
export type BulkSendState =
  | { kind: "idle" }
  | {
      kind: "running";
      current: number;
      total: number;
      currentDraftIndex: number;
      currentRecipient: string | null;
    }
  | {
      kind: "paused-cap";
      sent: number;
      total: number;
      resumeAt: string | null;
      remaining: number;
    }
  | {
      kind: "paused-dedup";
      sent: number;
      total: number;
      queueRemaining: number[];
    }
  | {
      kind: "blocked-daily";
      sent: number;
      total: number;
      daily: LimitsSnapshot["daily"];
    }
  | { kind: "done"; sent: number; failed: number; total: number }
  | { kind: "stopped"; sent: number; total: number };

/**
 * Open modal asking the user to confirm sending to a recipient that
 * received an email from the same org in the last 7 days. `bulk: true`
 * is set when the prompt was raised inside the auto-pacer — the modal
 * shows a "Skip this one" button + cancels the whole loop on Close.
 */
export type DedupPrompt = {
  draftId: string;
  draftIndex: number;
  conflict: {
    recipientName: string;
    daysAgo: number;
    campaignName: string | null;
    cooldownEndsAt: string;
  };
  bulk: boolean;
};

type Props = {
  drafts: DraftView[];
  orgName: string;
  /**
   * Bare sender address from EMAIL_FROM (e.g. "hello@donorlume.com").
   * Drives the From: line in the first-send confirmation drawer. Null
   * when EMAIL_FROM is unset — drawer hides the From row in that case
   * (the send route's preflight will 412 anyway).
   */
  fromAddress: string | null;
  onRegenerate: (index: number) => void;
  onUpdateDraft: (
    index: number,
    patch: Partial<Pick<DraftView, "subject" | "body">>,
  ) => void;
  onSendDraft: (draftId: string, index: number) => void;
  onStartOver: () => void;
  /**
   * When true, the user reached this view via the dashboard onboarding
   * checklist (`/outreach/new?onboarding=1`). Three things happen:
   *   • The first unsent draft auto-scrolls into view on mount.
   *   • Its "Send from DonorLume" button gets a pulsing amber ring.
   *   • A "Click here to send your first email" callout renders above
   *     the button so the user's eye lands on the next action.
   *
   * All three effects disappear after the user sends — the celebration
   * screen takes over on the firstSend success path.
   */
  onboardingActive?: boolean;

  // ─── Send-pacing safeguards ──────────────────────────────────────
  /** Server snapshot of hourly + daily caps. null = still loading. */
  limits: LimitsSnapshot | null;
  /** Auto-pacer state machine for the "Send All" loop. */
  bulkSendState: BulkSendState;
  onSendAll: () => void;
  onStopBulk: () => void;
  /** Dismiss the post-run "Sent X of Y" summary card. */
  onDismissBulkSummary: () => void;
  /** 7-day recipient-dedup confirmation prompt — null when no prompt is open. */
  dedupPrompt: DedupPrompt | null;
  onConfirmDedup: () => void;
  onSkipDedup: () => void;
  onCancelDedup: () => void;
};

export function OutreachResults({
  drafts,
  orgName,
  fromAddress,
  onRegenerate,
  onUpdateDraft,
  onSendDraft,
  onStartOver,
  onboardingActive = false,
  limits,
  bulkSendState,
  onSendAll,
  onStopBulk,
  onDismissBulkSummary,
  dedupPrompt,
  onConfirmDedup,
  onSkipDedup,
  onCancelDedup,
}: Props) {
  const [expanded, setExpanded] = useState<number | null>(0);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  // First-send confirmation drawer. Renders ONLY during onboarding
  // and only for the very first card-level Send click — once the user
  // hits Send on one draft, every subsequent click is one-tap. The
  // drawer is the audit's "thicker airlock between drafting and the
  // first real-customer send" — it shows the rendered HTML, From, To,
  // and an Edit/Send pair so the user actually sees what's about to
  // leave the building.
  const [pendingConfirmIndex, setPendingConfirmIndex] = useState<number | null>(
    null,
  );
  const [hasConfirmedFirstSend, setHasConfirmedFirstSend] = useState(false);
  // Guards the one-time auto-scroll. We want it ONCE on entry to the
  // results view, not every time `drafts` mutates (regenerate, status
  // polling, etc.) — otherwise polling every 30s would yank the user
  // back to the top.
  const didAutoScrollRef = useRef(false);

  const ready = drafts.filter((d) => d.status === "ready");

  // Drafts that are ready AND have an email AND haven't shipped yet.
  // Drives the Send All button's count + the warning banner threshold.
  const sendableCount = drafts.filter(
    (d) => d.status === "ready" && !isSent(d) && !!d.donorEmail,
  ).length;
  const isBulkActive =
    bulkSendState.kind === "running" ||
    bulkSendState.kind === "paused-cap" ||
    bulkSendState.kind === "paused-dedup";

  // First card that is renderable AND has not yet been sent — the
  // onboarding "Send Your First Email →" toast scrolls to it via the
  // `#first-unsent-draft` anchor wired below. Returns -1 if every
  // draft errored or has already been sent.
  const firstUnsentIndex = drafts.findIndex(
    (d) => d.status === "ready" && !isSent(d),
  );

  // Auto-scroll the first unsent draft into view once, on the first
  // render that has a real anchor target during onboarding. Smooth
  // scroll + the inline `scrollMarginTop` on the card keep the topbar
  // and progress strip out of the way.
  useEffect(() => {
    if (didAutoScrollRef.current) return;
    if (!onboardingActive) return;
    if (firstUnsentIndex < 0) return;
    const el = document.getElementById("first-unsent-draft");
    if (!el) return;
    didAutoScrollRef.current = true;
    // Defer one frame so the layout has settled (the card just mounted).
    requestAnimationFrame(() => {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [onboardingActive, firstUnsentIndex]);

  const exportAll = () => {
    const text = ready
      .map(
        (d) =>
          `TO: ${d.donorName}\nSUBJECT: ${d.subject}\n\n${d.body}\n${"—".repeat(40)}`,
      )
      .join("\n\n");
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "outreach.txt";
    a.click();
    URL.revokeObjectURL(url);
  };

  const copyDraft = async (index: number) => {
    const d = drafts[index];
    await navigator.clipboard.writeText(`Subject: ${d.subject}\n\n${d.body}`);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  /**
   * Card-level Send click. During onboarding we route the very first
   * click through the confirmation drawer; everything after — and
   * everything outside onboarding — is one-tap. `hasConfirmedFirstSend`
   * also flips the moment the user closes the drawer with Send, so the
   * second card in the same campaign is direct.
   */
  const handleSendClick = (draftId: string, index: number) => {
    if (onboardingActive && !hasConfirmedFirstSend) {
      setPendingConfirmIndex(index);
      return;
    }
    onSendDraft(draftId, index);
  };

  const confirmAndSend = () => {
    if (pendingConfirmIndex == null) return;
    const idx = pendingConfirmIndex;
    const draft = drafts[idx];
    if (!draft) return;
    setHasConfirmedFirstSend(true);
    setPendingConfirmIndex(null);
    onSendDraft(draft.id, idx);
  };

  const cancelConfirmDrawer = () => setPendingConfirmIndex(null);

  const pendingDraft =
    pendingConfirmIndex != null ? drafts[pendingConfirmIndex] : null;

  return (
    <div style={{ maxWidth: 960 }}>
      {/* Milestone banner — celebrates the post-generation handoff so
          the user sees the moment they crossed from "waiting on AI" to
          "ready to review." The previous results screen landed straight
          on a table with no emotional beat between progress bar and
          send buttons. Renders only while there's at least one ready
          draft that hasn't shipped yet — once everything is sent the
          banner disappears so it stops announcing a completed milestone. */}
      {sendableCount > 0 && (
        <div
          style={{
            marginBottom: 22,
            padding: 2,
            borderRadius: 18,
            background: brandGradient,
            boxShadow:
              "0 14px 36px rgba(232,134,12,0.22), 0 4px 12px rgba(212,74,26,0.12)",
          }}
        >
          <div
            style={{
              backgroundColor: C.surface,
              borderRadius: 16,
              padding: "18px clamp(20px, 3vw, 26px)",
              display: "flex",
              alignItems: "center",
              gap: 14,
            }}
          >
            <div
              aria-hidden
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                background: brandGradient,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                boxShadow: "0 6px 16px rgba(232,134,12,0.30)",
              }}
            >
              <Sparkles size={20} color="#fff" strokeWidth={2.4} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontFamily:
                    "var(--font-instrument-serif), Georgia, serif",
                  fontSize: 22,
                  fontWeight: 400,
                  color: C.text,
                  letterSpacing: -0.3,
                  lineHeight: 1.15,
                }}
              >
                {sendableCount} draft{sendableCount === 1 ? "" : "s"} ready.
              </div>
              <div
                style={{
                  fontSize: 13.5,
                  color: C.textBody,
                  fontWeight: 500,
                  marginTop: 2,
                  lineHeight: 1.5,
                }}
              >
                Review, edit, and send when you&rsquo;re happy.
              </div>
            </div>
          </div>
        </div>
      )}

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 12,
          marginBottom: 24,
        }}
      >
        <p style={{ fontSize: 14, color: C.textSecondary, margin: 0 }}>
          {ready.length} email{ready.length === 1 ? "" : "s"} for {orgName}
        </p>
        <div style={{ display: "flex", gap: 10 }}>
          <button
            type="button"
            onClick={onStartOver}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "10px 20px",
              borderRadius: 12,
              border: "none",
              backgroundColor: "#F2F2F7",
              color: C.textSecondary,
              fontSize: 13,
              fontWeight: 700,
              cursor: "pointer",
              fontFamily: "var(--font-jakarta), -apple-system, sans-serif",
            }}
          >
            <RefreshCw size={15} /> Start Over
          </button>
          <button
            type="button"
            onClick={exportAll}
            disabled={ready.length === 0}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "10px 20px",
              borderRadius: 12,
              border: "none",
              backgroundColor: "#F2F2F7",
              color: C.textSecondary,
              fontSize: 13,
              fontWeight: 700,
              cursor: ready.length === 0 ? "default" : "pointer",
              opacity: ready.length === 0 ? 0.5 : 1,
              fontFamily: "var(--font-jakarta), -apple-system, sans-serif",
            }}
          >
            <Download size={15} /> Export All
          </button>
          {isBulkActive ? (
            <button
              type="button"
              onClick={onStopBulk}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "10px 20px",
                borderRadius: 12,
                border: `1.5px solid ${C.orange}`,
                backgroundColor: "transparent",
                color: C.orange,
                fontSize: 13,
                fontWeight: 700,
                cursor: "pointer",
                fontFamily: "var(--font-jakarta), -apple-system, sans-serif",
              }}
            >
              <X size={15} /> Stop Sending
            </button>
          ) : (
            <button
              type="button"
              onClick={onSendAll}
              disabled={sendableCount === 0}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "10px 22px",
                borderRadius: 12,
                border: "none",
                background:
                  sendableCount === 0 ? "#E5E5EA" : brandGradient,
                color: "#fff",
                fontSize: 13,
                fontWeight: 800,
                cursor: sendableCount === 0 ? "default" : "pointer",
                boxShadow:
                  sendableCount === 0
                    ? "none"
                    : "0 8px 20px rgba(232,134,12,0.30)",
                fontFamily:
                  "var(--font-jakarta), -apple-system, sans-serif",
              }}
            >
              <Send size={15} /> Send All
              {sendableCount > 0 ? ` (${sendableCount})` : ""}
            </button>
          )}
        </div>
      </div>

      <DailyQuotaStrip limits={limits} />

      {sendableCount > 50 && bulkSendState.kind === "idle" && (
        <BatchWarning count={sendableCount} />
      )}

      <BulkSendStatus
        state={bulkSendState}
        onStop={onStopBulk}
        onDismiss={onDismissBulkSummary}
      />

      <TrackingCallout />

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {drafts.map((d, i) => {
          if (d.status === "error") {
            return (
              <div
                key={d.id}
                style={{
                  backgroundColor: C.orangeLight,
                  borderRadius: 16,
                  padding: "18px 24px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 16,
                }}
              >
                <span style={{ color: C.orange, fontWeight: 700 }}>
                  {d.donorName}: {d.error}
                </span>
                {!d.id.startsWith("error-") && !d.id.startsWith("setup-") && (
                  <button
                    type="button"
                    onClick={() => onRegenerate(i)}
                    style={{
                      padding: "8px 18px",
                      borderRadius: 10,
                      border: "none",
                      backgroundColor: C.surface,
                      color: C.orange,
                      fontSize: 13,
                      fontWeight: 700,
                      cursor: "pointer",
                      fontFamily:
                        "var(--font-jakarta), -apple-system, sans-serif",
                    }}
                  >
                    Retry
                  </button>
                )}
              </div>
            );
          }

          if (d.status === "loading") {
            return (
              <div
                key={d.id}
                style={{
                  backgroundColor: C.surface,
                  borderRadius: 20,
                  boxShadow: shadow.sm,
                  padding: 24,
                  textAlign: "center",
                }}
              >
                <LoaderIcon
                  size={20}
                  color={C.amber}
                  className="spin"
                  style={{ verticalAlign: "middle" }}
                />
                <span style={{ color: C.textTertiary, marginLeft: 8 }}>
                  Regenerating…
                </span>
              </div>
            );
          }

          const isExpanded = expanded === i;
          const isEditing = editingIndex === i;
          const isCopied = copiedIndex === i;

          return (
            <div
              key={d.id}
              id={i === firstUnsentIndex ? "first-unsent-draft" : undefined}
              style={{
                backgroundColor: C.surface,
                borderRadius: 20,
                boxShadow: isExpanded ? shadow.md : shadow.sm,
                overflow: "hidden",
                transition: "box-shadow 0.2s",
                // Offset for the fixed topbar + onboarding progress bar
                // when the toast's #first-unsent-draft anchor scrolls
                // into view. Without this the card hides under the bar.
                scrollMarginTop: 120,
              }}
            >
              <div
                onClick={() => setExpanded(isExpanded ? null : i)}
                style={{
                  padding: "18px 24px",
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                  cursor: "pointer",
                  borderBottom: isExpanded
                    ? `1px solid ${C.borderSubtle}`
                    : "none",
                }}
              >
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 12,
                    backgroundColor: C.amberLight,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <Mail size={18} color={C.amber} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 700 }}>
                    {d.donorName}{" "}
                    {d.donorEmail && (
                      <span
                        style={{
                          fontSize: 13,
                          fontWeight: 500,
                          color: C.textTertiary,
                        }}
                      >
                        {d.donorEmail}
                      </span>
                    )}
                  </div>
                  <div
                    style={{
                      fontSize: 14,
                      color: C.textSecondary,
                      marginTop: 2,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {d.subject}
                  </div>
                </div>
                <DeliveryBadge delivery={d.delivery} />
                <ChevronDown
                  size={18}
                  color={C.textTertiary}
                  style={{
                    transform: isExpanded ? "rotate(180deg)" : "none",
                    transition: "transform 0.2s",
                  }}
                />
              </div>

              {isExpanded && (
                <div style={{ padding: 24 }}>
                  <div style={{ marginBottom: 14 }}>
                    <FieldLabel>Subject</FieldLabel>
                    {isEditing ? (
                      <input
                        value={d.subject}
                        onChange={(e) =>
                          onUpdateDraft(i, { subject: e.target.value })
                        }
                        style={{
                          ...inputStyle,
                          marginTop: 8,
                          fontWeight: 700,
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          fontSize: 17,
                          fontWeight: 700,
                          marginTop: 6,
                        }}
                      >
                        {d.subject}
                      </div>
                    )}
                  </div>
                  <div style={{ marginBottom: 20 }}>
                    <FieldLabel>Body</FieldLabel>
                    {isEditing ? (
                      <textarea
                        value={d.body}
                        onChange={(e) =>
                          onUpdateDraft(i, { body: e.target.value })
                        }
                        rows={10}
                        style={{
                          ...inputStyle,
                          marginTop: 8,
                          resize: "vertical",
                          lineHeight: 1.7,
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          fontSize: 15,
                          lineHeight: 1.8,
                          marginTop: 8,
                          whiteSpace: "pre-wrap",
                          color: C.text,
                        }}
                      >
                        {d.body}
                      </div>
                    )}
                  </div>

                  <div
                    style={{
                      display: "flex",
                      gap: 8,
                      flexWrap: "wrap",
                      paddingTop: 16,
                      borderTop: `1px solid ${C.borderSubtle}`,
                    }}
                  >
                    <ActionButton
                      onClick={() =>
                        setEditingIndex(isEditing ? null : i)
                      }
                      active={isEditing}
                    >
                      {isEditing ? (
                        <>
                          <Check size={14} /> Done
                        </>
                      ) : (
                        <>
                          <Edit3 size={14} /> Edit
                        </>
                      )}
                    </ActionButton>
                    <OutlineButton
                      onClick={() => copyDraft(i)}
                      activeColor={isCopied ? C.green : undefined}
                      title="Copy to clipboard (you lose open/click tracking if you send this from your own email)"
                    >
                      {isCopied ? (
                        <>
                          <Check size={12} /> Copied
                        </>
                      ) : (
                        <>
                          <Copy size={12} /> Copy
                        </>
                      )}
                    </OutlineButton>
                    <ActionButton
                      onClick={() => onRegenerate(i)}
                      disabled={isSendBusy(d)}
                    >
                      <RefreshCw size={14} /> Regenerate
                    </ActionButton>

                    <div style={{ flex: 1 }} />

                    {/* Secondary: legacy mailto handoff to native mail client.
                        Same trade-off as Copy — leaves DonorLume so we
                        lose open/click/reply tracking. Visually outlined
                        so users see it as a fallback, not the default. */}
                    <div
                      style={{
                        display: "inline-flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: 4,
                      }}
                    >
                      <OutlineButton
                        onClick={() => {
                          const url = `mailto:${d.donorEmail ?? ""}?subject=${encodeURIComponent(
                            d.subject,
                          )}&body=${encodeURIComponent(d.body)}`;
                          window.open(url);
                        }}
                        disabled={!d.donorEmail}
                        title="Hand off to your local mail client (you lose open/click tracking)"
                      >
                        <Mail size={12} /> Open in Mail
                      </OutlineButton>
                      <span
                        style={{
                          fontSize: 10.5,
                          color: C.textTertiary,
                          fontWeight: 600,
                          letterSpacing: 0.1,
                          textAlign: "center",
                          maxWidth: 130,
                          lineHeight: 1.3,
                        }}
                      >
                        opens in Gmail / Outlook · no tracking
                      </span>
                    </div>

                    {/* Primary: send directly from DonorLume via Resend.
                        Wrapped in a relative column so the onboarding
                        "Click here to send your first email" callout
                        can pin above it AND the tracking-feature pills
                        sit underneath, both anchored to the button. */}
                    <div
                      style={{
                        position: "relative",
                        display: "inline-flex",
                        flexDirection: "column",
                        alignItems: "flex-end",
                        gap: 8,
                      }}
                    >
                      {onboardingActive &&
                        i === firstUnsentIndex &&
                        !isSent(d) &&
                        d.donorEmail && <SendCallout />}
                      <button
                        type="button"
                        onClick={() => handleSendClick(d.id, i)}
                        disabled={
                          !d.donorEmail ||
                          isSent(d) ||
                          d.sending === "sending"
                        }
                        className={
                          onboardingActive &&
                          i === firstUnsentIndex &&
                          !isSent(d) &&
                          d.donorEmail
                            ? "send-from-donorlume-pulse"
                            : undefined
                        }
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          padding: "14px 26px",
                          borderRadius: 12,
                          border: "none",
                          background:
                            !d.donorEmail || isSent(d)
                              ? "#E5E5EA"
                              : brandGradient,
                          color: "#fff",
                          fontSize: 15,
                          fontWeight: 800,
                          letterSpacing: 0.1,
                          cursor:
                            !d.donorEmail ||
                            isSent(d) ||
                            d.sending === "sending"
                              ? "default"
                              : "pointer",
                          boxShadow:
                            !d.donorEmail || isSent(d)
                              ? "none"
                              : "0 10px 28px rgba(232,134,12,0.32), 0 4px 10px rgba(212,74,26,0.18)",
                          fontFamily:
                            "var(--font-jakarta), -apple-system, sans-serif",
                        }}
                      >
                        {d.sending === "sending" ? (
                          <>
                            <LoaderIcon size={16} className="spin" /> Sending…
                          </>
                        ) : isSent(d) ? (
                          <>
                            <CheckCircle size={16} /> Sent
                          </>
                        ) : (
                          <>
                            <Send size={16} /> Send from DonorLume
                          </>
                        )}
                      </button>
                      {!isSent(d) && d.donorEmail && (
                        <>
                          <span
                            style={{
                              fontSize: 10.5,
                              color: C.textTertiary,
                              fontWeight: 600,
                              letterSpacing: 0.1,
                              textAlign: "right",
                              maxWidth: 200,
                              lineHeight: 1.3,
                            }}
                          >
                            tracked opens, clicks &amp; replies
                          </span>
                          <TrackingPills />
                        </>
                      )}
                    </div>
                  </div>

                  {d.sending === "error" && d.sendError && (
                    <div
                      role="alert"
                      style={{
                        marginTop: 10,
                        fontSize: 12,
                        color: C.orange,
                        backgroundColor: C.orangeLight,
                        padding: "10px 14px",
                        borderRadius: 8,
                        fontWeight: 600,
                        whiteSpace: "pre-line",
                        lineHeight: 1.55,
                      }}
                    >
                      <strong>Send failed.</strong> {d.sendError}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {dedupPrompt && (
        <DedupModal
          prompt={dedupPrompt}
          onConfirm={onConfirmDedup}
          onSkip={onSkipDedup}
          onCancel={onCancelDedup}
        />
      )}

      {pendingDraft && (
        <FirstSendDrawer
          draft={pendingDraft}
          fromAddress={fromAddress}
          onCancel={cancelConfirmDrawer}
          onConfirm={confirmAndSend}
        />
      )}
    </div>
  );
}

// ─── Delivery-status helpers ────────────────────────────────────────────

function isSent(d: DraftView): boolean {
  const s = d.delivery?.status;
  return s === "SENT" || s === "OPENED" || s === "REPLIED" || s === "BOUNCED";
}

function isSendBusy(d: DraftView): boolean {
  return d.sending === "sending";
}

/**
 * Right-edge status pill in each draft card. Priority of display:
 *   bounced → replied → clicked → opened → delivered → sent → (none)
 * Falls back to the green ready check when the draft hasn't been sent.
 * Each pill is keyboard-readable via `title` (browser tooltip).
 */
function DeliveryBadge({ delivery }: { delivery: DraftView["delivery"] }) {
  if (!delivery || delivery.status === "DRAFT" || delivery.status === "APPROVED") {
    return <CheckCircle size={18} color={C.green} aria-label="Draft ready" />;
  }

  if (delivery.status === "BOUNCED" || delivery.bouncedAt) {
    return (
      <StatusPill
        icon={<AlertTriangle size={12} />}
        label="Bounced"
        color={C.orange}
        bg={C.orangeLight}
        title={delivery.bounceReason ?? "Delivery failed"}
      />
    );
  }

  if (delivery.repliedAt) {
    return (
      <StatusPill
        icon={<MessageSquare size={12} />}
        label="Replied"
        color="#1B7A3D"
        bg={C.greenLight}
      />
    );
  }

  if (delivery.clickCount > 0) {
    return (
      <StatusPill
        icon={<MousePointerClick size={12} />}
        label={`Clicked ×${delivery.clickCount}`}
        color={C.amberDark}
        bg={C.amberLight}
      />
    );
  }

  if (delivery.openCount > 0) {
    return (
      <StatusPill
        icon={<Eye size={12} />}
        label={`Opened ×${delivery.openCount}`}
        color={C.amberDark}
        bg={C.amberLight}
      />
    );
  }

  if (delivery.deliveredAt) {
    return (
      <StatusPill
        icon={<CheckCircle2 size={12} />}
        label="Delivered"
        color={C.blue}
        bg="#E5F0FF"
      />
    );
  }

  // SENT but no delivery webhook yet.
  return (
    <StatusPill
      icon={<Clock size={12} />}
      label="Sent"
      color={C.textSecondary}
      bg="#F2F2F7"
    />
  );
}

function StatusPill({
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

function FieldLabel({ children }: { children: string }) {
  return (
    <label
      style={{
        fontSize: 11,
        fontWeight: 800,
        color: C.textTertiary,
        textTransform: "uppercase",
        letterSpacing: 1,
      }}
    >
      {children}
    </label>
  );
}

function ActionButton({
  onClick,
  children,
  active = false,
  activeColor,
  disabled = false,
}: {
  onClick: () => void;
  children: React.ReactNode;
  active?: boolean;
  activeColor?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        padding: "10px 18px",
        borderRadius: 10,
        border: "none",
        backgroundColor: active ? C.amberLight : "#F2F2F7",
        color: activeColor ?? (active ? C.amber : C.textSecondary),
        fontSize: 13,
        fontWeight: 700,
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.5 : 1,
        fontFamily: "var(--font-jakarta), -apple-system, sans-serif",
      }}
    >
      {children}
    </button>
  );
}

/**
 * Banner above the draft cards explaining the trade-off between sending
 * via DonorLume (tracked) vs copying into the user's own email client
 * (untracked). Always rendered — even after some drafts have been sent —
 * because users typically work through a list one-by-one, and the
 * decision is per-draft.
 */
function TrackingCallout() {
  return (
    <div
      style={{
        marginBottom: 16,
        padding: "16px 20px",
        borderRadius: 16,
        background:
          "linear-gradient(135deg, rgba(232,134,12,0.10), rgba(212,74,26,0.07))",
        border: `1px solid rgba(232,134,12,0.30)`,
        display: "flex",
        gap: 14,
        alignItems: "flex-start",
      }}
    >
      <div
        aria-hidden
        style={{
          width: 36,
          height: 36,
          borderRadius: 10,
          background: brandGradient,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          boxShadow: "0 6px 16px rgba(232,134,12,0.30)",
        }}
      >
        <Sparkles size={18} color="#fff" />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 14.5,
            fontWeight: 800,
            color: C.text,
            marginBottom: 4,
            letterSpacing: -0.1,
          }}
        >
          Send through DonorLume to track opens, clicks, and replies in
          real time.
        </div>
        <div
          style={{
            fontSize: 13,
            color: C.textSecondary,
            fontWeight: 500,
            lineHeight: 1.55,
          }}
        >
          Copy and paste into your own email client and you lose this
          visibility — no open rates, no click data, no reply detection,
          no campaign report.
        </div>
      </div>
    </div>
  );
}

/**
 * Compact strip rendered beneath each "Send from DonorLume" button. Four
 * tiny icon+label pills that telegraph what gets tracked the moment the
 * user clicks send. Reinforces the callout above the cards at the exact
 * decision point.
 */
function TrackingPills() {
  const items: { Icon: typeof Eye; label: string }[] = [
    { Icon: Eye, label: "Opens" },
    { Icon: MousePointerClick, label: "Clicks" },
    { Icon: MessageSquare, label: "Replies" },
    { Icon: BarChart3, label: "Reports" },
  ];
  return (
    <div
      aria-label="Tracking included when you send from DonorLume"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        fontSize: 11,
        fontWeight: 700,
        color: C.amberDark,
      }}
    >
      <span
        style={{
          fontSize: 10,
          fontWeight: 800,
          letterSpacing: 0.6,
          textTransform: "uppercase",
          color: C.textTertiary,
          marginRight: 4,
        }}
      >
        Tracks:
      </span>
      {items.map((it, idx) => {
        const { Icon } = it;
        return (
          <span
            key={it.label}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 3,
            }}
          >
            <Icon size={11} color={C.amberDark} />
            {it.label}
            {idx < items.length - 1 && (
              <span
                aria-hidden
                style={{ color: C.textTertiary, marginLeft: 4 }}
              >
                ·
              </span>
            )}
          </span>
        );
      })}
    </div>
  );
}

/**
 * Outline-style button used for Copy and Open in Mail — visually
 * subordinate to the gradient Send button. Same size footprint as
 * ActionButton so the wrap line stays consistent.
 */
function OutlineButton({
  onClick,
  children,
  activeColor,
  disabled = false,
  title,
}: {
  onClick: () => void;
  children: React.ReactNode;
  activeColor?: string;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 5,
        padding: "8px 14px",
        borderRadius: 9,
        border: `1.5px solid ${C.border}`,
        backgroundColor: "transparent",
        color: activeColor ?? C.textSecondary,
        fontSize: 12,
        fontWeight: 700,
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.5 : 1,
        fontFamily: "var(--font-jakarta), -apple-system, sans-serif",
      }}
    >
      {children}
    </button>
  );
}

/**
 * Onboarding-only callout that sits above the first unsent draft's
 * "Send from DonorLume" button. A small gradient pill with a downward
 * arrow pointing AT the button — purely directional, no click target.
 *
 * The pulsing border on the button itself does the heavy lifting; this
 * label spells out the action in case the pulse alone isn't unambiguous.
 * Hidden after the user sends (parent's `firstUnsentIndex` advances or
 * goes -1).
 */
function SendCallout() {
  return (
    <div
      aria-hidden
      className="send-callout-bob"
      style={{
        position: "absolute",
        bottom: "calc(100% + 10px)",
        right: 0,
        display: "inline-flex",
        flexDirection: "column",
        alignItems: "flex-end",
        gap: 2,
        pointerEvents: "none",
      }}
    >
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          padding: "7px 14px",
          borderRadius: 100,
          background: brandGradient,
          color: "#fff",
          fontSize: 12,
          fontWeight: 800,
          letterSpacing: 0.3,
          boxShadow: "0 10px 24px rgba(232,134,12,0.36)",
          whiteSpace: "nowrap",
          fontFamily: "var(--font-jakarta), -apple-system, sans-serif",
        }}
      >
        Click here to send your first email
      </span>
      <ArrowDown
        size={20}
        color={C.amber}
        strokeWidth={2.6}
        style={{
          marginRight: 24,
          filter: "drop-shadow(0 4px 8px rgba(232,134,12,0.30))",
        }}
      />
    </div>
  );
}

// ─── Send-pacing UI ────────────────────────────────────────────────────

/**
 * Persistent strip below the page header showing today's send quota.
 * Renders a "—" placeholder while limits are still loading so the
 * layout doesn't jump on the first /api/outreach/limits resolution.
 */
function DailyQuotaStrip({ limits }: { limits: LimitsSnapshot | null }) {
  if (!limits) {
    return (
      <div
        style={{
          padding: "10px 14px",
          marginBottom: 12,
          fontSize: 12,
          color: C.textTertiary,
          fontWeight: 600,
        }}
      >
        Loading sending quota…
      </div>
    );
  }
  const { daily, hourly } = limits;
  const isUnlimited = daily.cap === null;
  const dailyLabel = isUnlimited
    ? `Today: ${daily.used.toLocaleString()} sent · Unlimited (${daily.planName})`
    : `Today: ${daily.used.toLocaleString()} / ${daily.cap?.toLocaleString()} sent · ${daily.remaining?.toLocaleString()} remaining (${daily.planName})`;
  const hourlyLabel =
    hourly.cap !== null
      ? `This hour: ${hourly.used} / ${hourly.cap}`
      : null;
  const pctUsed =
    !isUnlimited && daily.cap
      ? Math.min(100, Math.round((daily.used / daily.cap) * 100))
      : null;
  const nearCap = pctUsed !== null && pctUsed >= 80;
  return (
    <div
      style={{
        marginBottom: 12,
        padding: "10px 14px",
        borderRadius: 12,
        backgroundColor: nearCap ? C.orangeLight : C.amberLight,
        border: `1px solid ${nearCap ? "rgba(212,74,26,0.30)" : "rgba(232,134,12,0.22)"}`,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 14,
        flexWrap: "wrap",
        fontSize: 13,
        fontWeight: 700,
        color: nearCap ? C.orange : C.amberDark,
      }}
    >
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <Send size={13} /> {dailyLabel}
      </span>
      {hourlyLabel && (
        <span
          style={{
            color: C.textSecondary,
            fontSize: 12,
            fontWeight: 600,
          }}
        >
          {hourlyLabel}
        </span>
      )}
    </div>
  );
}

/**
 * Warning banner shown above the cards when 50+ drafts are ready to
 * send. Tells the user we'll auto-pace so they don't try to power-send
 * the whole batch in one click.
 */
function BatchWarning({ count }: { count: number }) {
  return (
    <div
      role="note"
      style={{
        marginBottom: 12,
        padding: "14px 18px",
        borderRadius: 14,
        backgroundColor: C.orangeLight,
        border: `1px solid rgba(212,74,26,0.30)`,
        display: "flex",
        alignItems: "flex-start",
        gap: 12,
      }}
    >
      <AlertTriangle
        size={18}
        color={C.orange}
        style={{ flexShrink: 0, marginTop: 1 }}
      />
      <div style={{ flex: 1, fontSize: 13.5, lineHeight: 1.5 }}>
        <strong style={{ color: C.orange }}>
          {count} drafts ready to send.
        </strong>{" "}
        <span style={{ color: C.text, fontWeight: 500 }}>
          We recommend sending in batches of 25–50 to maintain high
          deliverability. DonorLume will automatically pace your sends.
        </span>
      </div>
    </div>
  );
}

/**
 * Status pill for the auto-pacer. Renders nothing in the idle state.
 * `paused-cap` is the headline UX: the spec calls for "Your emails
 * will be sent gradually over the next [X] hours to ensure maximum
 * deliverability."
 */
function BulkSendStatus({
  state,
  onStop,
  onDismiss,
}: {
  state: BulkSendState;
  onStop: () => void;
  onDismiss: () => void;
}) {
  if (state.kind === "idle") return null;

  if (state.kind === "running") {
    return (
      <div
        style={{
          marginBottom: 12,
          padding: "12px 16px",
          borderRadius: 12,
          background:
            "linear-gradient(135deg, rgba(232,134,12,0.12), rgba(212,74,26,0.08))",
          border: `1px solid rgba(232,134,12,0.28)`,
          display: "flex",
          alignItems: "center",
          gap: 10,
          fontSize: 13,
          fontWeight: 700,
          color: C.amberDark,
        }}
      >
        <LoaderIcon size={16} className="spin" color={C.amber} />
        <span>
          Sending {state.current} of {state.total}
          {state.currentRecipient ? ` — ${state.currentRecipient}` : ""}…
        </span>
      </div>
    );
  }

  if (state.kind === "paused-cap") {
    const hoursUntil = state.resumeAt
      ? Math.max(
          1,
          Math.ceil(
            (new Date(state.resumeAt).getTime() - Date.now()) / (60 * 60 * 1000),
          ),
        )
      : null;
    const resumeTime = state.resumeAt
      ? new Date(state.resumeAt).toLocaleTimeString([], {
          hour: "numeric",
          minute: "2-digit",
        })
      : null;
    return (
      <div
        style={{
          marginBottom: 12,
          padding: "16px 18px",
          borderRadius: 14,
          backgroundColor: C.amberLight,
          border: `1px solid rgba(232,134,12,0.30)`,
          display: "flex",
          alignItems: "flex-start",
          gap: 12,
        }}
      >
        <Clock
          size={18}
          color={C.amberDark}
          style={{ flexShrink: 0, marginTop: 2 }}
        />
        <div style={{ flex: 1, fontSize: 13.5, lineHeight: 1.55 }}>
          <strong style={{ color: C.amberDark, display: "block", marginBottom: 4 }}>
            Pausing — {state.sent} of {state.total} sent.
          </strong>
          <span style={{ color: C.text, fontWeight: 500 }}>
            Your emails will be sent gradually over the next{" "}
            {hoursUntil ? `${hoursUntil} hour${hoursUntil === 1 ? "" : "s"}` : "hour"}{" "}
            to ensure maximum deliverability. Sending too many at once
            can trigger spam filters.
            {resumeTime ? ` Auto-resume at ${resumeTime}.` : ""}
          </span>
        </div>
        <button
          type="button"
          onClick={onStop}
          style={{
            border: `1.5px solid ${C.orange}`,
            background: "transparent",
            color: C.orange,
            fontSize: 12,
            fontWeight: 700,
            padding: "8px 14px",
            borderRadius: 10,
            cursor: "pointer",
            flexShrink: 0,
          }}
        >
          Cancel
        </button>
      </div>
    );
  }

  if (state.kind === "blocked-daily") {
    return (
      <div
        style={{
          marginBottom: 12,
          padding: "16px 18px",
          borderRadius: 14,
          backgroundColor: C.orangeLight,
          border: `1px solid rgba(212,74,26,0.32)`,
          display: "flex",
          alignItems: "flex-start",
          gap: 12,
        }}
      >
        <AlertTriangle
          size={18}
          color={C.orange}
          style={{ flexShrink: 0, marginTop: 2 }}
        />
        <div style={{ flex: 1, fontSize: 13.5, lineHeight: 1.55 }}>
          <strong style={{ color: C.orange, display: "block", marginBottom: 4 }}>
            Daily sending cap reached.
          </strong>
          <span style={{ color: C.text, fontWeight: 500 }}>
            Your {state.daily.planName} plan is limited to{" "}
            {state.daily.cap?.toLocaleString()} sends per day. Quota
            resets at UTC midnight, or upgrade for a higher cap.
          </span>
        </div>
      </div>
    );
  }

  if (state.kind === "done") {
    return (
      <div
        style={{
          marginBottom: 12,
          padding: "12px 16px",
          borderRadius: 12,
          backgroundColor: C.greenLight,
          border: `1px solid rgba(52,199,89,0.30)`,
          display: "flex",
          alignItems: "center",
          gap: 10,
          fontSize: 13,
          fontWeight: 700,
          color: "#1B5E20",
        }}
      >
        <CheckCircle2 size={16} />
        <span style={{ flex: 1 }}>
          Sent {state.sent} of {state.total}.
          {state.failed > 0 ? ` ${state.failed} failed.` : ""}
        </span>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          style={{
            background: "transparent",
            border: "none",
            color: "#1B5E20",
            cursor: "pointer",
            padding: 4,
          }}
        >
          <X size={14} />
        </button>
      </div>
    );
  }

  if (state.kind === "stopped") {
    return (
      <div
        style={{
          marginBottom: 12,
          padding: "12px 16px",
          borderRadius: 12,
          backgroundColor: "#F2F2F7",
          border: `1px solid ${C.border}`,
          display: "flex",
          alignItems: "center",
          gap: 10,
          fontSize: 13,
          fontWeight: 700,
          color: C.textSecondary,
        }}
      >
        <span style={{ flex: 1 }}>
          Stopped — {state.sent} of {state.total} sent.
        </span>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          style={{
            background: "transparent",
            border: "none",
            color: C.textSecondary,
            cursor: "pointer",
            padding: 4,
          }}
        >
          <X size={14} />
        </button>
      </div>
    );
  }

  // paused-dedup — modal is doing the talking; render a quiet placeholder.
  return null;
}

/**
 * Confirmation modal for the 7-day recipient-dedup check. Shows the
 * recipient name, time since the last send, and the campaign name (if
 * known). In bulk context, adds a "Skip this one" button so the user
 * can keep the loop moving without sending again.
 */
function DedupModal({
  prompt,
  onConfirm,
  onSkip,
  onCancel,
}: {
  prompt: DedupPrompt;
  onConfirm: () => void;
  onSkip: () => void;
  onCancel: () => void;
}) {
  const { conflict, bulk } = prompt;
  const daysLabel =
    conflict.daysAgo === 0
      ? "earlier today"
      : `${conflict.daysAgo} day${conflict.daysAgo === 1 ? "" : "s"} ago`;

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(20,20,22,0.55)",
        backdropFilter: "blur(4px)",
        WebkitBackdropFilter: "blur(4px)",
        zIndex: 100,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div
        style={{
          backgroundColor: C.surface,
          borderRadius: 20,
          padding: "28px 28px 22px",
          width: "100%",
          maxWidth: 480,
          boxShadow: shadow.lg,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            marginBottom: 12,
          }}
        >
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              backgroundColor: C.orangeLight,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <AlertTriangle size={22} color={C.orange} />
          </div>
          <h3
            style={{
              margin: 0,
              fontSize: 18,
              fontWeight: 800,
              letterSpacing: -0.2,
              color: C.text,
            }}
          >
            Sent in the last 7 days
          </h3>
        </div>
        <p
          style={{
            margin: "0 0 18px",
            fontSize: 14.5,
            lineHeight: 1.6,
            color: C.text,
            fontWeight: 500,
          }}
        >
          <strong>{conflict.recipientName}</strong> received an email
          from your{" "}
          {conflict.campaignName ? (
            <>
              &ldquo;{conflict.campaignName}&rdquo; campaign
            </>
          ) : (
            "last campaign"
          )}{" "}
          {daysLabel}. Are you sure you want to send again?
        </p>
        <div
          style={{
            display: "flex",
            gap: 10,
            flexWrap: "wrap",
            justifyContent: "flex-end",
          }}
        >
          <button
            type="button"
            onClick={onCancel}
            style={{
              padding: "10px 18px",
              borderRadius: 10,
              border: `1.5px solid ${C.border}`,
              background: "transparent",
              color: C.textSecondary,
              fontSize: 13,
              fontWeight: 700,
              cursor: "pointer",
              fontFamily:
                "var(--font-jakarta), -apple-system, sans-serif",
            }}
          >
            {bulk ? "Cancel sending" : "Cancel"}
          </button>
          {bulk && (
            <button
              type="button"
              onClick={onSkip}
              style={{
                padding: "10px 18px",
                borderRadius: 10,
                border: "none",
                backgroundColor: "#F2F2F7",
                color: C.textSecondary,
                fontSize: 13,
                fontWeight: 700,
                cursor: "pointer",
                fontFamily:
                  "var(--font-jakarta), -apple-system, sans-serif",
              }}
            >
              Skip this one
            </button>
          )}
          <button
            type="button"
            onClick={onConfirm}
            style={{
              padding: "10px 18px",
              borderRadius: 10,
              border: "none",
              background: brandGradient,
              color: "#fff",
              fontSize: 13,
              fontWeight: 800,
              cursor: "pointer",
              boxShadow: "0 8px 20px rgba(232,134,12,0.30)",
              fontFamily:
                "var(--font-jakarta), -apple-system, sans-serif",
            }}
          >
            Send anyway
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── First-send confirmation drawer ─────────────────────────────────────

/**
 * Modal drawer that opens on the user's very first card-level Send
 * click during onboarding (issue #6 in the journey audit). The
 * recipient sees a styled HTML email — the user has only been
 * looking at the plain-text body in the card preview — so before
 * the first send, we show them what's actually about to leave:
 *
 *   • Rendered HTML matching the visible portion of `prepare.ts`
 *     (paragraph wrapping, line-break preservation, recipient-side
 *     font + color). Tracking pixel + URL rewrites are omitted
 *     because they're invisible to the recipient anyway.
 *   • The configured From: address and the donor's To: address
 *     side by side so the user can verify both before committing.
 *   • Edit (closes the drawer, sets no state) and Send (fires the
 *     send and stops the drawer from opening again this session).
 *
 * Once dismissed via Send, the parent's `hasConfirmedFirstSend` flag
 * stays true for the rest of the session — every subsequent click
 * goes straight to the network.
 */
function FirstSendDrawer({
  draft,
  fromAddress,
  onCancel,
  onConfirm,
}: {
  draft: DraftView;
  fromAddress: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const renderedHtml = renderPreviewHtml(draft.body);
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Review before sending — first send"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 90,
        backgroundColor: "rgba(15,15,15,0.55)",
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        padding: 16,
      }}
      onClick={onCancel}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 720,
          maxHeight: "94vh",
          backgroundColor: C.surface,
          borderRadius: 24,
          boxShadow:
            "0 32px 80px rgba(0,0,0,0.30), 0 8px 24px rgba(0,0,0,0.18)",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          fontFamily: "var(--font-jakarta), -apple-system, sans-serif",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "20px 24px 14px",
            borderBottom: `1px solid ${C.borderSubtle}`,
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <div style={{ minWidth: 0, flex: 1 }}>
            <div
              style={{
                fontSize: 11,
                fontWeight: 800,
                letterSpacing: 1.4,
                textTransform: "uppercase",
                color: C.amberDark,
                marginBottom: 6,
              }}
            >
              First send — review
            </div>
            <div
              style={{
                fontFamily:
                  "var(--font-instrument-serif), Georgia, serif",
                fontSize: 24,
                fontWeight: 400,
                color: C.text,
                letterSpacing: -0.4,
                lineHeight: 1.1,
              }}
            >
              This is the email {draft.donorName.split(" ")[0] || "your donor"}{" "}
              will receive.
            </div>
            <p
              style={{
                margin: "6px 0 0",
                fontSize: 13,
                color: C.textSecondary,
                fontWeight: 500,
                lineHeight: 1.5,
              }}
            >
              Future sends are one click — this preview only runs on the very
              first send so you can verify the rendered email.
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Close"
            style={{
              background: "none",
              border: "none",
              color: C.textTertiary,
              cursor: "pointer",
              padding: 6,
              borderRadius: 8,
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* From / To */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 12,
            padding: "16px 24px",
            backgroundColor: C.bg,
            borderBottom: `1px solid ${C.borderSubtle}`,
            fontSize: 13,
          }}
        >
          <div>
            <div
              style={{
                fontSize: 10,
                fontWeight: 800,
                letterSpacing: 1.3,
                textTransform: "uppercase",
                color: C.textTertiary,
                marginBottom: 4,
              }}
            >
              From
            </div>
            <div
              style={{
                color: C.text,
                fontWeight: 700,
                wordBreak: "break-all",
              }}
            >
              {fromAddress ?? "Sending address not configured"}
            </div>
          </div>
          <div>
            <div
              style={{
                fontSize: 10,
                fontWeight: 800,
                letterSpacing: 1.3,
                textTransform: "uppercase",
                color: C.textTertiary,
                marginBottom: 4,
              }}
            >
              To
            </div>
            <div
              style={{
                color: C.text,
                fontWeight: 700,
                wordBreak: "break-all",
              }}
            >
              {draft.donorEmail ?? "—"}
            </div>
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            <div
              style={{
                fontSize: 10,
                fontWeight: 800,
                letterSpacing: 1.3,
                textTransform: "uppercase",
                color: C.textTertiary,
                marginBottom: 4,
              }}
            >
              Subject
            </div>
            <div style={{ color: C.text, fontWeight: 700 }}>
              {draft.subject}
            </div>
          </div>
        </div>

        {/* Rendered preview */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "20px 24px",
            backgroundColor: "#FAFAF8",
          }}
        >
          <div
            style={{
              backgroundColor: C.surface,
              borderRadius: 14,
              padding: 24,
              boxShadow: shadow.sm,
              fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
              fontSize: 15,
              color: "#1D1D1F",
              lineHeight: 1.6,
            }}
            // Server-side prepare.ts uses the same paragraph-wrapping logic;
            // both inputs are constrained to a single trusted draft body
            // that flows through Anthropic + our parseDraft regex.
            // dangerouslySetInnerHTML here renders Claude-generated text
            // verbatim, which we escape inside renderPreviewHtml.
            dangerouslySetInnerHTML={{ __html: renderedHtml }}
          />
        </div>

        {/* Footer actions */}
        <div
          style={{
            padding: "14px 24px",
            borderTop: `1px solid ${C.borderSubtle}`,
            display: "flex",
            justifyContent: "flex-end",
            gap: 10,
            flexWrap: "wrap",
          }}
        >
          <button
            type="button"
            onClick={onCancel}
            style={{
              padding: "12px 22px",
              borderRadius: 12,
              border: "none",
              backgroundColor: "#F2F2F7",
              color: C.textSecondary,
              fontSize: 14,
              fontWeight: 700,
              cursor: "pointer",
              fontFamily:
                "var(--font-jakarta), -apple-system, sans-serif",
            }}
          >
            Edit instead
          </button>
          <button
            type="button"
            onClick={onConfirm}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "12px 26px",
              borderRadius: 12,
              border: "none",
              background: brandGradient,
              color: "#fff",
              fontSize: 14,
              fontWeight: 800,
              cursor: "pointer",
              boxShadow: "0 10px 24px rgba(232,134,12,0.30)",
              fontFamily:
                "var(--font-jakarta), -apple-system, sans-serif",
            }}
          >
            <Send size={15} /> Send to {draft.donorName.split(" ")[0] || "donor"}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Renders the donor-side preview HTML for the first-send drawer. The
 * server's `prepare.ts` does the same paragraph wrapping plus tracking
 * pixel + URL rewrites; the tracking layer is invisible to the
 * recipient, so the preview skips it and renders only the visible
 * portion (paragraphs, escaped HTML entities, line breaks, link
 * styling). Keep this function in sync with `prepare.ts` if/when the
 * visible rendering changes.
 */
function renderPreviewHtml(body: string): string {
  const HTML_ENTITIES: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  };
  const escape = (s: string) =>
    s.replace(/[&<>"']/g, (c) => HTML_ENTITIES[c] ?? c);
  const URL_RE = /https?:\/\/[^\s<"'`)]+/g;

  const paragraphs = body
    .split(/\r?\n\r?\n+/)
    .map((p) => p.trim())
    .filter(Boolean);

  return paragraphs
    .map((p) => {
      const escaped = escape(p).replace(/\r?\n/g, "<br />");
      const linked = escaped.replace(URL_RE, (rawUrl) => {
        const trailing = rawUrl.match(/[.,;:!?)]+$/);
        const url = trailing
          ? rawUrl.slice(0, -trailing[0].length)
          : rawUrl;
        const tail = trailing ? trailing[0] : "";
        return `<a href="${url}" style="color:#C26A00;text-decoration:underline">${escape(url)}</a>${tail}`;
      });
      return `<p style="margin:0 0 16px;line-height:1.6;color:#1D1D1F">${linked}</p>`;
    })
    .join("");
}
