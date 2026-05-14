import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { withOrg } from "@/lib/with-org";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/donors/[id]/release
 *
 * Drops the cultivation claim on a donor. Authorization rule:
 *   • The user who currently holds the claim can always release it.
 *   • OWNER or ADMIN role can release *anyone's* claim — useful when a
 *     team member leaves or forgets to release.
 *   • MEMBER and VIEWER can only release their own claims.
 *
 * Returns 200 with the refreshed donor row even if the donor was
 * already unclaimed — idempotency keeps the optimistic UI on the
 * client simple.
 */
export const POST = withOrg<{ id: string }>(async (_req, { auth, params }) => {
  const { id: donorId } = await params;

  const donor = await prisma.donor.findFirst({
    where: { id: donorId, donorList: { orgId: auth.org.id } },
    select: { id: true, claimedById: true },
  });
  if (!donor) {
    return NextResponse.json({ error: "Donor not found" }, { status: 404 });
  }

  // Already unclaimed — return success without touching the DB.
  if (!donor.claimedById) {
    const fresh = await prisma.donor.findUnique({
      where: { id: donorId },
      include: {
        claimedBy: { select: { id: true, name: true, email: true } },
      },
    });
    return NextResponse.json({ donor: fresh });
  }

  const isOwnClaim = donor.claimedById === auth.userId;
  const isPrivileged = auth.orgRole === "OWNER" || auth.orgRole === "ADMIN";
  if (!isOwnClaim && !isPrivileged) {
    return NextResponse.json(
      {
        error: "Only the claimer or an Owner/Admin can release this claim.",
      },
      { status: 403 },
    );
  }

  const updated = await prisma.donor.update({
    where: { id: donorId },
    data: { claimedById: null, claimedAt: null },
    include: { claimedBy: { select: { id: true, name: true, email: true } } },
  });

  return NextResponse.json({ donor: updated });
});
