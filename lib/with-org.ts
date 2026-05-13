import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import type { Organization, Role, User } from "@prisma/client";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export type OrgContext = {
  userId: string;
  org: Organization;
  orgRole: Role;
};

/**
 * Server Component / Server Action variant of `withOrg`.
 *
 * Resolves the calling user + their first OrgUser membership.
 * Redirects to /login if unauthenticated, /login?error=no_org if the user
 * has no OrgUser yet (current gap: Google OAuth signups don't auto-create
 * an org — replace with /onboarding once that flow exists).
 */
export async function getOrgContext(): Promise<{
  userId: string;
  user: Pick<User, "id" | "email" | "name" | "image" | "dismissedOnboarding">;
  org: Organization;
  orgRole: Role;
}> {
  const session = await auth();
  if (!session?.user?.id) {
    console.warn("[ctx-trace] getOrgContext: no session → redirect(/login)");
    redirect("/login");
  }

  const userId = session.user.id;
  const orgUser = await prisma.orgUser.findFirst({
    where: { userId },
    include: {
      org: true,
      user: {
        select: {
          id: true,
          email: true,
          name: true,
          image: true,
          lastActiveAt: true,
          inactiveSlackedAt: true,
          dismissedOnboarding: true,
        },
      },
    },
  });
  if (!orgUser) {
    // Authed but no Organization yet — typically a Google OAuth signup
    // (the provider creates a User row but no OrgUser). Send them to the
    // org-creation form instead of bouncing back to /login.
    console.warn(
      `[ctx-trace] getOrgContext: session userId=${userId} but NO orgUser found → redirect(/onboarding) → likely chains to /dashboard`,
    );
    redirect("/onboarding");
  }
  console.log(
    `[ctx-trace] getOrgContext OK: userId=${userId} orgId=${orgUser.org.id} role=${orgUser.role}`,
  );

  // Throttled activity heartbeat — only bump lastActiveAt at most once an
  // hour so we don't pound the DB on every page render. Also clear the
  // inactiveSlackedAt flag so the user re-arms for a future churn alert.
  const ONE_HOUR = 60 * 60 * 1000;
  const last = orgUser.user.lastActiveAt;
  if (!last || Date.now() - last.getTime() > ONE_HOUR) {
    void prisma.user
      .update({
        where: { id: userId },
        data: { lastActiveAt: new Date(), inactiveSlackedAt: null },
      })
      .catch(() => {});
  }

  return {
    userId,
    user: orgUser.user,
    org: orgUser.org,
    orgRole: orgUser.role,
  };
}

type RouteContext<P> = { params: Promise<P> };

type Handler<P> = (
  req: Request,
  ctx: RouteContext<P> & { auth: OrgContext },
) => Response | Promise<Response>;

/**
 * App Router adaptation of Spec Section 7's `withOrg` middleware.
 *
 * Resolves the current session, finds the calling user's first OrgUser
 * membership, and passes `{ userId, org, orgRole }` into the handler.
 * Every DB query inside the handler MUST filter by `auth.org.id` to
 * preserve multi-tenant isolation.
 *
 * NOTE: A user can belong to multiple orgs via OrgUser. This picks the
 * first one returned. Once we add an org switcher, swap this for an
 * explicit org selection (e.g., from a cookie or header).
 */
export function withOrg<P = Record<string, string | string[]>>(
  handler: Handler<P>,
) {
  return async (req: Request, ctx: RouteContext<P>) => {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const orgUser = await prisma.orgUser.findFirst({
      where: { userId: session.user.id },
      include: { org: true },
    });
    if (!orgUser) {
      return NextResponse.json(
        { error: "No organization" },
        { status: 403 },
      );
    }

    return handler(req, {
      ...ctx,
      auth: {
        userId: session.user.id,
        org: orgUser.org,
        orgRole: orgUser.role,
      },
    });
  };
}
