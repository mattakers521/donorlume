import { NextResponse } from "next/server";

import { getStripe } from "@/lib/billing/stripe";
import { prisma } from "@/lib/prisma";
import { withOrg } from "@/lib/with-org";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/billing/portal
 *
 * Creates a Stripe Billing Portal session for the calling org's customer
 * and returns its hosted URL. Stripe handles update-card / change-plan /
 * cancel flows; on close the customer lands back at /settings/billing.
 *
 * 404s if the org has never checked out (no stripeCustomerId yet) —
 * the UI hides the "Manage subscription" button in that case.
 */
export const POST = withOrg(async (_req, { auth }) => {
  const org = await prisma.organization.findUnique({
    where: { id: auth.org.id },
    select: { stripeCustomerId: true },
  });
  if (!org?.stripeCustomerId) {
    return NextResponse.json(
      { error: "No billing account yet — start by selecting a plan." },
      { status: 404 },
    );
  }

  let stripe: ReturnType<typeof getStripe>;
  try {
    stripe = getStripe();
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Stripe is not configured." },
      { status: 500 },
    );
  }

  const baseUrl =
    process.env.NEXTAUTH_URL?.trim() || "http://localhost:3000";

  const portalSession = await stripe.billingPortal.sessions.create({
    customer: org.stripeCustomerId,
    return_url: `${baseUrl}/settings/billing`,
  });

  return NextResponse.json({ url: portalSession.url }, { status: 200 });
});
