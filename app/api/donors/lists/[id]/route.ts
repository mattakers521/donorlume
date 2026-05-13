import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { withOrg } from "@/lib/with-org";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * DELETE /api/donors/lists/{id}
 * Deletes a DonorList (cascades to its Donor rows via Prisma onDelete).
 * Multi-tenant safe via withOrg + scoped deleteMany.
 */
export const DELETE = withOrg<{ id: string }>(
  async (_req, { params, auth }) => {
    const { id } = await params;
    const result = await prisma.donorList.deleteMany({
      where: { id, orgId: auth.org.id },
    });
    if (result.count === 0) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  },
);
