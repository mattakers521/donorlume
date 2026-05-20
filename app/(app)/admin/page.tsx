import { Plan } from "@prisma/client";

import { requireAdmin } from "@/lib/admin";
import { effectivePlan, isInTrial } from "@/lib/billing/trial";
import { prisma } from "@/lib/prisma";
import { AdminClient, type AdminUserRow, type AdminSummary } from "@/components/admin/admin-client";

export const dynamic = "force-dynamic";

/**
 * /admin — operator dashboard. Hard-gated by `requireAdmin()` which
 * redirects anyone other than ADMIN_EMAIL to /dashboard. Same gate
 * runs on /api/admin/* routes, so even a hand-crafted CSV-export URL
 * is locked down.
 *
 * Every aggregate is recomputed on each render (`force-dynamic`) so
 * the operator always sees fresh numbers — admin traffic is low
 * enough that a cache layer isn't worth the surprise factor.
 */
export default async function AdminPage() {
  await requireAdmin();

  const now = new Date();
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  // Parallel KPI queries + user roster + per-user activity counts in
  // a single round-trip. The user query carries everything the table
  // needs — orgs (first one), donor list totals, and the campaign
  // _count — so the page is one Prisma round-trip, no N+1.
  const [
    totalUsers,
    totalOrganizations,
    signupsLast24h,
    signupsLast7Days,
    activeUsers7d,
    users,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.organization.count(),
    prisma.user.count({ where: { createdAt: { gte: oneDayAgo } } }),
    prisma.user.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
    prisma.user.count({
      where: { lastActiveAt: { gte: sevenDaysAgo } },
    }),
    prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        email: true,
        createdAt: true,
        lastActiveAt: true,
        orgs: {
          orderBy: { createdAt: "asc" },
          take: 1,
          select: {
            org: {
              select: {
                id: true,
                name: true,
                plan: true,
                trialEndsAt: true,
                _count: { select: { outreachCampaigns: true } },
                donorLists: { select: { totalDonors: true } },
              },
            },
          },
        },
      },
    }),
  ]);

  const summary: AdminSummary = {
    totalUsers,
    totalOrganizations,
    signupsLast24h,
    signupsLast7Days,
    activeUsers7d,
  };

  // Project each user row into the flat shape the client table reads.
  // Plan + trial logic lives here (server) so the client component
  // doesn't need to import the billing helpers.
  const rows: AdminUserRow[] = users.map((u) => {
    const membership = u.orgs[0]?.org;
    const planLabel = membership
      ? planLabelFor(membership.plan, membership.trialEndsAt)
      : "—";
    const donorCount = membership
      ? membership.donorLists.reduce(
          (sum, dl) => sum + (dl.totalDonors ?? 0),
          0,
        )
      : 0;
    const campaignCount = membership?._count.outreachCampaigns ?? 0;
    return {
      id: u.id,
      name: u.name ?? "",
      email: u.email,
      orgName: membership?.name ?? "—",
      signupAt: u.createdAt.toISOString(),
      lastActiveAt: u.lastActiveAt?.toISOString() ?? null,
      plan: planLabel,
      donorCount,
      campaignCount,
    };
  });

  return <AdminClient summary={summary} rows={rows} />;
}

/**
 * Pretty plan label for the admin table. During trial, shows "Trial"
 * regardless of the underlying selected-plan column (matches the
 * billing page's "Trial access" framing). Otherwise the title-cased
 * plan name.
 */
function planLabelFor(plan: Plan, trialEndsAt: Date | null): string {
  if (isInTrial(trialEndsAt)) return "Trial";
  const eff = effectivePlan(plan, trialEndsAt);
  switch (eff) {
    case "STARTER":
      return "Starter";
    case "GROWTH":
      return "Growth";
    case "SCALE":
      return "Scale";
    case "ENTERPRISE":
      return "Enterprise";
    default:
      return eff;
  }
}
