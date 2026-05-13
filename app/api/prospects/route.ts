import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { withOrg } from "@/lib/with-org";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const createSchema = z.object({
  ein: z.string().min(1).max(20).optional(),
  name: z.string().min(1).max(300),
  city: z.string().max(120).optional().nullable(),
  state: z.string().max(40).optional().nullable(),
  nteeCode: z.string().max(20).optional().nullable(),
  revenue: z.number().nullable().optional(),
  assets: z.number().nullable().optional(),
  source: z.string().max(40).optional(),
});

/**
 * GET /api/prospects
 * Returns the current org's saved prospects (id + ein only by default,
 * widen with `?fields=full` if needed). Used by the discover page to
 * populate the saved-EIN map on load.
 */
export const GET = withOrg(async (req, { auth }) => {
  const url = new URL(req.url);
  const fields = url.searchParams.get("fields");

  if (fields === "full") {
    const prospects = await prisma.prospect.findMany({
      where: { orgId: auth.org.id },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ prospects });
  }

  const prospects = await prisma.prospect.findMany({
    where: { orgId: auth.org.id, ein: { not: null } },
    select: { id: true, ein: true },
  });
  return NextResponse.json({ prospects });
});

/**
 * POST /api/prospects
 * Save a prospect (typically from a ProPublica search result).
 * Idempotent on (orgId, ein): if the EIN is already saved for this org,
 * returns the existing record instead of creating a duplicate.
 */
export const POST = withOrg(async (req, { auth }) => {
  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = createSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const data = parsed.data;

  // De-dupe on (orgId, ein) so re-saving doesn't pile up rows.
  if (data.ein) {
    const existing = await prisma.prospect.findFirst({
      where: { orgId: auth.org.id, ein: data.ein },
      select: { id: true, ein: true, name: true },
    });
    if (existing) {
      return NextResponse.json({ prospect: existing }, { status: 200 });
    }
  }

  // Snapshot the pre-insert count so we can return a `firstProspect`
  // flag for the onboarding "step complete" toast.
  const priorProspectCount = await prisma.prospect.count({
    where: { orgId: auth.org.id },
  });

  const prospect = await prisma.prospect.create({
    data: {
      orgId: auth.org.id,
      ein: data.ein,
      name: data.name,
      type: "FOUNDATION", // ProPublica orgs are 990-filing entities — refine when we add type detection
      city: data.city ?? null,
      state: data.state ?? null,
      nteeCode: data.nteeCode ?? null,
      revenue: data.revenue ?? null,
      assets: data.assets ?? null,
      source: data.source ?? "propublica",
    },
    select: { id: true, ein: true, name: true },
  });
  return NextResponse.json(
    { prospect, firstProspect: priorProspectCount === 0 },
    { status: 201 },
  );
});
