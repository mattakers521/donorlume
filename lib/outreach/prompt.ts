/**
 * AI Outreach prompt builder — splits the campaign-stable system prompt
 * (org name, mission, sender, tone, type, custom instructions) from the
 * per-donor user prompt. The system prompt carries `cache_control` so
 * later donors in the same campaign hit the cache instead of paying full
 * input price. Per `shared/prompt-caching.md`, caching is a prefix match,
 * so the system prompt MUST be byte-stable across donors in a campaign —
 * no timestamps, no per-donor data leaking in.
 *
 * Mirrors Spec §5 and the prototype's `bp` builder (donorluma-app.jsx:592)
 * but adopts the spec's structured system+user split.
 */

import type Anthropic from "@anthropic-ai/sdk";

export type CampaignConfig = {
  orgName: string;
  mission: string;
  /** From /settings/organization. Used by the AI to anchor audience and tone. */
  causeArea?: string | null;
  campaignName?: string | null;
  senderName?: string | null;
  senderTitle?: string | null;
  tone: string;
  emailType: string;
  customInstructions?: string | null;
};

export type DonorContext = {
  name: string;
  email?: string | null;
  donorType?: string | null;
  totalGifts?: number | null;
  totalGiven?: number | null;
  largestGift?: number | null;
  averageGift?: number | null;
  lastGiftLabel?: string | null; // human-readable e.g. "Jan 2024"
  lapsedMonths?: number | null;
  reactivationScore?: number | null;
  tier?: string | null;
  activeElsewhere?: boolean | null;
  notes?: string | null;
  /** Cohort display names this donor belongs to (Phase 2 — AI prompt enhancement). */
  cohorts?: string[];
};

const TONE_LABEL: Record<string, string> = {
  warm: "Warm & Personal",
  professional: "Professional",
  impact: "Impact-Driven",
  casual: "Casual",
};

const TYPE_LABEL: Record<string, string> = {
  reactivation: "Reactivation",
  impact_update: "Impact Update",
  event_invite: "Event Invite",
  year_end: "Year-End Appeal",
};

export function buildSystemPrompt(
  c: CampaignConfig,
): Anthropic.TextBlockParam[] {
  const senderLine = c.senderName
    ? `${c.senderName}${c.senderTitle ? `, ${c.senderTitle}` : ""}`
    : "Development Team";
  const tone = TONE_LABEL[c.tone] ?? c.tone;
  const type = TYPE_LABEL[c.emailType] ?? c.emailType;

  const text = [
    `You are a nonprofit fundraising expert writing personalized donor communications for ${c.orgName}.`,
    "",
    "Organization context:",
    `- Mission: ${c.mission}`,
    ...(c.causeArea?.trim() ? [`- Cause area: ${c.causeArea.trim()}`] : []),
    `- Current campaign: ${c.campaignName?.trim() || "General fund"}`,
    `- Sender: ${senderLine}`,
    "",
    "Rules:",
    "- Output the literal Subject: line first, then a blank line, then the body.",
    "- Personalize using the donor's history and notes.",
    "- Adjust approach by donor type (Individual / Foundation / Corporate).",
    "- Keep it under 250 words.",
    "- No placeholder brackets or template tokens.",
    "- End with the sender's signature.",
    `- Tone: ${tone}`,
    `- Type: ${type}`,
    "",
    // Spec §7 — segment context. Tells the model what each segment label means
    // so it tailors voice + emphasis instead of using segments as adornment.
    "Segment context — each donor's SEGMENTS line lists relationship tags.",
    "Tailor the outreach to reflect their specific segments. For example:",
    "- Major Donor — emphasize impact, scale, and personal relationship.",
    "- Recurring Sustainer / monthly giver — acknowledge their ongoing commitment.",
    "- First-Time Donor — welcome warmly and reinforce the impact of their first gift.",
    "- Mid-Level or Small/Grassroots — connect to the community of supporters.",
    "- Lapsed (LYBUNT / SYBUNT) — acknowledge the gap honestly; invite back without guilt.",
    "- Legacy / Planned Giving Prospect — speak to long-term partnership and legacy.",
    "- Corporate / Foundation / DAF — frame as partnership; reference institutional value.",
    "- Gala Attendee / Volunteer / Board Member / event tags — reference the shared moment by name.",
    "When multiple segments apply, lead with the most distinctive (e.g. Major + Lapsed → reconnection at a major-gift level).",
    c.customInstructions?.trim()
      ? `\nAdditional instructions: ${c.customInstructions.trim()}`
      : "",
  ]
    .filter(Boolean)
    .join("\n");

  return [
    {
      type: "text",
      text,
      // Cache the campaign-stable preamble. Subsequent donors in the
      // same campaign read from cache (~0.1× cost). Below the model's
      // ~2K-token minimum the cache silently no-ops — see
      // `shared/prompt-caching.md`.
      cache_control: { type: "ephemeral" },
    },
  ];
}

