import { NextResponse } from "next/server";

import { PROPUBLICA_BASE } from "@/lib/propublica";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/propublica/{ein}
 *
 * Proxies ProPublica's organization-details endpoint by EIN.
 * Returns the raw payload (organization + filings_with_data).
 */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ ein: string }> },
) {
  const { ein } = await ctx.params;
  if (!/^\d{2}-?\d{7}$/.test(ein) && !/^\d+$/.test(ein)) {
    return NextResponse.json({ error: "Invalid EIN" }, { status: 400 });
  }

  try {
    const res = await fetch(`${PROPUBLICA_BASE}/organizations/${ein}.json`, {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) {
      return NextResponse.json(
        { error: `ProPublica returned ${res.status}` },
        { status: res.status === 404 ? 404 : 502 },
      );
    }
    const body = await res.json();
    return NextResponse.json(body);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Network error";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
