import { NextResponse, type NextRequest } from "next/server";

import { notifyAdmin } from "@/lib/notifications/admin";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/cron/churn-check
 *
 * Daily sweep: finds users whose lastActiveAt is more than 14 days ago
 * (or who never recorded activity but were created more than 14 days
 * ago) and who haven't already been flagged in a prior alert. Posts a
 * single Slack summary with up to N inactive users, then marks each one
 * inactiveSlackedAt so the next sweep doesn't re-page on the same names.
 *
 * Re-arming: getOrgContext() clears inactiveSlackedAt whenever the user
 * comes back, so a returning-then-lapsing user will alert again.
 *
 * Auth: Vercel Cron passes `Authorization: Bearer ${CRON_SECRET}`. In
 * dev with no CRON_SECRET set, any caller is allowed.
 */
export async function GET(req: NextRequest) {
  const guard = checkCronAuth(req);
  if (guard) return guard;

  const now = Date.now();
  const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000;
  const cutoff = new Date(now - FOURTEEN_DAYS_MS);

  // Two-track candidate set:
  //   (a) lastActiveAt is set and older than the cutoff
  //   (b) lastActiveAt is null AND createdAt is older than the cutoff
  //       (users who signed up but never came back at all)
  // Either way, only un-flagged users are returned.
  const candidates = await prisma.user.findMany({
    where: {
      inactiveSlackedAt: null,
      OR: [
        { lastActiveAt: { lt: cutoff } },
        { lastActiveAt: null, createdAt: { lt: cutoff } },
      ],
    },
    select: {
      id: true,
      name: true,
      email: true,
      lastActiveAt: true,
      createdAt: true,
    },
    take: 200,
  });

  if (candidates.length === 0) {
    return NextResponse.json({ ok: true, candidates: 0, flagged: 0 });
  }

  const inactiveUsers = candidates.map((u) => {
    const referenceDate = u.lastActiveAt ?? u.createdAt;
    const daysSinceActive = Math.floor(
      (now - referenceDate.getTime()) / (24 * 60 * 60 * 1000),
    );
    return {
      name: u.name,
      email: u.email,
      daysSinceActive,
    };
  });

  notifyAdmin("churn-alert", { inactiveUsers });

  // Mark these users so the next sweep doesn't re-page them. We do this
  // even when SLACK_WEBHOOK_URL isn't set — the alert was "delivered" to
  // the no-op sink, and we don't want a dev-cron to accumulate flags
  // forever waiting for the webhook to arrive.
  const flaggedAt = new Date();
  await prisma.user.updateMany({
    where: { id: { in: candidates.map((c) => c.id) } },
    data: { inactiveSlackedAt: flaggedAt },
  });

  return NextResponse.json({
    ok: true,
    candidates: candidates.length,
    flagged: candidates.length,
  });
}

function checkCronAuth(req: NextRequest): NextResponse | null {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    // In dev with no CRON_SECRET set, allow any caller. Production
    // deployment must set this.
    return null;
  }
  const header = req.headers.get("authorization") ?? "";
  const fromHeader = header.startsWith("Bearer ") ? header.slice(7) : "";
  const fromQuery = req.nextUrl.searchParams.get("secret") ?? "";
  if (fromHeader === secret || fromQuery === secret) return null;
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
