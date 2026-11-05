/**
 * Anthropic SDK singleton + outreach generation helper.
 * Server-only — never import this from a Client Component.
 */

import "server-only";

import Anthropic from "@anthropic-ai/sdk";

import type { QuickStart } from "@/lib/assistants/catalog";
import {
  buildAssistantSystemPrompt,
  buildAssistantUserPrompt,
  maxTokensFor,
  type AssistantContext,
} from "@/lib/assistants/prompt";
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
): Promise<{
  subject: string;
  body: string;
  usage: Anthropic.Usage;
  /**
   * Test mode only: the exact prompt that WOULD have been sent, so the
   * Playwright suite can assert what context grounded the draft.
   * Never populated on the real Anthropic path.
   */
  testPrompt?: { system: string; user: string };
}> {
  // Playwright E2E shim — return a deterministic canned draft instead
  // of hitting Anthropic when the test env opts in. The flag is
  // refused in production (NODE_ENV === "production") so it can't
  // accidentally short-circuit a real customer send if someone leaks
  // the env var into a prod deploy — fail loud with a thrown error
  // instead of silently serving canned text. The output is shaped
  // exactly like a real generation so downstream parsing +
  // persistence paths run identically.
  if (process.env.PLAYWRIGHT_TEST_MODE === "true") {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "PLAYWRIGHT_TEST_MODE cannot be enabled in production. Remove it from the deployment environment before retrying.",
      );
    }
    return {
      testPrompt: {
        system: buildSystemPrompt(campaign)
          .map((b) => b.text)
          .join("\n"),
        user: buildUserPrompt(donor, campaign.emailType, {
          startingDraft: !!campaign.startingDraft?.trim(),
        }),
      },
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
        content: buildUserPrompt(donor, campaign.emailType, {
          startingDraft: !!campaign.startingDraft?.trim(),
        }),
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

// ─── AI Assistants hub (Phase 1 Feature 2) ─────────────────────────────
// Same client, model, and PLAYWRIGHT_TEST_MODE shim as outreach drafts —
// one AI pipeline, not two.

/**
 * Test mode only: notes containing this marker make the canned Campaign
 * Creator output unstructured, so the suite can exercise the raw-text
 * fallback. Inert outside the (production-guarded) test shim.
 */
export const TEST_UNSTRUCTURED_MARKER = "PLAYWRIGHT_UNSTRUCTURED";

export async function generateAssistantContent(
  quickStart: QuickStart,
  context: AssistantContext,
  notes: string | null,
): Promise<{
  text: string;
  usage: Anthropic.Usage;
  testPrompt?: { system: string; user: string };
}> {
  const system = buildAssistantSystemPrompt(context, quickStart);
  const user = buildAssistantUserPrompt(quickStart, notes);

  if (process.env.PLAYWRIGHT_TEST_MODE === "true") {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "PLAYWRIGHT_TEST_MODE cannot be enabled in production. Remove it from the deployment environment before retrying.",
      );
    }
    return {
      testPrompt: { system: system.map((b) => b.text).join("\n"), user },
      text: cannedAssistantText(quickStart, context, notes),
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

  const response = await getAnthropic().messages.create({
    model: OUTREACH_MODEL,
    max_tokens: maxTokensFor(quickStart),
    system,
    messages: [{ role: "user", content: user }],
  });
  const text = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
  return { text, usage: response.usage };
}

/** Deterministic test-mode output, shaped like a real generation per format. */
function cannedAssistantText(
  q: QuickStart,
  c: AssistantContext,
  notes: string | null,
): string {
  const sig = c.senderName ?? `The ${c.orgName} Team`;
  switch (q.format) {
    case "email":
      return `Subject: Test ${q.label.toLowerCase()} from ${c.orgName}\n\nDear friend,\n\nThis is a deterministic ${q.label.toLowerCase()} for the Playwright suite. A gift of $25 goes to work right away.\n\nWarmly,\n${sig}`;
    case "social":
      return `This Giving Tuesday, stand with ${c.orgName}. Any gift, $5 or $500, keeps our work going in ${c.communityServed}. #GivingTuesday #GiveBack`;
    case "blurb":
      return `What we're focused on this season\n\nThis is a deterministic newsletter blurb for the Playwright suite about ${c.focusAreas.join(" and ")}.`;
    case "campaign":
      if (notes?.includes(TEST_UNSTRUCTURED_MARKER)) {
        return `Here is a campaign idea for ${c.orgName}.\n\nStart with a teaser, follow with the main ask, and close with a thank-you. This text deliberately skips the structured format.`;
      }
      return [
        "CAMPAIGN BRIEF",
        `Audience: Supporters of ${c.orgName} in ${c.communityServed}.`,
        "Message arc: Gratitude first, then a story, then a clear ask.",
        "Timeline: Day 1: Launch email",
        "Day 7: Story email",
        "Day 14: Final ask",
        "",
        "EMAIL 1",
        "Send: Day 1, morning",
        "Subject: Test launch email",
        "",
        `Dear friend,\n\nThis is test email one.\n\nWarmly,\n${sig}`,
        "",
        "EMAIL 2",
        "Send: Day 7, morning",
        "Subject: Test story email",
        "",
        `Dear friend,\n\nThis is test email two.\n\nWarmly,\n${sig}`,
        "",
        "EMAIL 3",
        "Send: Day 14, evening",
        "Subject: Test final ask",
        "",
        `Dear friend,\n\nThis is test email three. A gift of $10 helps.\n\nWarmly,\n${sig}`,
      ].join("\n");
  }
}
