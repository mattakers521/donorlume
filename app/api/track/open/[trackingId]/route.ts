import type { NextRequest } from "next/server";

import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 1×1 transparent GIF (43 bytes).
const PIXEL = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
  "base64",
);

const pixelResponse = () =>
  new Response(PIXEL, {
    headers: {
      "Content-Type": "image/gif",
      "Content-Length": String(PIXEL.length),
      // Aggressive no-cache so image proxies refetch (still subject to the
      // Apple Mail / Gmail prefetch caveats — see CLAUDE.md).
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
      Pragma: "no-cache",
    },
  });

/**
 * GET /api/track/open/{trackingId}
 *
 * Tracking pixel endpoint. Always returns the 1×1 GIF, regardless of
 * lookup outcome — never leak existence of a tracking id to image
 * proxies. DB updates are best-effort and monotonic:
 *   - First open ever:   openedAt set, openCount = 1, status SENT → OPENED.
 *   - Subsequent opens:  openCount incremented; openedAt left at first-open.
 *
 * Status is only promoted SENT → OPENED. BOUNCED / REPLIED / OPENED stay
 * as they are so a later pixel hit can't downgrade a richer state.
 */
export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ trackingId: string }> },
) {
  const { trackingId } = await ctx.params;

  try {
    const draft = await prisma.outreachDraft.findUnique({
      where: { trackingId },
      include: { campaign: true },
    });

    if (!draft) return pixelResponse();

    const firstOpen = draft.openedAt == null;

    await prisma.$transaction([
      prisma.outreachDraft.update({
        where: { id: draft.id },
        data: {
          openCount: { increment: 1 },
          openedAt: draft.openedAt ?? new Date(),
          status: draft.status === "SENT" ? "OPENED" : draft.status,
        },
      }),
      ...(firstOpen
        ? [
            prisma.outreachCampaign.update({
              where: { id: draft.campaignId },
              data: { openedCount: { increment: 1 } },
            }),
          ]
        : []),
    ]);
  } catch (e) {
    // Don't break the pixel response on DB hiccups — Neon cold-starts can
    // throw. The tracking event is lost; everything else still works.
    console.error("open pixel update failed", e);
  }

  return pixelResponse();
}
