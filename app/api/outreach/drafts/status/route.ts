import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { withOrg } from "@/lib/with-org";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/outreach/drafts/status?ids=id1,id2,…
 *
 * Lightweight status refresher used by the outreach results screen to
 * poll for delivery updates without reloading the page. Multi-tenant
 * safe via the campaign join.
 */
export const GET = withOrg(async (req, { auth }) => {
  const url = new URL(req.url);
  const idsParam = url.searchParams.get("ids") ?? "";
  const ids = idsParam
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 500); // cap so a runaway query string can't fan out

  if (ids.length === 0) {
    return NextResponse.json({ drafts: [] });
  }

  const drafts = await prisma.outreachDraft.findMany({
    where: {
      id: { in: ids },
      campaign: { orgId: auth.org.id },
    },
    select: {
      id: true,
      status: true,
      sentAt: true,
      deliveredAt: true,
      openedAt: true,
      openCount: true,
      clickedAt: true,
      clickCount: true,
      bouncedAt: true,
      bounceReason: true,
      repliedAt: true,
    },
  });

  return NextResponse.json({ drafts });
});
