import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/auth";
import { computeTrialEndsAt } from "@/lib/billing/trial";
import { seedSystemCohorts } from "@/lib/cohorts/seed";
import { sendWelcomeEmail } from "@/lib/email/transactional";
import { notifyAdmin } from "@/lib/notifications/admin";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const onboardingSchema = z.object({
  orgName: z.string().min(1).max(200),
  mission: z.string().min(1).max(2000),
  senderName: z.string().max(120).optional().nullable(),
  senderTitle: z.string().max(120).optional().nullable(),
  // Carried from the landing /signup ?path through Google OAuth.
  signupPath: z.enum(["event", "donors"]).optional().nullable(),
  // Terms acceptance — Google OAuth users skipped /signup so we
  // collect it here. Stamps termsAcceptedAt on the existing User row.
  acceptTerms: z.literal(true, {
    message: "You must agree to the Terms of Service and Privacy Policy.",
  }),
});

/**
 * POST /api/auth/onboarding
 *
 * Authed-but-org-less users (typically Google OAuth signups, since the
 * provider creates a User row but no OrgUser) submit this form to
 * complete account setup. Mirrors the second half of /api/auth/register.
 *
 * Idempotent against the calling user: 409s if they already have an
 * OrgUser. No multi-user-per-account flow yet.
 */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const existing = await prisma.orgUser.findFirst({
    where: { userId: session.user.id },
    select: { orgId: true },
  });
  if (existing) {
    return NextResponse.json(
      { error: "Account already belongs to an organization." },
      { status: 409 },
    );
  }

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = onboardingSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const { orgName, mission, senderName, senderTitle, signupPath } =
    parsed.data;
  const userId = session.user.id;
  const userEmail = session.user.email ?? "";

  // 14-day free trial — same shape as /api/auth/register so Google
  // OAuth signups land in the trial just like password signups.
  const trialEndsAt = computeTrialEndsAt();

  const { org } = await prisma.$transaction(async (tx) => {
    const org = await tx.organization.create({
      data: {
        name: orgName,
        mission,
        signupPath: signupPath ?? null,
        trialEndsAt,
        stripeStatus: "trialing",
        settings: {
          create: {
            senderName: senderName ?? session.user.name ?? null,
            senderTitle: senderTitle ?? null,
            senderEmail: userEmail || null,
          },
        },
      },
    });
    await tx.orgUser.create({
      data: { userId, orgId: org.id, role: "OWNER" },
    });
    // Stamp terms acceptance on the pre-existing User row that
    // NextAuth's adapter created during Google sign-in. updateMany
    // (not update) so we can filter on non-unique fields without
    // throwing when the row is already stamped — first acceptance
    // wins, no later overwrite.
    await tx.user.updateMany({
      where: { id: userId, termsAcceptedAt: null },
      data: { termsAcceptedAt: new Date() },
    });
    return { org };
  });

  // Best-effort side effects (cohort seed + welcome + Slack ping).
  // Failures log but don't fail the request — the org row is the only
  // load-bearing artifact.
  try {
    await seedSystemCohorts(org.id);
  } catch (e) {
    console.error("seedSystemCohorts failed for onboarded org", org.id, e);
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (user) {
    try {
      await sendWelcomeEmail({ user, org });
    } catch (e) {
      console.error("sendWelcomeEmail failed for", user.email, e);
    }
  }

  notifyAdmin("signup", {
    userName: session.user.name ?? userEmail,
    userEmail,
    orgName: org.name,
    source: "google-onboarding",
  });

  return NextResponse.json({ ok: true, orgId: org.id }, { status: 201 });
}
