import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { withOrg } from "@/lib/with-org";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * DELETE /api/prospects/{id}
 * Hard-deletes a saved prospect. Verifies the prospect belongs to the
 * caller's org before removing — multi-tenant safe.
 */
export const DELETE = withOrg<{ id: string }>(async (_req, { params, auth }) => {
  const { id } = await params;

  const result = await prisma.prospect.deleteMany({
    where: { id, orgId: auth.org.id },
  });

  if (result.count === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
});
