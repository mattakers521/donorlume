"use client";

import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowDown,
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

type Props = {
  drafts: DraftView[];
  orgName: string;
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
};

export function OutreachResults({
  drafts,
  orgName,
  onRegenerate,
  onUpdateDraft,
  onSendDraft,
  onStartOver,
  onboardingActive = false,
}: Props) {
  const [expanded, setExpanded] = useState<number | null>(0);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  // Guards the one-time auto-scroll. We want it ONCE on entry to the
  // results view, not every time `drafts` mutates (regenerate, status
  // polling, etc.) — otherwise polling every 30s would yank the user
  // back to the top.
  const didAutoScrollRef = useRef(false);

  const ready = drafts.filter((d) => d.status === "ready");

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

  return (
    <div style={{ maxWidth: 960 }}>
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
              background: ready.length === 0 ? "#E5E5EA" : brandGradient,
              color: "#fff",
              fontSize: 13,
              fontWeight: 700,
              cursor: ready.length === 0 ? "default" : "pointer",
              fontFamily: "var(--font-jakarta), -apple-system, sans-serif",
            }}
          >
            <Download size={15} /> Export All
          </button>
        </div>
      </div>

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
                    <ActionButton
                      onClick={() => copyDraft(i)}
                      activeColor={isCopied ? C.green : undefined}
                    >
                      {isCopied ? (
                        <>
                          <Check size={14} /> Copied!
                        </>
                      ) : (
                        <>
                          <Copy size={14} /> Copy
                        </>
                      )}
                    </ActionButton>
                    <ActionButton
                      onClick={() => onRegenerate(i)}
                      disabled={isSendBusy(d)}
                    >
                      <RefreshCw size={14} /> Regenerate
                    </ActionButton>

                    <div style={{ flex: 1 }} />

                    {/* Secondary: legacy mailto handoff to native mail client. */}
                    <ActionButton
                      onClick={() => {
                        const url = `mailto:${d.donorEmail ?? ""}?subject=${encodeURIComponent(
                          d.subject,
                        )}&body=${encodeURIComponent(d.body)}`;
                        window.open(url);
                      }}
                      disabled={!d.donorEmail}
                    >
                      <Mail size={14} /> Open in Mail
                    </ActionButton>

                    {/* Primary: send directly from DonorLume via Resend.
                        Wrapped in a relative container so the onboarding
                        "Click here to send your first email" callout
                        can pin above it with absolute positioning. */}
                    <div
                      style={{
                        position: "relative",
                        display: "inline-flex",
                      }}
                    >
                      {onboardingActive &&
                        i === firstUnsentIndex &&
                        !isSent(d) &&
                        d.donorEmail && <SendCallout />}
                      <button
                        type="button"
                        onClick={() => onSendDraft(d.id, i)}
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
                          gap: 6,
                          padding: "10px 18px",
                          borderRadius: 10,
                          border: "none",
                          background:
                            !d.donorEmail || isSent(d)
                              ? "#E5E5EA"
                              : brandGradient,
                          color: "#fff",
                          fontSize: 13,
                          fontWeight: 700,
                          cursor:
                            !d.donorEmail ||
                            isSent(d) ||
                            d.sending === "sending"
                              ? "default"
                              : "pointer",
                          fontFamily:
                            "var(--font-jakarta), -apple-system, sans-serif",
                        }}
                      >
                        {d.sending === "sending" ? (
                          <>
                            <LoaderIcon size={14} className="spin" /> Sending…
                          </>
                        ) : isSent(d) ? (
                          <>
                            <CheckCircle size={14} /> Sent
                          </>
                        ) : (
                          <>
                            <Send size={14} /> Send from DonorLume
                          </>
                        )}
                      </button>
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
