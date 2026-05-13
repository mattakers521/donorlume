import { NextResponse } from "next/server";

import { PROPUBLICA_BASE } from "@/lib/propublica";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/propublica/search?q=...&state=...&page=...
 *
 * Proxies the ProPublica Nonprofit Explorer search endpoint. ProPublica
 * is open and unauthenticated, so this proxy is a thin pass-through —
 * its purpose is to keep the data path on our origin (lets us cache,
 * rate-limit per session, or attach enrichment in the future).
 */
export async function GET(req: Request) {
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
}
