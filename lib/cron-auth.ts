import "server-only";

import { timingSafeEqual } from "node:crypto";

import { NextResponse, type NextRequest } from "next/server";

/**
 * Guard for Vercel-Cron-style endpoints. Requires `Authorization:
 * Bearer ${CRON_SECRET}`. Uses `timingSafeEqual` to defend against
 * timing side-channels; rejects if header is missing or wrong length.
 *
 * Dev/local: when `CRON_SECRET` is empty, accepts any caller so the
 * cron loops are still exercisable on localhost without ceremony.
 * Production deploys MUST set `CRON_SECRET`.
 *
 * Returns `null` when authorized, or a 401 `NextResponse` when not.
 */
export function checkCronAuth(req: NextRequest): NextResponse | null {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return null;

  const header = req.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const a = Buffer.from(token);
  const b = Buffer.from(secret);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}
