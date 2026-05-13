import { NextResponse, type NextRequest } from "next/server";

import { buildReportCsv, reportFilename } from "@/lib/reports/csv";
import { getReportData, parseRange } from "@/lib/reports/data";
import { withOrg } from "@/lib/with-org";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/reports/export?range=last_90_days
 *
 * Streams a CSV "board report" for the calling org. Server reuses the
 * same `getReportData` helper the /reports page renders from, so the
 * download can never diverge from what the Development Director sees
 * on screen.
 */
export const GET = withOrg(async (req, { auth }) => {
  const url = new URL((req as NextRequest).url);
  const range = parseRange(url.searchParams.get("range"));

  const report = await getReportData(auth.org.id, range);
  const csv = buildReportCsv(report);
  const filename = reportFilename(report);

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
});
