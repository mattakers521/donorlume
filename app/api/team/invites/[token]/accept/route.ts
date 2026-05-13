import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { getPlan } from "@/lib/billing/plans";
import { effectivePlan } from "@/lib/billing/trial";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/team/invites/{token}/accept
 *
 * Accepts a pending team invitation. Requires the caller's session
 * email to match the invitation's email (case-insensitive). Re-runs
 * the seat-cap check at acceptance time in case the plan was
 * downgraded between invite-send and accept.
 */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const session = await auth();
  if (!session?.user?.id || !session.user.email) {
    return NextResponse.json(
      { ok: false, error: "Sign in to accept the invitation." },
      { status: 401 },
    );
  }

  const invitation = await prisma.invitation.findUnique({
    where: { token },
    include: {
      org: { select: { id: true, plan: true, trialEndsAt: true } },
    },
  });
  if (!invitation) {
    return NextResponse.json(
      { ok: false, error: "Invitation not found." },
      { status: 404 },
    );
  }
  if (invitation.acceptedAt) {
    return NextResponse.json(
      { ok: false, error: "This invitation has already been accepted." },
      { status: 409 },
    );
  }
  if (invitation.expiresAt < new Date()) {
    return NextResponse.json(
      { ok: false, error: "This invitation has expired." },
      { status: 410 },
    );
  }
  if (
    invitation.email.toLowerCase() !==
    (session.user.email ?? "").toLowerCase()
  ) {
    return NextResponse.json(
      {
        ok: false,
        error: `This invite is for ${invitation.email}. Sign in with that email to accept.`,
      },
      { status: 403 },
    );
  }

  // Already a member?
  const existing = await prisma.orgUser.findFirst({
    where: { userId: session.user.id, orgId: invitation.org.id },
    select: { id: true },
  });
  if (existing) {
    await prisma.invitation.update({
      where: { id: invitation.id },
      data: { acceptedAt: new Date() },
    });
    return NextResponse.json({ ok: true, alreadyMember: true });
  }

  // Seat-cap re-check.
  const plan = getPlan(
    effectivePlan(invitation.org.plan, invitation.org.trialEndsAt),
  );
  if (plan.limits.seats !== null) {
    const memberCount = await prisma.orgUser.count({
      where: { orgId: invitation.org.id },
    });
    if (memberCount >= plan.limits.seats) {
      return NextResponse.json(
        {
          ok: false,
          error: `This org's ${plan.name} plan supports ${plan.limits.seats} team member${plan.limits.seats === 1 ? "" : "s"}. Ask an admin to upgrade before accepting.`,
        },
        { status: 402 },
      );
    }
  }

  await prisma.$transaction([
    prisma.orgUser.create({
      data: {
        userId: session.user.id,
        orgId: invitation.org.id,
        role: invitation.role,
      },
    }),
    prisma.invitation.update({
      where: { id: invitation.id },
      data: { acceptedAt: new Date() },
    }),
  ]);

  return NextResponse.json({ ok: true });
}
