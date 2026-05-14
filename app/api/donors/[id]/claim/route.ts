import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { withOrg } from "@/lib/with-org";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/donors/[id]/claim
 *
 * Marks the donor as personally cultivated by the calling user so
 * other team members avoid sending conflicting outreach. Idempotent if
 * the caller already owns the claim. If a *different* user holds the
 * claim, returns 409 with the existing claimer's name so the UI can
 * surface a clear "Already claimed by Sarah" message.
 *
 * Multi-tenant safety: we verify the donor belongs to a DonorList
 * inside the caller's org BEFORE writing — otherwise a hostile org
 * could claim donors they shouldn't see.
 */
export const POST = withOrg<{ id: string }>(async (_req, { auth, params }) => {
  const { id: donorId } = await params;

  const donor = await prisma.donor.findFirst({
    where: { id: donorId, donorList: { orgId: auth.org.id } },
    select: {
      id: true,
      claimedById: true,
      claimedBy: { select: { name: true, email: true } },
    },
  });
  if (!donor) {
    return NextResponse.json({ error: "Donor not found" }, { status: 404 });
  }

  // Already claimed by someone else → conflict. The caller can release
  // their own claim and re-claim, but cannot silently steal someone
  // else's claim. (Owner/Admin override happens at /release, not here.)
  if (donor.claimedById && donor.claimedById !== auth.userId) {
    return NextResponse.json(
      {
        error: "Donor is already claimed by another team member.",
        claimedBy: donor.claimedBy?.name || donor.claimedBy?.email || "Someone",
      },
      { status: 409 },
    );
  }

  // Same-user re-claim is a no-op for the timestamp — keep the original
  // claimedAt so the "claimed 3d ago" display doesn't reset on a click.
  if (donor.claimedById === auth.userId) {
    const fresh = await prisma.donor.findUnique({
      where: { id: donorId },
      include: {
        claimedBy: { select: { id: true, name: true, email: true } },
      },
    });
    return NextResponse.json({ donor: fresh });
  }

  const updated = await prisma.donor.update({
    where: { id: donorId },
    data: { claimedById: auth.userId, claimedAt: new Date() },
    include: { claimedBy: { select: { id: true, name: true, email: true } } },
  });

  return NextResponse.json({ donor: updated });
});
