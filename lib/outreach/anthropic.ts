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
  // Playwright E2E shim — return a deterministic canned draft instead
  // of hitting Anthropic when the test env opts in. Never set this in
  // production. The output is shaped exactly like a real generation
  // so downstream parsing + persistence paths run identically.
  if (process.env.PLAYWRIGHT_TEST_MODE === "true") {
    return {
      subject: `Test subject for ${donor.name}`,
      body: `Hi ${donor.name},\n\nThis is a deterministic test draft generated for the Playwright E2E suite. It exists so the outreach test can verify the full persistence pipeline without burning real Anthropic credits.\n\nWarmly,\n${campaign.senderName ?? "DonorLume"}`,
      usage: {
        input_tokens: 0,
        output_tokens: 0,
        cache_creation_input_tokens: 0,
        cache_read_input_tokens: 0,
        server_tool_use: null,
        service_tier: null,
      } as unknown as Anthropic.Usage,
    };
  }

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