/**
 * True when this donor record has no recorded giving signal — i.e. it
 * came in as an event attendee, mailing-list contact, or otherwise
 * "knows the org but hasn't given yet" row. The prompt flips into
 * first-time-donor-conversion mode for these recipients.
 */
function isAttendee(d: DonorContext): boolean {
  const noLastGift = !d.lastGiftLabel && d.lapsedMonths == null;
  const noTotals =
    (d.totalGifts == null || d.totalGifts === 0) &&
    (d.totalGiven == null || d.totalGiven === 0);
  return noLastGift && noTotals;
}

export function buildUserPrompt(d: DonorContext, emailType: string): string {
  const fmt$ = (n?: number | null) =>
    n == null ? "—" : `$${n.toLocaleString()}`;
  const attendee = isAttendee(d);

  const lines = [
    `DONOR: ${d.name}${d.donorType ? ` (${d.donorType})` : ""}`,
    d.cohorts && d.cohorts.length > 0
      ? `- SEGMENTS: ${d.cohorts.join(", ")}`
      : null,
    // Hide the giving-history bullets entirely for attendees so the AI
    // doesn't fill them with em-dashes that imply "we have no record"
    // when the truthful framing is "this person hasn't given yet."
    attendee
      ? null
      : `- ${d.totalGifts ?? "—"} gifts totaling ${fmt$(d.totalGiven)}`,
    attendee
      ? null
      : d.lastGiftLabel
        ? `- Last gift: ${d.lastGiftLabel}${d.lapsedMonths != null ? ` (${d.lapsedMonths} months ago)` : ""}`
        : null,
    attendee
      ? null
      : `- Largest: ${fmt$(d.largestGift)} | Average: ${fmt$(d.averageGift)}`,
    attendee
      ? null
      : d.reactivationScore != null
        ? `- Reactivation score: ${d.reactivationScore}/100${d.tier ? ` (${d.tier})` : ""}`
        : null,
    d.activeElsewhere != null && !attendee
      ? `- Active elsewhere: ${d.activeElsewhere ? "Yes" : "Unknown"}`
      : null,
    d.notes ? `- Notes: ${d.notes}` : null,
    attendee
      ? "- NO RECORDED GIFTS: this person is an event attendee or supporter who hasn't given yet."
      : null,
    "",
    attendee
      ? // First-time-donor conversion framing. Overrides the campaign-
        // level emailType (reactivation / impact_update / etc.) because
        // those framings assume prior giving — confusing for an attendee.
        [
          "FIRST-TIME CONVERSION CONTEXT — this recipient has not given yet.",
          "Write an invitation to make their first gift, not a reactivation or thank-you.",
          "Anchor on their EXISTING relationship (event attendance, segment tags) and use that as the bridge into giving.",
          "Do NOT use phrases like 'welcome back', 'come back', 'reactivate', 'renew', 'continue your generosity', 'as you've supported us before', or anything that implies prior gifts.",
          "Lead with impact + a concrete first-gift ask (suggested amount or a clear 'make your first gift' CTA).",
          "",
          `Write the personalized first-time-donor invitation email now.`,
        ].join("\n")
      : `Write the personalized ${TYPE_LABEL[emailType] ?? emailType} email now.`,
  ];
  return lines.filter(Boolean).join("\n");
}

/**
 * Parse "Subject: ...\n\n<body>" out of the model's response.
 * Falls back to the entire text as body when no Subject: line is found.
 */
export function parseDraft(raw: string): { subject: string; body: string } {
  const trimmed = raw.trim();
  const match = trimmed.match(/^Subject:\s*(.+)$/m);
  if (!match) return { subject: "Reconnecting", body: trimmed };
  const subject = match[1].trim();
  const after = trimmed.slice(match.index! + match[0].length).trim();
  return { subject, body: after };
}
