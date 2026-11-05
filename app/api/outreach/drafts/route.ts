import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { z } from "zod";

import { checkAiCap } from "@/lib/billing/ai-usage";
import { generateDraft } from "@/lib/outreach/anthropic";
import { EMPTY_PROMPT_PROFILE, promptProfileFrom } from "@/lib/org-profile";
import type {
  CampaignConfig,
  DonorContext,
} from "@/lib/outreach/prompt";
import { prisma } from "@/lib/prisma";
import { withOrg } from "@/lib/with-org";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const donorSchema = z.object({
  name: z.string().min(1).max(300),
  email: z.string().max(300).optional().nullable(),
  donorType: z.string().max(100).optional().nullable(),
  totalGifts: z.number().int().nonnegative().nullable().optional(),
  totalGiven: z.number().nullable().optional(),
  largestGift: z.number().nullable().optional(),
  averageGift: z.number().nullable().optional(),
  lastGiftLabel: z.string().max(60).optional().nullable(),
  lapsedMonths: z.number().int().nullable().optional(),
  reactivationScore: z.number().int().min(0).max(100).nullable().optional(),
  tier: z.string().max(40).optional().nullable(),
  activeElsewhere: z.boolean().nullable().optional(),
  notes: z.string().max(2000).optional().nullable(),
  /** Cohort names threaded through to the AI prompt (Spec §7). */
  cohorts: z.array(z.string().max(200)).max(50).optional().default([]),
});

const promptConfigSchema = z.object({
  orgName: z.string().min(1).max(200),
  mission: z.string().min(1).max(2000),
  senderName: z.string().max(120).optional().nullable(),
  senderTitle: z.string().max(120).optional().nullable(),
});

const generateSchema = z.object({
  campaignId: z.string().min(1),
  donor: donorSchema,
  /** Real Donor.id (from a DonorList in the org) — null for sample donors. */
  donorId: z.string().nullable().optional(),
  promptConfig: promptConfigSchema,
});

/**
 * POST /api/outreach/drafts
 *
 * Generates one personalized email via Claude, persists it as an
 * OutreachDraft row, and returns the saved draft. The client invokes this
 * once per selected donor, driving the progress bar from successive
 * resolutions. Multi-tenant safe: the campaign's orgId must match the
 * caller, and any real donorId must belong to a DonorList in this org.
 */
export const POST = withOrg(async (req, { auth }) => {
  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = generateSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const { campaignId, donor, donorId, promptConfig } = parsed.data;

  const campaign = await prisma.outreachCampaign.findFirst({
    where: { id: campaignId, orgId: auth.org.id },
  });
  if (!campaign) {
    return NextResponse.json(
      { error: "Campaign not found" },
      { status: 404 },
    );
  }

  // ─── AI cap ──────────────────────────────────────────────────────────
  // Shared with the Assistants hub (lib/billing/ai-usage.ts): unpaid
  // trials get a lifetime cap, paid plans a monthly one. Checked on
  // every draft so the client's sequential per-donor loop gets a clean
  // mid-batch stop with a 402 the moment the cap is hit.
  const capBlock = await checkAiCap(auth.org);
  if (capBlock) {
    return NextResponse.json(capBlock, { status: 402 });
  }

  // If donorId is supplied, verify it belongs to a DonorList owned by
  // this org. deleteMany-style scoping in a count query keeps the
  // multi-tenant guard structural.
  if (donorId) {
    const ownedDonor = await prisma.donor.findFirst({
      where: { id: donorId, donorList: { orgId: auth.org.id } },
      select: { id: true },
    });
    if (!ownedDonor) {
      return NextResponse.json(
        { error: "Donor not found in this org" },
        { status: 404 },
      );
    }
  }

  // Pull the Organization Profile server-side (scoped to the caller's
  // org) so edits on /settings/organization ground the very next draft
  // without the client re-passing anything — and so a client can't
  // inject someone else's profile.
  const orgRow = await prisma.organization.findUnique({
    where: { id: auth.org.id },
    select: {
      communityServed: true,
      focusAreas: true,
      donationPageUrl: true,
      causeArea: true,
    },
  });
  const profile = orgRow
    ? promptProfileFrom(orgRow)
    : EMPTY_PROMPT_PROFILE;

  const config: CampaignConfig = {
    orgName: promptConfig.orgName,
    mission: promptConfig.mission,
    communityServed: profile.communityServed,
    focusAreas: profile.focusAreas,
    donationPageUrl: profile.donationPageUrl,
    campaignName: campaign.campaign,
    senderName: promptConfig.senderName ?? null,
    senderTitle: promptConfig.senderTitle ?? null,
    tone: campaign.tone,
    emailType: campaign.emailType,
    customInstructions: campaign.customInstructions,
  };

  const donorCtx: DonorContext = donor;

  let subject: string;
  let body: string;
  let testPrompt: { system: string; user: string } | undefined;
  try {
    const result = await generateDraft(config, donorCtx);
    subject = result.subject;
    body = result.body;
    testPrompt = result.testPrompt;
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

  // Persist + bump campaign counter atomically.
  const draftMetadata: Prisma.InputJsonValue = {
    donor: donorCtx as Prisma.InputJsonValue,
    promptConfig: promptConfig as Prisma.InputJsonValue,
  };

  const [draft] = await prisma.$transaction([
    prisma.outreachDraft.create({
      data: {
        campaignId: campaign.id,
        donorId: donorId ?? null,
        userId: auth.userId,
        recipientName: donor.name,
        recipientEmail: donor.email ?? null,
        subject,
        body,
        status: "DRAFT",
        metadata: draftMetadata,
      },
    }),
    prisma.outreachCampaign.update({
      where: { id: campaign.id },
      data: { totalDrafts: { increment: 1 } },
    }),
  ]);

  // `testPrompt` is only ever set by the PLAYWRIGHT_TEST_MODE shim,
  // which itself refuses to run when NODE_ENV === "production".
  return NextResponse.json(
    testPrompt ? { draft, testPrompt } : { draft },
    { status: 201 },
  );
});
