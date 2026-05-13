import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";

import { generateDraft } from "@/lib/outreach/anthropic";
import type {
  CampaignConfig,
  DonorContext,
} from "@/lib/outreach/prompt";
import { prisma } from "@/lib/prisma";
import { withOrg } from "@/lib/with-org";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type DraftMetadata = {
  donor: DonorContext;
  promptConfig: {
    orgName: string;
    mission: string;
    senderName?: string | null;
    senderTitle?: string | null;
  };
};

/**
 * POST /api/outreach/drafts/{id}/regenerate
 *
 * Re-runs Claude against the donor + promptConfig snapshot stored in the
 * draft's `metadata`, then mutates the same draft row in place. This
 * lets the user keep clicking "Regenerate" until they're happy without
 * spawning new rows.
 */
export const POST = withOrg<{ id: string }>(
  async (_req, { params, auth }) => {
    const { id } = await params;

    const draft = await prisma.outreachDraft.findFirst({
      where: { id, campaign: { orgId: auth.org.id } },
      include: { campaign: true },
    });
    if (!draft) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const meta = draft.metadata as unknown as DraftMetadata | null;
    if (!meta?.donor || !meta?.promptConfig) {
      return NextResponse.json(
        {
          error:
            "This draft is missing the donor / prompt snapshot needed to regenerate.",
        },
        { status: 422 },
      );
    }

    const config: CampaignConfig = {
      orgName: meta.promptConfig.orgName,
      mission: meta.promptConfig.mission,
      campaignName: draft.campaign.campaign,
      senderName: meta.promptConfig.senderName ?? null,
      senderTitle: meta.promptConfig.senderTitle ?? null,
      tone: draft.campaign.tone,
      emailType: draft.campaign.emailType,
      customInstructions: draft.campaign.customInstructions,
    };

    let subject: string;
    let body: string;
    try {
      const result = await generateDraft(config, meta.donor);
      subject = result.subject;
      body = result.body;
    } catch (e) {
      if (e instanceof Anthropic.APIError) {
        return NextResponse.json(
          { error: `Claude: ${e.message}` },
          { status: e.status ?? 502 },
        );
      }
      throw e;
    }

    const updated = await prisma.outreachDraft.update({
      where: { id: draft.id },
      data: { subject, body, status: "DRAFT" },
    });

    return NextResponse.json({ draft: updated });
  },
);
