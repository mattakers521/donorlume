import Link from "next/link";
import type { Session } from "next-auth";
import { ArrowRight, CheckCircle2, ShieldX } from "lucide-react";

import { auth } from "@/auth";
import { getPlan } from "@/lib/billing/plans";
import { effectivePlan } from "@/lib/billing/trial";
import { C, brandGradient } from "@/lib/design";
import { prisma } from "@/lib/prisma";
import { AcceptInviteButton } from "@/components/team/accept-invite-button";

export const dynamic = "force-dynamic";

const ROLE_LABELS: Record<string, string> = {
  OWNER: "Owner",
  ADMIN: "Admin",
  MEMBER: "Member",
  VIEWER: "Viewer",
};

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const invitation = await prisma.invitation.findUnique({
    where: { token },
    include: {
      org: {
        select: {
          name: true,
          plan: true,
          trialEndsAt: true,
        },
      },
      invitedBy: { select: { name: true, email: true } },
    },
  });

  const session = (await auth()) as Session | null;

  const now = new Date();
  const status = !invitation
    ? "missing"
    : invitation.acceptedAt
      ? "accepted"
      : invitation.expiresAt < now
        ? "expired"
        : "valid";

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "40px clamp(20px, 4vw, 56px)",
        backgroundColor: C.bg,
      }}
    >
      <div
        style={{
          maxWidth: 520,
          width: "100%",
          backgroundColor: C.surface,
          borderRadius: 22,
          padding: "clamp(28px, 4vw, 40px)",
          border: `1px solid ${C.border}`,
          boxShadow:
            "0 12px 40px rgba(0,0,0,0.08), 0 4px 12px rgba(0,0,0,0.04)",
        }}
      >
        {status === "missing" && (
          <CenterMsg
            icon={<ShieldX size={28} color={C.red} />}
            title="Invitation not found"
            body="This invite link is invalid. Ask the person who invited you to resend the invitation."
          />
        )}

        {status === "expired" && (
          <CenterMsg
            icon={<ShieldX size={28} color={C.amberDark} />}
            title="Invitation expired"
            body={`This invite has expired (older than 7 days). Ask ${invitation?.invitedBy.name ?? "your teammate"} to resend it.`}
          />
        )}

        {status === "accepted" && (
          <CenterMsg
            icon={<CheckCircle2 size={28} color={C.green} />}
            title="Already accepted"
            body={`You're already a member of ${invitation?.org.name}. Open the dashboard to keep going.`}
            cta={{ label: "Open DonorLume", href: "/dashboard" }}
          />
        )}

        {status === "valid" && invitation && (
          <ValidInviteView
            invitation={{
              token,
              email: invitation.email,
              role: invitation.role,
              orgName: invitation.org.name,
              inviterName:
                invitation.invitedBy.name ?? invitation.invitedBy.email,
            }}
            session={session}
            seatLimit={
              getPlan(
                effectivePlan(
                  invitation.org.plan,
                  invitation.org.trialEndsAt,
                ),
              ).limits.seats
            }
            orgId={invitation.orgId}
          />
        )}
      </div>
    </main>
  );
}

function CenterMsg({
  icon,
  title,
  body,
  cta,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  cta?: { label: string; href: string };
}) {
  return (
    <div style={{ textAlign: "center" }}>
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: 16,
          background: C.amberLight,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 18,
        }}
      >
        {icon}
      </div>
      <h1
        style={{
          fontFamily: "var(--font-instrument-serif), Georgia, serif",
          fontSize: 26,
          fontWeight: 400,
          color: C.text,
          margin: "0 0 8px",
          letterSpacing: -0.5,
        }}
      >
        {title}
      </h1>
      <p
        style={{
          fontSize: 15,
          lineHeight: 1.6,
          color: C.textBody,
          fontWeight: 500,
          margin: 0,
        }}
      >
        {body}
      </p>
      {cta && (
        <Link
          href={cta.href}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            marginTop: 22,
            padding: "12px 22px",
            borderRadius: 12,
            background: brandGradient,
            color: "#fff",
            fontSize: 14,
            fontWeight: 700,
            textDecoration: "none",
            boxShadow: "0 10px 24px rgba(232,134,12,0.30)",
          }}
        >
          {cta.label} <ArrowRight size={15} />
        </Link>
      )}
    </div>
  );
}

