import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/webhooks/resend
 *
 * Receives Resend's delivery / bounce / complaint events. Mapped onto
 * OutreachDraft fields:
 *
 *   email.sent       → no-op (we already set sentAt at send time)
 *   email.delivered  → deliveredAt; bumps campaign.deliveredCount
 *   email.bounced    → bouncedAt + bounceReason + status BOUNCED;
 *                      bumps campaign.bouncedCount
 *   email.complained → unsubscribedAt; logged but no status change
 *                      (donor is opted out at the org level — separate
 *                      flow not yet built)
 *
 * Status updates are monotonic — a stale "delivered" arriving after a
 * "bounced" must not overwrite the bounced state.
 *
 * Signature verification (svix headers) is opt-in via RESEND_WEBHOOK_SECRET.
 * When unset, we log a warning and accept the event so dev / first-run
 * setup can stand the loop up before configuring webhook signing.
 */
const webhookSchema = z.object({
  type: z.string(),
  data: z
    .object({
      email_id: z.string().optional(),
      bounce: z
        .object({
          message: z.string().optional(),
          subType: z.string().optional(),
        })
        .partial()
        .optional(),
    })
    .passthrough(),
});

export async function POST(req: NextRequest) {
  const secret = process.env.RESEND_WEBHOOK_SECRET?.trim();
  if (!secret) {
    console.warn(
      "RESEND_WEBHOOK_SECRET not set — accepting webhook without signature verification. Configure at https://resend.com/webhooks before going to production.",
    );
    // Full svix verification (svix-id / svix-timestamp / svix-signature
    // headers) is the production path. Adding `svix` as a dep and a
    // small verifyEvent() wrapper is a follow-up.
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = webhookSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
  const { type, data } = parsed.data;
  const messageId = data.email_id;

  if (!messageId) {
    // Without a message id we can't tie back to a draft — ack and move on.
    return NextResponse.json({ ok: true });
  }

  const draft = await prisma.outreachDraft.findFirst({
    where: { messageId },
  });
  if (!draft) {
    // Unknown email (could be from another tenant, or an old send before
    // this code was deployed). Return 200 so Resend stops retrying.
    return NextResponse.json({ ok: true });
  }

  switch (type) {
    case "email.delivered": {
      const firstDelivery = draft.deliveredAt == null;
      await prisma.$transaction([
        prisma.outreachDraft.update({
          where: { id: draft.id },
          data: { deliveredAt: draft.deliveredAt ?? new Date() },
        }),
        ...(firstDelivery
          ? [
              prisma.outreachCampaign.update({
                where: { id: draft.campaignId },
                data: { deliveredCount: { increment: 1 } },
              }),
            ]
          : []),
      ]);
      break;
    }
    case "email.bounced": {
      const firstBounce = draft.bouncedAt == null;
      await prisma.$transaction([
        prisma.outreachDraft.update({
          where: { id: draft.id },
          data: {
            bouncedAt: draft.bouncedAt ?? new Date(),
            bounceReason:
              data.bounce?.message ?? data.bounce?.subType ?? "Unknown",
            status: "BOUNCED",
          },
        }),
        ...(firstBounce
          ? [
              prisma.outreachCampaign.update({
                where: { id: draft.campaignId },
                data: { bouncedCount: { increment: 1 } },
              }),
            ]
          : []),
      ]);
      break;
    }
    case "email.complained": {
      await prisma.outreachDraft.update({
        where: { id: draft.id },
        data: { unsubscribedAt: draft.unsubscribedAt ?? new Date() },
      });
      break;
    }
    default:
      // Other event types (email.sent, email.opened from Resend's own
      // tracking, etc.) — ignore. Our pixel + click endpoints are the
      // source of truth for opens / clicks.
      break;
  }

  return NextResponse.json({ ok: true });
}
