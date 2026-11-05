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

import {
  PROMPT_TIME_ZONE,
  formatPromptDate,
  linkRuleFor,
  signatureRuleFor,
  writingRules,
} from "@/lib/ai/writing-rules";

export type CampaignConfig = {
  orgName: string;
  mission: string;
  /**
   * Organization Profile grounding (Phase 1 Feature 1) — read server-side
   * from /settings/organization on every generation, never from the
   * client. See lib/org-profile.ts `promptProfileFrom`.
   */
  communityServed?: string | null;
  focusAreas?: string[];
  /** Org's external giving page (http(s), normalized). Null → no links allowed. */
  donationPageUrl?: string | null;
  campaignName?: string | null;
  senderName?: string | null;
  senderTitle?: string | null;
  tone: string;
  emailType: string;
  customInstructions?: string | null;
  /**
   * An email the user brought from the Assistants hub and approved in
   * the "Starting draft" field. When set, each donor's email is this
   * draft personalized — not a fresh composition. Campaign-stable, so
   * it lives in the (cached) system prompt.
   */
  startingDraft?: string | null;
  /**
   * "Now" for the prompt's date line. Defaults to the real current time;
   * injectable so callers/tests can pin it. Changes at most once a day,
   * so the system prompt stays byte-stable within a campaign run.
   */
  today?: Date;
};

// Date helpers moved to the shared writing-rules module; re-exported
// so existing imports (tests, callers) keep working.
export { PROMPT_TIME_ZONE, formatPromptDate };

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
  const signatureRule = signatureRuleFor(c);
  const donationUrl = c.donationPageUrl?.trim() || null;
  const linkRule = linkRuleFor(donationUrl, "email");
  const tone = TONE_LABEL[c.tone] ?? c.tone;
  const type = TYPE_LABEL[c.emailType] ?? c.emailType;

  const text = [
    `You are a nonprofit fundraising expert writing personalized donor communications for ${c.orgName}.`,
    "",
    "Organization context:",
    `- Mission: ${c.mission}`,
    ...(c.communityServed?.trim()
      ? [`- Community served: ${c.communityServed.trim()}`]
      : []),
    ...(c.focusAreas && c.focusAreas.length > 0
      ? [`- Focus areas: ${c.focusAreas.join(", ")}`]
      : []),
    ...(donationUrl ? [`- Donation page: ${donationUrl}`] : []),
    `- Current campaign: ${c.campaignName?.trim() || "General fund"}`,
    `- Sender: ${senderLine}`,
    `- Today's date: ${formatPromptDate(c.today ?? new Date())}`,
    "",
    "Rules:",
    "- Output the literal Subject: line first, then a blank line, then the body.",
    "- Personalize using the donor's history and notes.",
    "- Ground the email in the organization context above: speak from the mission, name the community served where it fits naturally, and keep any impact story within the focus areas.",
    ...writingRules({
      factSources: "the organization context or the donor's notes",
    }),
    "- Adjust approach by donor type (Individual / Foundation / Corporate).",
    "- Keep it under 250 words.",
    "- No placeholder brackets or template tokens.",
    linkRule,
    signatureRule,
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
    ...startingDraftBlock(c.startingDraft),
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

/** Max length of a starting draft (UI, API schema, and prompt agree). */
export const MAX_STARTING_DRAFT_LENGTH = 5000;

function startingDraftBlock(draft?: string | null): string[] {
  const text = draft?.trim().slice(0, MAX_STARTING_DRAFT_LENGTH);
  if (!text) return [];
  return [
    "",
    "Starting draft — written and approved by the user. Every email in this campaign is this draft, personalized for one donor:",
    "<<<",
    text,
    ">>>",
    "- Keep the starting draft's message, structure, length, and ask. Personalize it for the donor: greet them by name and weave in their history or segments where they fit naturally. Keep the subject close to the draft's subject line if it has one.",
    "- Facts stated in the starting draft count as organization context.",
    "- All rules above still apply. If the starting draft breaks one (for example a spelled-out dollar amount, markdown, or a placeholder), fix only that part.",
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

export function buildUserPrompt(
  d: DonorContext,
  emailType: string,
  opts: { startingDraft?: boolean } = {},
): string {
  const fmt$ = (n?: number | null) =>
    n == null ? "—" : `$${n.toLocaleString()}`;
  const attendee = isAttendee(d);
  // First-touch reactivation framing applies to lapsed donors only —
  // attendees route through the conversion block above. Best-practice
  // win-back sequencing is thank → story → soft ask (or no ask at
  // all) on the first touch; the hard ask comes later in the series.
  const lapsedReactivation = !attendee && emailType === "reactivation";

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
    opts.startingDraft
      ? // The user's approved draft replaces the email-type framings
        // below; keep only the guardrails that protect the donor.
        [
          attendee
            ? "This person has not given yet. Do not imply prior gifts: no 'welcome back', 'renew', 'continue your generosity', or similar."
            : "Do not mention a gap in their giving or use guilt phrasing such as 'we haven't seen you in a while'.",
          "",
          "Personalize the starting draft for this donor now.",
        ].join("\n")
      : attendee
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
      : lapsedReactivation
        ? // First-touch lapsed-donor reactivation — gratitude-first
          // sequence. The whole point of this email is reconnection
          // and goodwill; the conversion ask belongs in a follow-up.
          [
            "FIRST-TOUCH REACTIVATION — this is the first re-engagement email after a gap in giving. DO NOT lead with a donation ask. Follow the gratitude-first sequence:",
            "",
            "1. THANK FIRST. Open by thanking them specifically for their past support. Reference what their giving made possible at their scale of generosity. If lifetime totals, largest gift, or segment tags suggest a particular era of involvement (gala year, capital campaign, sustained monthly giving), name it warmly.",
            "2. STORY SECOND. Share ONE concrete impact moment they should know about — a specific person served, a milestone reached, a program launched. Tie the story back to the kind of support they once provided (\"supporters like you funded the X that made Y possible\"). No vague mission statements. No 'look how much we've grown' org updates.",
            "3. SOFT LANDING. End with either no ask, or a single low-pressure invitation line (e.g. \"If you'd ever like to be part of this next chapter, the door is always open\" / \"We'd love to share more whenever you're ready\"). Do NOT include a suggested donation amount, a 'donate now' button mention, or any urgency framing.",
            "",
            "Subject line: warm and invitational. Good: \"Something we wanted you to share\", \"An update we owe you\", \"Thinking of you\", \"What your support made possible\". Bad: \"We miss you\", \"Come back\", \"Renew today\", \"We need you\".",
            "",
            "Do NOT use phrases that fish for guilt or call attention to the gap: 'we haven't seen you in a while', 'where have you been', 'your absence has been felt', 'it's been too long', 'won't you renew', 'your gift today'. Do NOT mention the lapsed months or 'last gift' interval directly.",
            "",
            "The goal is reconnection and goodwill, not conversion. A second, ask-bearing email comes later in the series.",
            "",
            "Write the personalized first-touch reactivation email now.",
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
