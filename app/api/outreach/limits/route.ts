import { NextResponse } from "next/server";

import { effectivePlan } from "@/lib/billing/trial";
import { getDailyStatus, getHourlyStatus } from "@/lib/email/limits";
import { withOrg } from "@/lib/with-org";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/outreach/limits
 *
 * Returns the org's current send-pacing state for UI display. Drives
 * the daily quota strip + the rate-limit-aware bulk-send loop on the
 * outreach results page.
 */
export const GET = withOrg(async (_req, { auth }) => {
  const plan = effectivePlan(auth.org.plan, auth.org.trialEndsAt);
  const [hourly, daily] = await Promise.all([
    getHourlyStatus(auth.org.id),
    getDailyStatus(auth.org.id, plan),
  ]);
  return NextResponse.json({ hourly, daily });
});
