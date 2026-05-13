/**
 * Anthropic SDK singleton + outreach generation helper.
 * Server-only — never import this from a Client Component.
 */

import "server-only";

import Anthropic from "@anthropic-ai/sdk";

import {
  buildSystemPrompt,
  buildUserPrompt,
  parseDraft,
  type CampaignConfig,
  type DonorContext,
} from "@/lib/outreach/prompt";

let client: Anthropic | null = null;

export function getAnthropic(): Anthropic {
  if (client) return client;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY is not set. Add it to .env (https://console.anthropic.com/settings/keys).",
    );
  }
  client = new Anthropic({ apiKey });
  return client;
}

/**
 * Latest Sonnet — note this is `claude-sonnet-4-6`, not the spec's
 * `claude-sonnet-4-20250514` (deprecated). Recorded in CLAUDE.md.
 */
export const OUTREACH_MODEL = "claude-sonnet-4-6";

export async function generateDraft(
  campaign: CampaignConfig,
  donor: DonorContext,
): Promise<{ subject: string; body: string; usage: Anthropic.Usage }> {
  const anthropic = getAnthropic();

  const response = await anthropic.messages.create({
    model: OUTREACH_MODEL,
    max_tokens: 1024,
    system: buildSystemPrompt(campaign),
    messages: [
      {
        role: "user",
        content: buildUserPrompt(donor, campaign.emailType),
      },
    ],
  });

  const text = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();

  const { subject, body } = parseDraft(text);
  return { subject, body, usage: response.usage };
}
