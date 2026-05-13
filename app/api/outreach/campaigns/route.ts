import { NextResponse } from "next/server";
import { z } from "zod";

import { notifyAdmin } from "@/lib/notifications/admin";
import { prisma } from "@/lib/prisma";
import { withOrg } from "@/lib/with-org";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const createSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  tone: z.string().min(1).max(40),
  emailType: z.string().min(1).max(40),
  campaignName: z.string().max(200).optional().nullable(),
  customInstructions: z.string().max(2000).optional().nullable(),
});

/**
 * POST /api/outreach/campaigns
 * Creates an OutreachCampaign row for the current org with the
 * schema-bound fields (tone / emailType / campaignName / customInstructions).
 *
 * The per-campaign org overrides (orgName, mission, senderName, senderTitle)
 * are NOT stored on the campaign — Spec §3's OutreachCampaign model has
 * no `metadata` column. They flow through each draft-generation request
 * and are persisted on the resulting OutreachDraft.metadata, which is
 * the source of truth on regenerate.
 */
export const POST = withOrg(async (req, { auth }) => {
  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = createSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const data = parsed.data;

  const autoName =
    data.name?.trim() ||
    `${data.emailType.replace("_", " ")} — ${new Date().toLocaleDateString(
      "en-US",
      { month: "short", day: "numeric", year: "numeric" },
    )}`;

  // Snapshot — used after create to fire the "first campaign" Slack ping.
  const priorCampaignCount = await prisma.outreachCampaign.count({
    where: { orgId: auth.org.id },
  });

  const campaign = await prisma.outreachCampaign.create({
    data: {
      orgId: auth.org.id,
      name: autoName,
      tone: data.tone,
      emailType: data.emailType,
      campaign: data.campaignName ?? null,
      customInstructions: data.customInstructions ?? null,
    },
  });

  if (priorCampaignCount === 0) {
    notifyAdmin("first-campaign", {
      orgName: auth.org.name,
      campaignName: campaign.name,
      // Draft count is not known at creation; the drafts route increments
      // totalDrafts as Claude calls finish. Reporting 0 here keeps the
      // signal "first campaign initiated".
      draftsRequested: 0,
    });
  }

  return NextResponse.json(
    {
      campaign,
      // Onboarding signal — caller fires the "step complete" toast.
      firstCampaign: priorCampaignCount === 0,
    },
    { status: 201 },
  );
});