async function ValidInviteView({
  invitation,
  session,
  seatLimit,
  orgId,
}: {
  invitation: {
    token: string;
    email: string;
    role: string;
    orgName: string;
    inviterName: string;
  };
  session: Session | null;
  seatLimit: number | null;
  orgId: string;
}) {
  // Pre-check the seat limit one more time at view-time so users
  // don't click Accept only to be denied.
  let overCap = false;
  if (seatLimit !== null) {
    const memberCount = await prisma.orgUser.count({ where: { orgId } });
    overCap = memberCount >= seatLimit;
  }

  const isSignedInUnderInviteEmail =
    session?.user?.email?.toLowerCase() === invitation.email.toLowerCase();
  const isSignedInDifferent =
    !!session?.user?.email &&
    session.user.email.toLowerCase() !== invitation.email.toLowerCase();

  return (
    <div>
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          padding: "5px 11px",
          borderRadius: 100,
          background: C.amberLight,
          color: C.amberDark,
          fontSize: 11,
          fontWeight: 800,
          letterSpacing: 1.2,
          textTransform: "uppercase",
          marginBottom: 16,
        }}
      >
        Team invitation
      </div>
      <h1
        style={{
          fontFamily: "var(--font-instrument-serif), Georgia, serif",
          fontSize: "clamp(26px, 4vw, 32px)",
          fontWeight: 400,
          color: C.text,
          margin: "0 0 8px",
          letterSpacing: -0.6,
          lineHeight: 1.15,
        }}
      >
        You&rsquo;re invited to join{" "}
        <span
          style={{
            background: brandGradient,
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
          }}
        >
          {invitation.orgName}
        </span>
        .
      </h1>
      <p
        style={{
          fontSize: 15,
          lineHeight: 1.6,
          color: C.textBody,
          fontWeight: 500,
          margin: "0 0 20px",
        }}
      >
        {invitation.inviterName} added you as a{" "}
        <strong style={{ color: C.text }}>
          {ROLE_LABELS[invitation.role] ?? invitation.role}
        </strong>
        . Accept below to start using the workspace.
      </p>

      <div
        style={{
          padding: "14px 16px",
          borderRadius: 12,
          backgroundColor: C.bg,
          border: `1px solid ${C.border}`,
          marginBottom: 22,
          fontSize: 13.5,
          color: C.textBody,
          fontWeight: 500,
        }}
      >
        Invitation sent to{" "}
        <strong style={{ color: C.text }}>{invitation.email}</strong>.
      </div>

      {overCap ? (
        <div
          style={{
            padding: "14px 16px",
            borderRadius: 12,
            backgroundColor: C.redLight,
            color: C.red,
            fontSize: 13.5,
            fontWeight: 600,
            marginBottom: 18,
          }}
        >
          {invitation.orgName} has reached its plan&rsquo;s seat limit.
          Ask an admin to upgrade before accepting.
        </div>
      ) : isSignedInDifferent ? (
        <div
          style={{
            padding: "14px 16px",
            borderRadius: 12,
            backgroundColor: C.amberLight,
            color: C.amberDark,
            fontSize: 13.5,
            fontWeight: 600,
            marginBottom: 18,
          }}
        >
          You&rsquo;re signed in as{" "}
          <strong>{session?.user?.email}</strong>. Sign out and use{" "}
          <strong>{invitation.email}</strong> to accept this invitation.
        </div>
      ) : isSignedInUnderInviteEmail ? (
        <AcceptInviteButton token={invitation.token} />
      ) : (
        <Link
          href={`/signup?invite=${encodeURIComponent(invitation.token)}&email=${encodeURIComponent(invitation.email)}`}
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            width: "100%",
            padding: "14px 22px",
            borderRadius: 14,
            background: brandGradient,
            color: "#fff",
            fontSize: 15,
            fontWeight: 700,
            textDecoration: "none",
            boxShadow: "0 12px 30px rgba(232,134,12,0.30)",
          }}
        >
          Create your account <ArrowRight size={16} />
        </Link>
      )}

      <div
        style={{
          marginTop: 18,
          fontSize: 12.5,
          color: C.textTertiary,
          fontWeight: 500,
          textAlign: "center",
        }}
      >
        Already have a DonorLume account?{" "}
        <Link
          href={`/login?callbackUrl=${encodeURIComponent(`/invite/${invitation.token}`)}`}
          style={{ color: C.amberDark, fontWeight: 700 }}
        >
          Sign in
        </Link>{" "}
        to accept.
      </div>
    </div>
  );
}
