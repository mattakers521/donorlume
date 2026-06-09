import { createHmac, timingSafeEqual } from "node:crypto";

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
 * Signature verification (svix headers) is enforced via RESEND_WEBHOOK_SECRET.
 * When the secret is set, we recompute the HMAC over `${svix-id}.${svix-timestamp}.${rawBody}`
 * and timing-safe-compare against the comma-separated signature list. When
 * unset (dev / first-run), we log a warning and accept the event so the
 * loop can be wired up before the signing secret is configured.
 *
 * Replay protection: rejects events whose svix-timestamp is more than
 * `MAX_TIMESTAMP_SKEW_MS` away from the server clock. Stops a captured
 * webhook from being replayed indefinitely.
 */
const MAX_TIMESTAMP_SKEW_MS = 5 * 60 * 1000;

function verifySvixSignature(
  rawBody: string,
  secret: string,
  msgId: string,
  msgTimestamp: string,
  msgSignature: string,
): boolean {
  // svix secrets are base64-encoded with a `whsec_` prefix.
  const base64Secret = secret.startsWith("whsec_")
    ? secret.slice("whsec_".length)
    : secret;
  let secretBytes: Buffer;
  try {
    secretBytes = Buffer.from(base64Secret, "base64");
  } catch {
    return false;
  }

  const signed = `${msgId}.${msgTimestamp}.${rawBody}`;
  const expectedB64 = createHmac("sha256", secretBytes)
    .update(signed)
    .digest("base64");

  // svix-signature is space-separated `v1,<base64>` entries — any one
  // matching ours is valid.
  const candidates = msgSignature
    .split(" ")
    .map((s) => s.split(","))
    .filter((parts) => parts[0] === "v1")
    .map((parts) => parts[1]);

  const expected = Buffer.from(expectedB64, "utf8");
  for (const candidate of candidates) {
    if (!candidate) continue;
    const candidateBuf = Buffer.from(candidate, "utf8");
    if (
      candidateBuf.length === expected.length &&
      timingSafeEqual(candidateBuf, expected)
    ) {
      return true;
    }
  }
  return false;
}

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
  // Raw body is needed BOTH for signature verification and for JSON
  // parsing — read once.
  const rawBody = await req.text();

  const secret = process.env.RESEND_WEBHOOK_SECRET?.trim();
  if (secret) {
    const id = req.headers.get("svix-id");
    const timestamp = req.headers.get("svix-timestamp");
    const signature = req.headers.get("svix-signature");

    if (!id || !timestamp || !signature) {
      return NextResponse.json(
        { error: "Missing webhook signature headers" },
        { status: 401 },
      );
    }

    // Replay defense: clamp timestamp drift so a captured event can't
    // be replayed weeks later.
    const tsMs = Number(timestamp) * 1000;
    if (
      !Number.isFinite(tsMs) ||
      Math.abs(Date.now() - tsMs) > MAX_TIMESTAMP_SKEW_MS
    ) {
      return NextResponse.json(
        { error: "Timestamp outside allowed window" },
        { status: 401 },
      );
    }

    if (!verifySvixSignature(rawBody, secret, id, timestamp, signature)) {
      console.warn("Resend webhook: signature verification failed", {
        id,
      });
      return NextResponse.json(
        { error: "Invalid signature" },
        { status: 401 },
      );
    }
  } else {
    console.warn(
      "RESEND_WEBHOOK_SECRET not set — accepting webhook without signature verification. Configure at https://resend.com/webhooks before going to production.",
    );
  }

  let raw: unknown;
  try {
    raw = JSON.parse(rawBody);
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
