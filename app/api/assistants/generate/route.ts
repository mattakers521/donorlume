import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { z } from "zod";

import { parseCampaign } from "@/lib/assistants/campaign";
import { findQuickStart } from "@/lib/assistants/catalog";
import { MAX_NOTES_LENGTH } from "@/lib/assistants/prompt";
import { checkAiCap, trialAiUsage } from "@/lib/billing/ai-usage";
import {
  isProfileGrounded,
  missingGroundingFields,
  promptProfileFrom,
} from "@/lib/org-profile";
import { generateAssistantContent } from "@/lib/outreach/anthropic";
import { parseDraft } from "@/lib/outreach/prompt";
import { prisma } from "@/lib/prisma";
import { withOrg } from "@/lib/with-org";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  assistantId: z.string().min(1).max(60),
  quickStartId: z.string().min(1).max(60),
  notes: z.string().max(MAX_NOTES_LENGTH).optional().nullable(),
});

/**
 * POST /api/assistants/generate — one Assistants-hub generation.
 *
 * Order matters: profile gate (409) before the AI cap (402) before any
 * Anthropic call, so an empty profile never burns a draft and never
 * produces silent generic output. The profile is read server-side,
 * scoped to the caller's org — the client can't supply grounding.
 *
 * Counts as exactly ONE toward the AI cap, whatever the format.
 */
export const POST = withOrg(async (req, { auth }) => {
  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const { assistantId, quickStartId, notes } = parsed.data;
  const found = findQuickStart(assistantId, quickStartId);
  if (!found) {
    return NextResponse.json(
      { error: "Unknown assistant or quick-start" },
      { status: 404 },
    );
  }
  const { quickStart } = found;

  const [org, settings, user] = await Promise.all([
    prisma.organization.findUniqueOrThrow({
      where: { id: auth.org.id },
      select: {
        name: true,
        mission: true,
        communityServed: true,
        focusAreas: true,
        website: true,
        donationPageUrl: true,
        logo: true,
        causeArea: true,
      },
    }),
    prisma.orgSettings.findUnique({
      where: { orgId: auth.org.id },
      select: { senderName: true, senderTitle: true, customInstructions: true },
    }),
    prisma.user.findUnique({
      where: { id: auth.userId },
      select: { name: true },
    }),
  ]);

  if (!isProfileGrounded(org)) {
    const missing = missingGroundingFields(org).map((f) => f.label);
    return NextResponse.json(
      {
        error:
          "Complete your organization profile first — assistants write from your mission, community served, and focus areas.",
        code: "profile_incomplete",
        missing,
      },
      { status: 409 },
    );
  }

  const capBlock = await checkAiCap(auth.org);
  if (capBlock) {
    return NextResponse.json(capBlock, { status: 402 });
  }

  const profile = promptProfileFrom(org);
  let result: Awaited<ReturnType<typeof generateAssistantContent>>;
  try {
    result = await generateAssistantContent(
      quickStart,
      {
        orgName: org.name,
        mission: org.mission!.trim(),
        communityServed: profile.communityServed!,
        focusAreas: profile.focusAreas,
        donationPageUrl: profile.donationPageUrl,
        senderName: settings?.senderName?.trim() || user?.name?.trim() || null,
        senderTitle: settings?.senderTitle?.trim() || null,
        // Preferences → custom AI instructions, as outreach uses them.
        customInstructions: settings?.customInstructions?.trim() || null,
      },
      notes ?? null,
    );
  } catch (e) {
    if (e instanceof Anthropic.APIError) {
      return NextResponse.json(
        { error: `Claude: ${e.message}` },
        { status: e.status ?? 502 },
      );
    }
    if (e instanceof Error && e.message.includes("ANTHROPIC_API_KEY")) {
      return NextResponse.json({ error: e.message }, { status: 500 });
    }
    throw e;
  }

  // Usage ledger only — the content itself is never stored.
  await prisma.aiGeneration.create({
    data: {
      orgId: auth.org.id,
      userId: auth.userId,
      assistant: assistantId,
      quickStart: quickStartId,
    },
  });

  const output =
    quickStart.format === "email"
      ? { kind: "email" as const, ...parseEmail(result.text) }
      : quickStart.format === "campaign"
        ? { kind: "campaign" as const, campaign: parseCampaign(result.text) }
        : { kind: "text" as const, text: result.text };

  return NextResponse.json({
    format: quickStart.format,
    output,
    trialUsed: await trialAiUsage(auth.org),
    // Only ever set by the production-guarded PLAYWRIGHT_TEST_MODE shim.
    ...(result.testPrompt && { testPrompt: result.testPrompt }),
  });
});

/** "Subject: …" + body; without a Subject line the whole text is the body. */
function parseEmail(text: string): { subject: string; body: string } {
  return /^Subject:/im.test(text.trim())
    ? parseDraft(text)
    : { subject: "", body: text.trim() };
}
