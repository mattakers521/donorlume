import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

import { getPlan } from "@/lib/billing/plans";
import { effectivePlan } from "@/lib/billing/trial";
import { C, shadow } from "@/lib/design";
import { prisma } from "@/lib/prisma";
import { getOrgContext } from "@/lib/with-org";
import { InviteForm } from "@/components/team/invite-form";
import { RevokeInviteButton } from "@/components/team/revoke-invite-button";
import { SectionCard } from "@/components/settings/settings-form";

export const dynamic = "force-dynamic";

const ROLE_LABELS: Record<string, string> = {
  OWNER: "Owner",
  ADMIN: "Admin",
  MEMBER: "Member",
  VIEWER: "Viewer",
};

const ROLE_TONES: Record<string, { bg: string; fg: string }> = {
  OWNER: { bg: C.amberLight, fg: C.amberDark },
  ADMIN: { bg: C.purpleLight, fg: C.purple },
  MEMBER: { bg: C.surfaceHover, fg: C.textSecondary },
  VIEWER: { bg: C.surfaceHover, fg: C.textSecondary },
};

function formatRelative(d: Date | null): string {
  if (!d) return "—";
  const ms = Date.now() - d.getTime();
  const minutes = Math.floor(ms / (60 * 1000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(d);
}

export default async function TeamPage() {
  const { org } = await getOrgContext();

  const [members, invitations] = await Promise.all([
    prisma.orgUser.findMany({
      where: { orgId: org.id },
      orderBy: { createdAt: "asc" },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            lastActiveAt: true,
            createdAt: true,
          },
        },
      },
    }),
    prisma.invitation.findMany({
      where: { orgId: org.id, acceptedAt: null },
      orderBy: { createdAt: "desc" },
      include: { invitedBy: { select: { name: true, email: true } } },
    }),
  ]);

  const planKey = effectivePlan(org.plan, org.trialEndsAt);
  const plan = getPlan(planKey);
  const seatLimit = plan.limits.seats;
  const pendingCount = invitations.filter(
    (i) => i.expiresAt > new Date(),
  ).length;
  const usedSeats = members.length + pendingCount;
  const overCap = seatLimit !== null && usedSeats >= seatLimit;
  const remaining = seatLimit === null ? null : seatLimit - usedSeats;

  return (
    <div style={{ padding: "8px clamp(0px, 2vw, 8px)" }}>
      <div style={{ maxWidth: 880 }}>
        {/* Seat-usage banner */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
            flexWrap: "wrap",
            padding: "14px 18px",
            borderRadius: 14,
            backgroundColor: C.surface,
            border: `1px solid ${C.border}`,
            boxShadow: shadow.sm,
            marginBottom: 20,
          }}
        >
          <div>
            <div
              style={{
                fontSize: 11,
                fontWeight: 800,
                color: C.amberDark,
                letterSpacing: 1.2,
                textTransform: "uppercase",
                marginBottom: 4,
              }}
            >
              Seats — {plan.name} plan
            </div>
            <div
              style={{
                fontFamily:
                  "var(--font-instrument-serif), Georgia, serif",
                fontSize: 24,
                color: C.text,
                letterSpacing: -0.5,
                lineHeight: 1,
              }}
            >
              <span style={{ color: C.amberDark }}>{members.length}</span>
              <span style={{ color: C.textTertiary }}>
                {" "}
                of {seatLimit === null ? "∞" : seatLimit}
              </span>
              {pendingCount > 0 && (
                <span
                  style={{
                    fontFamily: "var(--font-jakarta), sans-serif",
                    fontSize: 13,
                    color: C.textSecondary,
                    fontWeight: 600,
                    marginLeft: 10,
                  }}
                >
                  + {pendingCount} pending
                </span>
              )}
            </div>
          </div>
          <Link
            href="/settings/billing"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "10px 16px",
              borderRadius: 10,
              border: `1.5px solid ${C.text}`,
              color: C.text,
              fontSize: 13,
              fontWeight: 700,
              textDecoration: "none",
              backgroundColor: "transparent",
            }}
          >
            Manage plan <ArrowUpRight size={14} />
          </Link>
        </div>

        {/* Invite form */}
        <SectionCard
          title="Invite a teammate"
          description={
            remaining !== null
              ? `${remaining} seat${remaining === 1 ? "" : "s"} available on your ${plan.name} plan.`
              : `Unlimited seats on your ${plan.name} plan.`
          }
        >
          <InviteForm
            disabled={overCap}
            disabledMessage={
              seatLimit !== null
                ? `Your ${plan.name} plan supports ${seatLimit} team member${seatLimit === 1 ? "" : "s"}. Upgrade your plan to invite more.`
                : undefined
            }
          />
        </SectionCard>

        {/* Members table */}
        <SectionCard
          title="Members"
          description={`${members.length} active team member${members.length === 1 ? "" : "s"}.`}
        >
          <div className="app-scroll-x">
            <table
              style={{
                width: "100%",
                minWidth: 580,
                borderCollapse: "collapse",
              }}
            >
              <thead>
                <tr style={{ borderBottom: `1px solid ${C.borderSubtle}` }}>
                  <Th>Member</Th>
                  <Th>Role</Th>
                  <Th>Last active</Th>
                </tr>
              </thead>
              <tbody>
                {members.map((m) => {
                  const tone = ROLE_TONES[m.role] ?? {
                    bg: C.surfaceHover,
                    fg: C.textSecondary,
                  };
                  return (
                    <tr
                      key={m.id}
                      style={{ borderTop: `1px solid ${C.borderSubtle}` }}
                    >
                      <Td>
                        <div
                          style={{
                            fontSize: 14,
                            fontWeight: 700,
                            color: C.text,
                          }}
                        >
                          {m.user.name ?? m.user.email}
                        </div>
                        <div
                          style={{ fontSize: 12.5, color: C.textTertiary }}
                        >
                          {m.user.email}
                        </div>
                      </Td>
                      <Td>
                        <span
                          style={{
                            padding: "4px 10px",
                            borderRadius: 100,
                            fontSize: 11,
                            fontWeight: 800,
                            letterSpacing: 0.6,
                            textTransform: "uppercase",
                            backgroundColor: tone.bg,
                            color: tone.fg,
                          }}
                        >
                          {ROLE_LABELS[m.role] ?? m.role}
                        </span>
                      </Td>
                      <Td>
                        <span
                          style={{
                            fontSize: 13,
                            color: C.textSecondary,
                            fontWeight: 500,
                          }}
                        >
                          {formatRelative(m.user.lastActiveAt)}
                        </span>
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </SectionCard>

        {/* Pending invitations */}
        {invitations.length > 0 && (
          <SectionCard
            title="Pending invitations"
            description={`${invitations.length} invite${invitations.length === 1 ? "" : "s"} awaiting acceptance.`}
          >
            <div className="app-scroll-x">
              <table
                style={{
                  width: "100%",
                  minWidth: 580,
                  borderCollapse: "collapse",
                }}
              >
                <thead>
                  <tr style={{ borderBottom: `1px solid ${C.borderSubtle}` }}>
                    <Th>Email</Th>
                    <Th>Role</Th>
                    <Th>Sent</Th>
                    <Th />
                  </tr>
                </thead>
                <tbody>
                  {invitations.map((inv) => {
                    const expired = inv.expiresAt < new Date();
                    const tone = ROLE_TONES[inv.role] ?? {
                      bg: C.surfaceHover,
                      fg: C.textSecondary,
                    };
                    return (
                      <tr
                        key={inv.id}
                        style={{
                          borderTop: `1px solid ${C.borderSubtle}`,
                          opacity: expired ? 0.55 : 1,
                        }}
                      >
                        <Td>
                          <div
                            style={{
                              fontSize: 14,
                              fontWeight: 700,
                              color: C.text,
                            }}
                          >
                            {inv.email}
                          </div>
                          <div
                            style={{
                              fontSize: 12,
                              color: C.textTertiary,
                              fontWeight: 600,
                            }}
                          >
                            from{" "}
                            {inv.invitedBy.name ?? inv.invitedBy.email}
                          </div>
                        </Td>
                        <Td>
                          <span
                            style={{
                              padding: "4px 10px",
                              borderRadius: 100,
                              fontSize: 11,
                              fontWeight: 800,
                              letterSpacing: 0.6,
                              textTransform: "uppercase",
                              backgroundColor: tone.bg,
                              color: tone.fg,
                            }}
                          >
                            {ROLE_LABELS[inv.role] ?? inv.role}
                          </span>
                        </Td>
                        <Td>
                          <div
                            style={{
                              fontSize: 13,
                              color: C.textSecondary,
                              fontWeight: 500,
                            }}
                          >
                            {formatRelative(inv.createdAt)}
                          </div>
                          {expired && (
                            <div
                              style={{
                                fontSize: 11,
                                color: C.red,
                                fontWeight: 700,
                                marginTop: 2,
                              }}
                            >
                              Expired
                            </div>
                          )}
                        </Td>
                        <Td>
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "flex-end",
                            }}
                          >
                            <RevokeInviteButton id={inv.id} />
                          </div>
                        </Td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </SectionCard>
        )}
      </div>
    </div>
  );
}

function Th({ children }: { children?: React.ReactNode }) {
  return (
    <th
      style={{
        padding: "12px 16px",
        textAlign: "left",
        fontSize: 11,
        fontWeight: 800,
        color: C.textTertiary,
        textTransform: "uppercase",
        letterSpacing: 1,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </th>
  );
}

function Td({ children }: { children?: React.ReactNode }) {
  return (
    <td style={{ padding: "14px 16px", fontSize: 14, color: C.text }}>
      {children}
    </td>
  );
}
