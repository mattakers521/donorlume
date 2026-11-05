"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, type CSSProperties, type ReactNode } from "react";
import {
  ArrowRight,
  Check,
  Copy,
  Mail,
  Megaphone,
  PenLine,
  RefreshCw,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

import { PrimaryButton } from "@/components/auth-button";
import { TrialAiCounter } from "@/components/outreach/trial-ai-counter";
import {
  campaignToText,
  type ParsedCampaign,
} from "@/lib/assistants/campaign";
import {
  ASSISTANTS,
  type Assistant,
  type QuickStart,
} from "@/lib/assistants/catalog";
import { MAX_NOTES_LENGTH } from "@/lib/assistants/prompt";
import { C, brandGradient, inputStyle, shadow } from "@/lib/design";

/** sessionStorage key read by AssistantHandoffOutreach on /outreach/new?from=assistant. */
export const ASSISTANT_HANDOFF_KEY = "outreach:assistant-draft";

type Output =
  | { kind: "email"; subject: string; body: string }
  | { kind: "text"; text: string }
  | { kind: "campaign"; campaign: ParsedCampaign };

type Props = {
  /** Grounding fields still empty — non-empty blocks generation. */
  missingProfileFields: string[];
  canEditProfile: boolean;
  /** Lifetime AI usage while in an unpaid trial; null otherwise. */
  initialTrialUsed: number | null;
};

const ICONS: Record<Assistant["id"], ReactNode> = {
  "content-writer": <PenLine size={20} color={C.amber} />,
  "campaign-creator": <Megaphone size={20} color={C.amber} />,
};

export function AssistantsClient({
  missingProfileFields,
  canEditProfile,
  initialTrialUsed,
}: Props) {
  const router = useRouter();
  const blocked = missingProfileFields.length > 0;
  const [trialUsed, setTrialUsed] = useState(initialTrialUsed);
  const [active, setActive] = useState<{
    assistant: Assistant;
    quickStart: QuickStart;
  } | null>(null);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [output, setOutput] = useState<Output | null>(null);
  // Bumped per successful generation so editors re-seed from new output.
  const [generation, setGeneration] = useState(0);
  const workspaceRef = useRef<HTMLDivElement>(null);

  function choose(assistant: Assistant, quickStart: QuickStart) {
    setActive({ assistant, quickStart });
    setNotes("");
    setOutput(null);
    setError(null);
    requestAnimationFrame(() =>
      workspaceRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
    );
  }

  async function generate() {
    if (!active || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/assistants/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assistantId: active.assistant.id,
          quickStartId: active.quickStart.id,
          notes: notes.trim() || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 402 && typeof data.current === "number") {
          setTrialUsed((u) => (u == null ? u : data.current));
        }
        setError(data.error ?? "Something went wrong. Please try again.");
        return;
      }
      setOutput(data.output as Output);
      setGeneration((g) => g + 1);
      if (typeof data.trialUsed === "number") setTrialUsed(data.trialUsed);
    } catch {
      setError("Couldn't reach DonorLume. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  function useInOutreach(subject: string, body: string) {
    try {
      window.sessionStorage.setItem(
        ASSISTANT_HANDOFF_KEY,
        JSON.stringify({
          subject,
          body,
          emailType: active?.quickStart.outreachEmailType ?? null,
          source: active?.assistant.name ?? null,
        }),
      );
    } catch {
      // Storage blocked — outreach still opens, just without the prefill.
    }
    router.push("/outreach/new?from=assistant");
  }

  return (
    <div style={{ maxWidth: 1100 }}>
      {trialUsed != null && <TrialAiCounter used={trialUsed} />}

      {blocked && (
        <ProfileGate
          missing={missingProfileFields}
          canEditProfile={canEditProfile}
        />
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          gap: 20,
          marginBottom: 28,
        }}
      >
        {ASSISTANTS.map((a) => (
          <section
            key={a.id}
            aria-label={a.name}
            data-testid={`assistant-${a.id}`}
            style={{
              backgroundColor: C.surface,
              borderRadius: 20,
              boxShadow: shadow.sm,
              padding: 26,
              display: "flex",
              flexDirection: "column",
              gap: 14,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 13,
                  backgroundColor: C.amberLight,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                {ICONS[a.id]}
              </div>
              <h2
                style={{
                  margin: 0,
                  fontSize: 26,
                  fontWeight: 400,
                  fontFamily: "var(--font-instrument-serif), Georgia, serif",
                  color: C.text,
                }}
              >
                {a.name}
              </h2>
            </div>
            <p
              style={{
                margin: 0,
                fontSize: 14.5,
                lineHeight: 1.55,
                color: C.textBody,
              }}
            >
              {a.description}
            </p>
            {!blocked && <GroundedNote canEditProfile={canEditProfile} />}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {a.quickStarts.map((q) => {
                const selected =
                  active?.assistant.id === a.id && active.quickStart.id === q.id;
                return (
                  <button
                    key={q.id}
                    type="button"
                    disabled={blocked}
                    onClick={() => choose(a, q)}
                    aria-pressed={selected}
                    style={{
                      padding: "9px 15px",
                      borderRadius: 100,
                      border: "none",
                      fontSize: 13.5,
                      fontWeight: 600,
                      fontFamily: "inherit",
                      cursor: blocked ? "not-allowed" : "pointer",
                      background: selected ? brandGradient : C.amberLight,
                      color: blocked
                        ? C.textTertiary
                        : selected
                          ? "#fff"
                          : C.amberDark,
                      opacity: blocked ? 0.6 : 1,
                    }}
                  >
                    {q.label}
                  </button>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      {active && !blocked && (
        <div
          ref={workspaceRef}
          data-testid="assistant-workspace"
          style={{
            backgroundColor: C.surface,
            borderRadius: 20,
            boxShadow: shadow.md,
            padding: 28,
            scrollMarginTop: 90,
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: 1.4,
              textTransform: "uppercase",
              color: C.amberDark,
              marginBottom: 4,
            }}
          >
            {active.assistant.name}
          </div>
          <h3
            style={{
              margin: "0 0 18px",
              fontSize: 24,
              fontWeight: 400,
              fontFamily: "var(--font-instrument-serif), Georgia, serif",
            }}
          >
            {active.quickStart.label}
          </h3>

          <FieldLabel htmlFor="assistant-notes">
            Details to include (optional)
          </FieldLabel>
          <textarea
            id="assistant-notes"
            value={notes}
            maxLength={MAX_NOTES_LENGTH}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="e.g. Our food pantry opens a second location in March. Event was the Oct 12 Veterans Day breakfast."
            style={{ ...inputStyle, resize: "vertical", marginBottom: 16 }}
          />

          {!output && (
            <PrimaryButton
              type="button"
              onClick={generate}
              loading={busy}
              loadingLabel="Writing…"
              style={{ maxWidth: 260 }}
            >
              <Sparkles size={17} /> Generate
            </PrimaryButton>
          )}

          {error && (
            <div
              role="alert"
              style={{
                marginTop: 14,
                padding: "12px 16px",
                borderRadius: 12,
                backgroundColor: C.redLight,
                color: "#B42318",
                fontSize: 14,
                fontWeight: 600,
              }}
            >
              {error}
            </div>
          )}

          {output && (
            <div style={{ marginTop: 8 }}>
              <OutputView
                key={generation}
                output={output}
                quickStart={active.quickStart}
                onUseInOutreach={useInOutreach}
              />
              <button
                type="button"
                onClick={generate}
                disabled={busy}
                style={secondaryButton}
              >
                <RefreshCw size={15} /> {busy ? "Writing…" : "Regenerate"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Output rendering ──────────────────────────────────────────────────

function OutputView({
  output,
  quickStart,
  onUseInOutreach,
}: {
  output: Output;
  quickStart: QuickStart;
  onUseInOutreach: (subject: string, body: string) => void;
}) {
  if (output.kind === "email") {
    return (
      <EmailEditor
        idPrefix="email"
        initialSubject={output.subject}
        initialBody={output.body}
        onUseInOutreach={onUseInOutreach}
      />
    );
  }
  if (output.kind === "text") {
    return (
      <TextEditor
        id="assistant-output"
        label={quickStart.format === "social" ? "Post" : "Newsletter blurb"}
        initial={output.text}
      />
    );
  }
  if (!output.campaign.ok) {
    // Unparseable output is still the user's content — show it as-is,
    // never an error or a blank.
    return (
      <TextEditor
        id="assistant-output"
        label="Campaign draft"
        initial={output.campaign.raw}
        rows={18}
      />
    );
  }
  return (
    <CampaignEditor
      campaign={output.campaign}
      onUseInOutreach={onUseInOutreach}
    />
  );
}

function CampaignEditor({
  campaign,
  onUseInOutreach,
}: {
  campaign: Extract<ParsedCampaign, { ok: true }>;
  onUseInOutreach: (subject: string, body: string) => void;
}) {
  const [brief, setBrief] = useState(campaign.brief);
  const [emails, setEmails] = useState(campaign.emails);

  const briefFields: { key: keyof typeof brief; label: string; rows: number }[] = [
    { key: "audience", label: "Audience", rows: 2 },
    { key: "messageArc", label: "Message arc", rows: 3 },
    { key: "timeline", label: "Timeline", rows: 4 },
  ];

  return (
    <div data-testid="campaign-output">
      <SectionHeading>Campaign brief</SectionHeading>
      {briefFields.map((f) => (
        <div key={f.key} style={{ marginBottom: 12 }}>
          <FieldLabel htmlFor={`brief-${f.key}`}>{f.label}</FieldLabel>
          <textarea
            id={`brief-${f.key}`}
            value={brief[f.key]}
            rows={f.rows}
            onChange={(e) => setBrief({ ...brief, [f.key]: e.target.value })}
            style={{ ...inputStyle, resize: "vertical" }}
          />
        </div>
      ))}

      {emails.map((e, i) => (
        <div
          key={i}
          data-testid={`campaign-email-${i + 1}`}
          style={{
            marginTop: 20,
            padding: 20,
            borderRadius: 16,
            backgroundColor: C.bg,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "baseline",
              flexWrap: "wrap",
              gap: 8,
              marginBottom: 10,
            }}
          >
            <SectionHeading style={{ margin: 0 }}>Email {i + 1}</SectionHeading>
            <span style={{ fontSize: 13, fontWeight: 600, color: C.textSecondary }}>
              Send: {e.send}
            </span>
          </div>
          <EmailEditor
            idPrefix={`campaign-email-${i + 1}`}
            initialSubject={e.subject}
            initialBody={e.body}
            onChange={(subject, body) =>
              setEmails((all) =>
                all.map((x, j) => (j === i ? { ...x, subject, body } : x)),
              )
            }
            onUseInOutreach={onUseInOutreach}
          />
        </div>
      ))}

      <div style={{ marginTop: 18 }}>
        <CopyButton
          label="Copy entire campaign"
          text={() => campaignToText({ brief, emails })}
        />
      </div>
    </div>
  );
}

function EmailEditor({
  idPrefix,
  initialSubject,
  initialBody,
  onChange,
  onUseInOutreach,
}: {
  idPrefix: string;
  initialSubject: string;
  initialBody: string;
  onChange?: (subject: string, body: string) => void;
  onUseInOutreach: (subject: string, body: string) => void;
}) {
  const [subject, setSubject] = useState(initialSubject);
  const [body, setBody] = useState(initialBody);
  return (
    <div>
      <FieldLabel htmlFor={`${idPrefix}-subject`}>Subject</FieldLabel>
      <input
        id={`${idPrefix}-subject`}
        value={subject}
        onChange={(e) => {
          setSubject(e.target.value);
          onChange?.(e.target.value, body);
        }}
        style={{ ...inputStyle, marginBottom: 12 }}
      />
      <FieldLabel htmlFor={`${idPrefix}-body`}>Body</FieldLabel>
      <textarea
        id={`${idPrefix}-body`}
        value={body}
        rows={10}
        onChange={(e) => {
          setBody(e.target.value);
          onChange?.(subject, e.target.value);
        }}
        style={{ ...inputStyle, resize: "vertical", lineHeight: 1.6 }}
      />
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 12 }}>
        <CopyButton
          label="Copy"
          text={() => (subject ? `Subject: ${subject}\n\n${body}` : body)}
        />
        <button
          type="button"
          onClick={() => onUseInOutreach(subject, body)}
          style={secondaryButton}
        >
          <Mail size={15} /> Use in AI Outreach <ArrowRight size={14} />
        </button>
      </div>
    </div>
  );
}

function TextEditor({
  id,
  label,
  initial,
  rows = 8,
}: {
  id: string;
  label: string;
  initial: string;
  rows?: number;
}) {
  const [text, setText] = useState(initial);
  return (
    <div>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <textarea
        id={id}
        value={text}
        rows={rows}
        onChange={(e) => setText(e.target.value)}
        style={{ ...inputStyle, resize: "vertical", lineHeight: 1.6 }}
      />
      <div style={{ marginTop: 12 }}>
        <CopyButton label="Copy" text={() => text} />
      </div>
    </div>
  );
}

// ─── Small pieces ──────────────────────────────────────────────────────

function CopyButton({ label, text }: { label: string; text: () => string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text());
          setCopied(true);
          setTimeout(() => setCopied(false), 1800);
        } catch {
          // Clipboard blocked — the text is still selectable in the field.
        }
      }}
      style={{ ...secondaryButton, marginTop: 0 }}
    >
      {copied ? <Check size={15} /> : <Copy size={15} />}
      {copied ? "Copied" : label}
    </button>
  );
}

function GroundedNote({ canEditProfile }: { canEditProfile: boolean }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        fontSize: 13,
        fontWeight: 600,
        color: C.textSecondary,
      }}
    >
      <ShieldCheck size={15} color={C.green} />
      <span>Grounded in your organization profile</span>
      <span aria-hidden>·</span>
      <Link
        href="/settings/organization"
        style={{ color: C.amberDark, textDecoration: "none" }}
      >
        {canEditProfile ? "Edit profile" : "View profile"}
      </Link>
    </div>
  );
}

function ProfileGate({
  missing,
  canEditProfile,
}: {
  missing: string[];
  canEditProfile: boolean;
}) {
  return (
    <div
      role="status"
      data-testid="assistants-profile-gate"
      style={{
        marginBottom: 24,
        padding: "20px 22px",
        borderRadius: 18,
        backgroundColor: C.amberLight,
        display: "flex",
        alignItems: "center",
        gap: 16,
        flexWrap: "wrap",
      }}
    >
      <div style={{ flex: 1, minWidth: 240 }}>
        <div style={{ fontSize: 15.5, fontWeight: 700, color: C.text, marginBottom: 4 }}>
          Complete your organization profile first
        </div>
        <div style={{ fontSize: 14, lineHeight: 1.55, color: C.textBody }}>
          Assistants write from your mission, the community you serve, and
          your focus areas — without them, everything would sound generic.
          Still needed: {missing.join(", ")}.
          {!canEditProfile && " Ask an owner or admin to fill these in."}
        </div>
      </div>
      {canEditProfile && (
        <Link
          href="/settings/organization"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "12px 20px",
            borderRadius: 14,
            background: brandGradient,
            color: "#fff",
            fontSize: 14,
            fontWeight: 700,
            textDecoration: "none",
            boxShadow: shadow.md,
            whiteSpace: "nowrap",
          }}
        >
          Complete profile <ArrowRight size={15} />
        </Link>
      )}
    </div>
  );
}

function FieldLabel({
  htmlFor,
  children,
}: {
  htmlFor: string;
  children: ReactNode;
}) {
  return (
    <label
      htmlFor={htmlFor}
      style={{
        display: "block",
        fontSize: 13,
        fontWeight: 700,
        color: C.textSecondary,
        marginBottom: 6,
      }}
    >
      {children}
    </label>
  );
}

function SectionHeading({
  children,
  style,
}: {
  children: ReactNode;
  style?: CSSProperties;
}) {
  return (
    <h4
      style={{
        margin: "4px 0 12px",
        fontSize: 15,
        fontWeight: 700,
        color: C.text,
        ...style,
      }}
    >
      {children}
    </h4>
  );
}

const secondaryButton: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 7,
  marginTop: 16,
  padding: "10px 16px",
  borderRadius: 12,
  border: `1.5px solid ${C.border}`,
  backgroundColor: C.surface,
  color: C.text,
  fontSize: 13.5,
  fontWeight: 600,
  fontFamily: "inherit",
  cursor: "pointer",
};
