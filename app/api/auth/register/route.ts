import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";

import { computeTrialEndsAt } from "@/lib/billing/trial";
import { seedSystemCohorts } from "@/lib/cohorts/seed";
import { sendWelcomeEmail } from "@/lib/email/transactional";
import { notifyAdmin } from "@/lib/notifications/admin";
import { prisma } from "@/lib/prisma";

const registerSchema = z.object({
  email: z.string().email().toLowerCase(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  name: z.string().min(1).max(120).optional(),
  orgName: z.string().min(1).max(200),
  mission: z.string().max(2000).optional(),
  senderName: z.string().max(120).optional(),
  senderTitle: z.string().max(120).optional(),
  // From the landing "Choose Your Path" cards — drives onboarding copy.
  signupPath: z.enum(["event", "donors"]).optional().nullable(),
  // Terms-of-Service acceptance. Required `true` so a client that
  // skips the checkbox can't construct a passing payload. Server
  // stamps termsAcceptedAt = now() on the User row.
  acceptTerms: z.literal(true, {
    message: "You must agree to the Terms of Service and Privacy Policy.",
  }),
});

export async function POST(req: Request) {
  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = registerSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const {
    email,
    password,
    name,
    orgName,
    mission,
    senderName,
    senderTitle,
    signupPath,
  } =
    parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json(
      { error: "An account with this email already exists" },
      { status: 409 },
    );
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const { user, org } = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email,
        name,
        passwordHash,
        // Zod has already validated acceptTerms === true above.
        termsAcceptedAt: new Date(),
      },
    });

    // 14-day free trial — stamped at org creation, no Stripe interaction
    // required. Trial users get Growth-tier limits via effectivePlan()
    // until trialEndsAt expires. computeTrialEndsAt() adds a 12h buffer
    // so Stripe's floor-rounded "days remaining" reads 14, not 13.
    const trialEndsAt = computeTrialEndsAt();

    const org = await tx.organization.create({
      data: {
        name: orgName,
        mission,
        signupPath: signupPath ?? null,
        trialEndsAt,
        stripeStatus: "trialing",
        settings: {
          create: {
            senderName: senderName ?? name,
            senderTitle,
            senderEmail: email,
          },
        },
      },
    });

    await tx.orgUser.create({
      data: { userId: user.id, orgId: org.id, role: "OWNER" },
    });

    return { user, org };
  });

  // Seed the 13 Phase-1 system cohort definitions for the new org so the
  // /cohorts page is populated the moment they finish signing up — runs
  // outside the user-creation transaction (best-effort; a seed failure
  // shouldn't kill an otherwise-valid account).
  try {
    await seedSystemCohorts(org.id);
  } catch (e) {
    console.error("seedSystemCohorts failed for new org", org.id, e);
  }

  // Welcome email + Slack ping. Both are fire-and-forget — they never
  // block or fail the signup response.
  try {
    await sendWelcomeEmail({ user, org });
  } catch (e) {
    console.error("sendWelcomeEmail failed for new user", user.email, e);
  }

  notifyAdmin("signup", {
    userName: user.name ?? user.email,
    userEmail: user.email,
    orgName: org.name,
    source: "password",
  });

  return NextResponse.json(
    {
      ok: true,
      userId: user.id,
      orgId: org.id,
    },
    { status: 201 },
  );
}
