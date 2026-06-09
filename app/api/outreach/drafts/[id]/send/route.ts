import { NextResponse } from "next/server";

import { effectivePlan } from "@/lib/billing/trial";
import {
  findRecentRecipient,
  getDailyStatus,
  getHourlyStatus,
} from "@/lib/email/limits";
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
 * Three pre-send safeguards (in order):
 *   - Hourly cap: HOURLY_CAP=50 sends per rolling 60min/org. → 429 + nextSlotAt.
 *   - Daily cap by plan: Starter 100 / Growth 250 / Scale 500 / Enterprise ∞. → 402.
 *   - 7-day recipient dedup: same `recipientEmail` from this org in the
 *     last 7 days blocks the send unless the caller passes
 *     `?confirmDuplicate=true`. → 409 with conflict detail.
 *
 * On success returns 200 with the post-send draft snapshot (status /
 * sentAt / messageId / trackingId). Returns 409 if the draft was
 * already sent (different from the dedup conflict above).
 */
export const POST = withOrg<{ id: string }>(
  async (req, { params, auth }) => {
    const { id } = await params;
    const url = new URL(req.url);
    const confirmDuplicate = url.searchParams.get("confirmDuplicate") === "true";

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

    // ─── Hourly cap ──────────────────────────────────────────────────
    const hourly = await getHourlyStatus(auth.org.id);
    if (hourly.remaining !== null && hourly.remaining <= 0) {
      return NextResponse.json(
        {
          error:
            "You've hit the 50 emails/hour pacing cap. DonorLume will automatically resume sending shortly.",
          code: "hourly-cap",
          hourly,
        },
        {
          status: 429,
          headers: hourly.nextSlotAt
            ? {
                "Retry-After": String(
                  Math.max(
                    1,
                    Math.ceil(
                      (new Date(hourly.nextSlotAt).getTime() - Date.now()) /
                        1000,
                    ),
                  ),
                ),
              }
            : undefined,
        },
      );
    }

    // ─── Daily cap (plan tier) ───────────────────────────────────────
    const plan = effectivePlan(auth.org.plan, auth.org.trialEndsAt);
    const daily = await getDailyStatus(auth.org.id, plan);
    if (daily.cap !== null && daily.remaining !== null && daily.remaining <= 0) {
      return NextResponse.json(
        {
          error: `Your ${daily.planName} plan is limited to ${daily.cap} sends per day. Quota resets at UTC midnight.`,
          code: "daily-cap",
          daily,
        },
        { status: 402 },
      );
    }

    // ─── Recipient dedup (7-day) ─────────────────────────────────────
    if (!confirmDuplicate) {
      const conflict = await findRecentRecipient(
        auth.org.id,
        draft.recipientEmail,
        draft.id,
      );
      if (conflict) {
        return NextResponse.json(
          {
            error: `${conflict.recipientName} received an email from your ${
              conflict.campaignName ? `"${conflict.campaignName}" ` : ""
            }campaign ${
              conflict.daysAgo === 0 ? "earlier today" : `${conflict.daysAgo} day${conflict.daysAgo === 1 ? "" : "s"} ago`
            }. Are you sure you want to send again?`,
            code: "recent-recipient",
            conflict,
          },
          { status: 409 },
        );
      }
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
      // Re-read post-send so the client always has accurate quota state
      // for its next call (avoids waiting for the next GET).
      const [hourlyAfter, dailyAfter] = await Promise.all([
        getHourlyStatus(auth.org.id),
        getDailyStatus(auth.org.id, plan),
      ]);
      return NextResponse.json({
        draft: fresh,
        firstSend: priorSentCount === 0,
        hourly: hourlyAfter,
        daily: dailyAfter,
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
