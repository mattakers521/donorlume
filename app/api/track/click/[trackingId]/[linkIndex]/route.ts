import { NextResponse, type NextRequest } from "next/server";

import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isSafeRedirect(raw: string): boolean {
  try {
    const url = new URL(raw);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * GET /api/track/click/{trackingId}/{linkIndex}?url=...
 *
 * Click tracking. Validates the `url` query param is a real http(s) URL
 * (open-redirect guard), logs an EmailClick row, monotonically updates
 * the parent draft (clickedAt + clickCount + status SENT→OPENED), bumps
 * the campaign's clickedCount on the first click ever, and finally
 * 302s the user to the original URL.
 *
 * If the trackingId is unknown we still redirect — losing a click event
 * is better than leaving the user staring at a "Not found" page after
 * clicking a link in their email.
 */
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ trackingId: string; linkIndex: string }> },
) {
  const { trackingId } = await ctx.params;
  const target = req.nextUrl.searchParams.get("url");

  if (!target || !isSafeRedirect(target)) {
    return new NextResponse("Invalid redirect URL", { status: 400 });
  }

  try {
    const draft = await prisma.outreachDraft.findUnique({
      where: { trackingId },
    });

    if (draft) {
      const firstClick = draft.clickedAt == null;
      const userAgent = req.headers.get("user-agent") ?? null;

      await prisma.$transaction([
        prisma.emailClick.create({
          data: { draftId: draft.id, url: target, userAgent },
        }),
        prisma.outreachDraft.update({
          where: { id: draft.id },
          data: {
            clickCount: { increment: 1 },
            clickedAt: draft.clickedAt ?? new Date(),
            // A click implies an open. Promote SENT → OPENED and stamp
            // openedAt if it wasn't already (some email clients block
            // pixels but allow link clicks).
            status: draft.status === "SENT" ? "OPENED" : draft.status,
            openedAt: draft.openedAt ?? new Date(),
            openCount:
              draft.openedAt == null ? { increment: 1 } : undefined,
          },
        }),
        ...(firstClick
          ? [
              prisma.outreachCampaign.update({
                where: { id: draft.campaignId },
                data: { clickedCount: { increment: 1 } },
              }),
            ]
          : []),
      ]);
    }
  } catch (e) {
    console.error("click tracking failed", e);
  }

  return NextResponse.redirect(target, 302);
}
