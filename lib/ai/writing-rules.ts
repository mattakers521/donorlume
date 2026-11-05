/**
 * Writing rules shared by every AI prompt in DonorLume — outreach
 * drafts (lib/outreach/prompt.ts) and the Assistants hub
 * (lib/assistants/prompt.ts). One source so the two can't drift:
 * today's date, no invented facts or claims, plain text only, and
 * dollar amounts written as digits.
 *
 * Pure module (no `server-only`) so the Playwright suite can import it.
 */

/**
 * Time zone for the prompt's "today". Pinned explicitly (not the
 * server's zone — Vercel runs in UTC) so an evening draft in the US
 * doesn't show tomorrow's date. Handles EST/EDT automatically.
 */
export const PROMPT_TIME_ZONE = "America/New_York";

/** Human-readable date for prompts, e.g. "Wednesday, November 4, 2026". */
export function formatPromptDate(d: Date): string {
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: PROMPT_TIME_ZONE,
  });
}

export const DATE_RULE =
  "- Use today's date above for any mention of the current year, season, or upcoming dates. Never guess the year.";

export const DOLLAR_RULE =
  '- Write every dollar amount as digits with a dollar sign, such as $5, $10, $25, or $1,000. Never spell amounts out in words (not "five dollars" or "twenty-five dollars").';

export const PLAIN_TEXT_RULE =
  "- Write in plain text only. No markdown or formatting characters: no asterisks, underscores, pound signs, or backticks; no bold or italics; no bullet symbols or bulleted lists. Use ordinary sentences and paragraphs — emails are sent as plain text, so any such characters show up literally.";

/** Social posts may carry hashtags; everything else in the plain-text rule still applies. */
export const PLAIN_TEXT_RULE_SOCIAL =
  "- Write in plain text only. No markdown or formatting characters: no asterisks, underscores, or backticks; no bold or italics; no bullet symbols or bulleted lists. Hashtags such as #GivingTuesday are welcome in this social post — that is the only allowed use of the pound sign.";

export type WritingRulesOptions = {
  /**
   * Where facts may come from, phrased to finish "…that ___ don't
   * support" and "…appears in ___", e.g. "the organization context or
   * the donor's notes".
   */
  factSources: string;
  /** Social posts allow hashtags. */
  allowHashtags?: boolean;
};

/** The shared rule lines, in prompt order. */
export function writingRules(o: WritingRulesOptions): string[] {
  return [
    DATE_RULE,
    `- Never invent programs, statistics, or people that ${o.factSources} don't support.`,
    `- Never state a financial, impact, or use-of-funds claim — what a gift amount buys, how many people were served, overhead or admin costs, or where the money goes (e.g. "every dollar stays right here", "100% goes directly to veterans") — unless that exact fact appears in ${o.factSources}. When no such fact is given, describe impact in general terms drawn from the mission.`,
    DOLLAR_RULE,
    o.allowHashtags ? PLAIN_TEXT_RULE_SOCIAL : PLAIN_TEXT_RULE,
  ];
}

/**
 * Signature spelled out verbatim so the model can't merge in a
 * different org name or title (seen in a real VETLIFE test draft).
 */
export function signatureRuleFor(c: {
  orgName: string;
  senderName?: string | null;
  senderTitle?: string | null;
}): string {
  return c.senderName?.trim()
    ? `- Sign off with a short closing (e.g. "Warmly,") followed by the signature exactly as given: "${c.senderName.trim()}" on one line${c.senderTitle?.trim() ? `, then "${c.senderTitle.trim()}" on the next` : ""}. Do not add an organization name, change the title, or add anything after the signature.`
    : `- Sign off with a short closing (e.g. "Warmly,") followed by exactly "The ${c.orgName} Team". Do not invent a person's name or title.`;
}

/**
 * Links: only the org's saved donation page, verbatim — or none at all.
 * Without this the model writes "[donation link]" placeholders.
 * `medium` picks the no-link fallback: an email can say "reply to
 * this email"; a post or newsletter blurb can't.
 */
export function linkRuleFor(
  donationUrl: string | null,
  medium: "email" | "post",
): string {
  const noun = medium === "email" ? "email" : "piece";
  if (donationUrl) {
    return `- If the ${noun} invites a gift, link to the donation page exactly as written above. Never include any other URL, and never alter that one.`;
  }
  return medium === "email"
    ? "- No donation link is available. Do not include any URL, link, or link placeholder (such as [donation link]). If the email invites a gift, ask the reader to simply reply to this email to learn how to give."
    : "- No donation link is available. Do not include any URL, link, or link placeholder (such as [donation link]). If the piece invites a gift, invite readers to get in touch with the organization to learn how to give.";
}
