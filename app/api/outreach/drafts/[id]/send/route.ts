import { NextResponse } from "next/server";

import { sendOutreachEmail } from "@/lib/email/send";
import { prisma } from "@/lib/prisma";
import { withOrg } from "@/lib/with-org";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/outreach/drafts/{id}/send
 *
 * Sends the draft via Resend. Multi-tenant safe: verifies the draft's
 * campaign belongs to the calling org before sending.
 *
 * Returns 200 with the post-send draft snapshot (status / sentAt /
 * messageId / trackingId). Returns 409 if the draft was already sent.
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
    if (!draft.recipientEmail) {
      return NextResponse.json(
        { error: "Draft has no recipient email." },
        { status: 422 },
      );
    }
    if (draft.status === "BOUNCED") {
      return NextResponse.json(
        { error: "This draft previously bounced. Edit the recipient and retry." },
        { status: 409 },
      );
    }

    try {
      // Snapshot pre-send count for the onboarding "first send" toast.
      const priorSentCount = await prisma.outreachDraft.count({
        where: {
          campaign: { orgId: auth.org.id },
          messageId: { not: null },
        },
      });

      const outcome = await sendOutreachEmail(draft);

      if (outcome.kind === "missing-recipient") {
        return NextResponse.json(
          { error: "Draft has no recipient email." },
          { status: 422 },
        );
      }
      if (outcome.kind === "already-sent") {
        return NextResponse.json(
          { error: "This draft has already been sent." },
          { status: 409 },
        );
      }

      const fresh = await prisma.outreachDraft.findUniqueOrThrow({
        where: { id: draft.id },
        select: {
          id: true,
          status: true,
          sentAt: true,
          messageId: true,
          trackingId: true,
        },
      });
      return NextResponse.json({
        draft: fresh,
        firstSend: priorSentCount === 0,
      });
    } catch (e) {
      const message =
        e instanceof Error ? e.message : "Failed to send email.";
      const isConfig = message.includes("RESEND_API_KEY") || message.includes("EMAIL_FROM");
      return NextResponse.json(
        { error: message },
        { status: isConfig ? 500 : 502 },
      );
    }
  },
);
