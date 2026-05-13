/**
 * Direct email send via Resend — Spec §4.
 *
 * Idempotent: if the draft already has a `messageId` and status >= SENT,
 * we return without re-sending. Otherwise we mint a trackingId, render
 * HTML + plain-text bodies, call Resend, then atomically update the
 * draft + bump the campaign's `sentCount`.
 */

import "server-only";

import { randomUUID } from "node:crypto";

import type { OutreachCampaign, OutreachDraft } from "@prisma/client";

import { prepareEmailHtml } from "@/lib/email/prepare";
import { getFromAddress, getResend } from "@/lib/email/resend";
import { prisma } from "@/lib/prisma";

export type SendOutcome =
  | { kind: "sent"; messageId: string }
  | { kind: "already-sent" }
  | { kind: "missing-recipient" };

export async function sendOutreachEmail(
  draft: OutreachDraft & { campaign: OutreachCampaign },
): Promise<SendOutcome> {
  if (!draft.recipientEmail) return { kind: "missing-recipient" };
  if (draft.messageId && draft.status !== "DRAFT" && draft.status !== "APPROVED") {
    return { kind: "already-sent" };
  }

  const trackingId = draft.trackingId ?? randomUUID();
  const { html, text } = prepareEmailHtml(draft.body, trackingId);

  const resend = getResend();
  const from = getFromAddress();

  const result = await resend.emails.send({
    from,
    to: draft.recipientEmail,
    subject: draft.subject,
    html,
    text,
    headers: {
      "X-DonorLume-Draft-Id": draft.id,
      "X-DonorLume-Campaign-Id": draft.campaignId,
    },
  });

  if (result.error) {
    throw new Error(`Resend: ${result.error.message ?? "unknown error"}`);
  }
  const messageId = result.data?.id;
  if (!messageId) {
    throw new Error("Resend returned no message id");
  }

  // Stamp the draft + bump campaign counter in one round-trip.
  await prisma.$transaction([
    prisma.outreachDraft.update({
      where: { id: draft.id },
      data: {
        status: "SENT",
        sentAt: new Date(),
        messageId,
        trackingId,
      },
    }),
    // sentCount only bumps on the first send for this draft. Idempotency
    // is enforced by the early return above.
    prisma.outreachCampaign.update({
      where: { id: draft.campaignId },
      data: { sentCount: { increment: 1 } },
    }),
  ]);

  return { kind: "sent", messageId };
}
