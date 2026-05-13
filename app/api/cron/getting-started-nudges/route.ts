import { NextResponse, type NextRequest } from "next/server";

import { sendGettingStartedNudge } from "@/lib/email/transactional";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/cron/getting-started-nudges
 *
 * Daily/hourly sweep: finds users who signed up at least 24 hours ago,
 * belong to an org with NO DonorList yet, and haven't been nudged. Sends
 * a single getting-started email per user (idempotent via
 * User.gettingStartedNudgeSentAt). Capped at 200/run so a backlog can't
 * fan out a flood of sends in one tick.
 *
 * Auth: Vercel Cron passes `Authorization: Bearer ${CRON_SECRET}`.
 */
export async function GET(req: NextRequest) {
  const guard = checkCronAuth(req);
  if (guard) return guard;

  const ONE_DAY_AGO = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const candidates = await prisma.user.findMany({
    where: {
      gettingStartedNudgeSentAt: null,
      createdAt: { lt: ONE_DAY_AGO },
      orgs: {
        some: {
          org: {
            donorLists: { none: {} },
          },
        },
      },
    },
    include: {
      orgs: {
        include: { org: true },
        take: 1,
      },
    },
    take: 200,
  });

  let sent = 0;
  let skipped = 0;
  for (const user of candidates) {
    const org = user.orgs[0]?.org;
    if (!org) {
      skipped++;
      continue;
    }
    const outcome = await sendGettingStartedNudge({ user, org });
    if (outcome.kind === "sent") sent++;
    else skipped++;
  }

  return NextResponse.json({
    ok: true,
    candidates: candidates.length,
    sent,
    skipped,
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
