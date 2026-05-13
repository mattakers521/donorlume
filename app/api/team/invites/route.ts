import { randomBytes } from "node:crypto";

import { NextResponse } from "next/server";
import { z } from "zod";

import { getPlan } from "@/lib/billing/plans";
import { effectivePlan } from "@/lib/billing/trial";
import { getFromAddress, getResend } from "@/lib/email/resend";
import { teamInviteEmail } from "@/lib/email/templates/team-invite";
import { prisma } from "@/lib/prisma";
import { withOrg } from "@/lib/with-org";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const inviteSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Email is required")
    .max(300)
    .email("Enter a valid email")
    .transform((s) => s.toLowerCase()),
  role: z.enum(["OWNER", "ADMIN", "MEMBER", "VIEWER"]).default("MEMBER"),
});

const ROLE_LABELS: Record<string, string> = {
  OWNER: "Owner",
  ADMIN: "Admin",
  MEMBER: "Member",
  VIEWER: "Viewer",
};

const TRIAL_DAYS = 7;

/**
 * POST /api/team/invites
 *
 * Creates a pending invitation for the calling org. Enforces the org's
 * seat cap (effective plan: Growth during trial, otherwise the column).
 * Re-inviting an existing email rotates the token instead of creating
 * a duplicate row (unique constraint on orgId+email).
 *
 * Authorization: any current member can invite. Restricting to
 * OWNER/ADMIN is a TODO — we'll add a role check here once we expose
 * a "demote to member" UI.
 */
export const POST = withOrg(async (req, { auth }) => {
  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = inviteSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error:
          parsed.error.issues[0]?.message ??
          "Validation failed — check the form.",
      },
      { status: 400 },
    );
  }
  const { email, role } = parsed.data;

  // Don't invite an existing user of the org (they'd just see "already
  // a member" — confusing). Pending-invite re-issues are fine, handled
  // below via upsert on (orgId, email).
  const existingMember = await prisma.user.findFirst({
    where: { email, orgs: { some: { orgId: auth.org.id } } },
    select: { id: true },
  });
  if (existingMember) {
    return NextResponse.json(
      { error: "That email is already on your team." },
      { status: 409 },
    );
  }

  // Seat cap — count members + outstanding (un-accepted, un-expired)
  // invitations. If accepting all pending invites would push the org
  // over the cap, refuse with an upgrade prompt.
  const planKey = effectivePlan(auth.org.plan, auth.org.trialEndsAt);
  const plan = getPlan(planKey);
  const seatLimit = plan.limits.seats;
  if (seatLimit !== null) {
    const [members, pending] = await Promise.all([
      prisma.orgUser.count({ where: { orgId: auth.org.id } }),
      prisma.invitation.count({
        where: {
          orgId: auth.org.id,
          acceptedAt: null,
          expiresAt: { gt: new Date() },
          // Don't count the email we're about to upsert — re-inviting
          // the same email shouldn't push us over.
          NOT: { email },
        },
      }),
    ]);
    if (members + pending + 1 > seatLimit) {
      return NextResponse.json(
        {
          error: `Your ${plan.name} plan supports ${seatLimit} team member${seatLimit === 1 ? "" : "s"}. Upgrade your plan to invite more.`,
          kind: "seat-limit",
          limit: seatLimit,
          planName: plan.name,
        },
        { status: 402 },
      );
    }
  }

  // Token = URL-safe random bytes. We don't sign it because we lookup
  // by token-equality + check acceptedAt/expiresAt server-side.
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(
    Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000,
  );

  const invitation = await prisma.invitation.upsert({
    where: { orgId_email: { orgId: auth.org.id, email } },
    create: {
      orgId: auth.org.id,
      email,
      role,
      token,
      expiresAt,
      invitedById: auth.userId,
    },
    update: {
      role,
      token,
      expiresAt,
      acceptedAt: null,
      invitedById: auth.userId,
    },
  });

  // Send the invite email. Failures here don't fail the request — the
  // user can re-send from the UI, and the row exists either way.
  void sendInvite({
    invitation,
    orgName: auth.org.name,
    inviterName:
      (
        await prisma.user.findUnique({
          where: { id: auth.userId },
          select: { name: true, email: true },
        })
      )?.name ?? "A teammate",
  }).catch((e) =>
    console.error("teamInvite send failed", { invitationId: invitation.id, e }),
  );

  return NextResponse.json(
    {
      invitation: {
        id: invitation.id,
        email: invitation.email,
        role: invitation.role,
        expiresAt: invitation.expiresAt,
      },
    },
    { status: 201 },
  );
});

async function sendInvite({
  invitation,
  orgName,
  inviterName,
}: {
  invitation: { token: string; email: string; role: string };
  orgName: string;
  inviterName: string;
}) {
  const baseUrl =
    process.env.NEXTAUTH_URL?.trim() || "http://localhost:3000";
  const acceptUrl = `${baseUrl}/invite/${invitation.token}`;
  const { subject, html, text } = teamInviteEmail({
    orgName,
    inviterName,
    acceptUrl,
    roleLabel: ROLE_LABELS[invitation.role] ?? "team member",
  });

  let resend: ReturnType<typeof getResend>;
  let from: string;
  try {
    resend = getResend();
    from = getFromAddress();
  } catch (e) {
    console.warn("teamInvite skipped — Resend not configured", {
      reason: e instanceof Error ? e.message : "unknown",
    });
    return;
  }

  await resend.emails.send({
    from,
    to: invitation.email,
    subject,
    html,
    text,
    headers: {
      "X-DonorLume-Lifecycle": "team-invite",
    },
  });
}

/**
 * DELETE /api/team/invites?id={invitationId}
 *
 * Revokes a pending invitation. Verifies org ownership before delete.
 */
export const DELETE = withOrg(async (req, { auth }) => {
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }
  const inv = await prisma.invitation.findFirst({
    where: { id, orgId: auth.org.id },
    select: { id: true },
  });
  if (!inv) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  await prisma.invitation.delete({ where: { id } });
  return NextResponse.json({ ok: true });
});
