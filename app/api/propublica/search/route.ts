import { NextResponse } from "next/server";

import { PROPUBLICA_BASE } from "@/lib/propublica";
import { withOrg } from "@/lib/with-org";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/propublica/search?q=...&state=...&page=...
 *
 * Proxies the ProPublica Nonprofit Explorer search endpoint. ProPublica
 * itself is open and unauthenticated, but we gate THIS proxy behind
 * `withOrg` so anonymous bots can't burn our origin's compute / fan-out
 * traffic onto the upstream API in our name.
 */
export const GET = withOrg(async (req) => {
  const url = new URL(req.url);
  const q = url.searchParams.get("q")?.trim();
  const state = url.searchParams.get("state")?.trim();
  const page = url.searchParams.get("page")?.trim();

  if (!q) {
    return NextResponse.json(
      { error: "Missing required query parameter: q" },
      { status: 400 },
    );
  }
  // Cap query length so we can't be coerced into building absurd URLs.
  if (q.length > 200) {
    return NextResponse.json(
      { error: "Query too long" },
      { status: 400 },
    );
  }
  // State is a USPS code at most.
  if (state && !/^[A-Za-z]{2}$/.test(state)) {
    return NextResponse.json(
      { error: "Invalid state code" },
      { status: 400 },
    );
  }
  // Page is a small positive integer.
  if (page && !/^[1-9][0-9]{0,3}$/.test(page)) {
    return NextResponse.json(
      { error: "Invalid page" },
      { status: 400 },
    );
  }

  const upstream = new URL(`${PROPUBLICA_BASE}/search.json`);
  upstream.searchParams.set("q", q);
  if (state) upstream.searchParams.set("state[id]", state);
  if (page) upstream.searchParams.set("page", page);

  try {
    const res = await fetch(upstream, {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) {
      return NextResponse.json(
        { error: `ProPublica returned ${res.status}` },
        { status: 502 },
      );
    }
    const body = await res.json();
    return NextResponse.json(body);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Network error";
    return NextResponse.json({ error: message }, { status: 502 });
  }
});
