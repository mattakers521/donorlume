/**
 * AI Assistants hub — prompt assembly. Same shape as the outreach
 * prompt (system = org grounding + rules, user = the task) and the same
 * shared writing rules (lib/ai/writing-rules.ts), so assistants and
 * outreach drafts follow one set of constraints.
 *
 * Pure module so the Playwright suite can import it.
 */

import type Anthropic from "@anthropic-ai/sdk";

import {
  formatPromptDate,
  GREETING_RULE,
  linkRuleFor,
  signatureRuleFor,
  writingRules,
} from "@/lib/ai/writing-rules";
import { CAMPAIGN_FORMAT_INSTRUCTIONS } from "@/lib/assistants/campaign";
import {
  nextGivingTuesday,
  type QuickStart,
} from "@/lib/assistants/catalog";

export type AssistantContext = {
  orgName: string;
  mission: string;
  communityServed: string;
  focusAreas: string[];
  donationPageUrl: string | null;
  senderName: string | null;
  senderTitle: string | null;
  /**
   * The org's custom AI instructions from Preferences (OrgSettings) —
   * the same text outreach campaigns default to. Read server-side.
   */
  customInstructions?: string | null;
  /** Injectable for tests; defaults to now. */
  today?: Date;
};

export const MAX_NOTES_LENGTH = 1500;

/** Output-format rule per quick-start format. */
function formatRule(q: QuickStart): string {
  switch (q.format) {
    case "email":
      return "- Output the literal Subject: line first, then a blank line, then the body.";
    case "social":
      return "- Output only the post text. No subject line, no greeting, no signature.";
    case "blurb":
      return "- Output only the headline line and the paragraphs. No subject line, no greeting, no signature.";
    case "campaign":
      return "- Follow the output format in the task exactly.";
  }
}

export function buildAssistantSystemPrompt(
  c: AssistantContext,
  q: QuickStart,
): Anthropic.TextBlockParam[] {
  const today = c.today ?? new Date();
  const donationUrl = c.donationPageUrl?.trim() || null;
  const signs = q.format === "email" || q.format === "campaign";

  const text = [
    `You are a nonprofit fundraising expert writing communications for ${c.orgName}.`,
    "",
    "Organization context:",
    `- Mission: ${c.mission}`,
    `- Community served: ${c.communityServed}`,
    `- Focus areas: ${c.focusAreas.join(", ")}`,
    ...(donationUrl ? [`- Donation page: ${donationUrl}`] : []),
    `- Today's date: ${formatPromptDate(today)}`,
    ...(q.givingTuesday
      ? [`- Giving Tuesday this year: ${formatPromptDate(nextGivingTuesday(today))}`]
      : []),
    "",
    "Rules:",
    formatRule(q),
    "- Ground everything in the organization context above: speak from the mission, name the community served where it fits naturally, and keep any story within the focus areas.",
    ...writingRules({
      factSources: "the organization context or the user's notes",
      allowHashtags: q.format === "social",
    }),
    "- No placeholder brackets or template tokens (no [Name], [Date], or {first_name}). Write copy that is ready to use as-is.",
    linkRuleFor(donationUrl, q.format === "email" || q.format === "campaign" ? "email" : "post"),
    ...(signs ? [GREETING_RULE, signatureRuleFor(c)] : []),
    // Same placement and wording as the outreach prompt.
    ...(c.customInstructions?.trim()
      ? ["", `Additional instructions: ${c.customInstructions.trim()}`]
      : []),
  ].join("\n");

  return [{ type: "text", text }];
}

export function buildAssistantUserPrompt(
  q: QuickStart,
  notes?: string | null,
): string {
  const trimmed = notes?.trim();
  return [
    `Task: ${q.task}`,
    ...(trimmed
      ? [
          "",
          "Notes from the user (details to include — treat them as facts you may use):",
          trimmed.slice(0, MAX_NOTES_LENGTH),
        ]
      : []),
    ...(q.format === "campaign" ? ["", CAMPAIGN_FORMAT_INSTRUCTIONS] : []),
  ].join("\n");
}

/** Max output tokens per format — a campaign is a brief plus three emails. */
export function maxTokensFor(q: QuickStart): number {
  return q.format === "campaign" ? 4096 : 1024;
}
