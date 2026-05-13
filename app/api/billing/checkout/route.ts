import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { z } from "zod";

import {
  getPlan,
  getStripePriceId,
  TRIAL_DAYS,
  type BillingInterval,
  type PlanKey,
} from "@/lib/billing/plans";
import { getStripe } from "@/lib/billing/stripe";
import { isInTrial } from "@/lib/billing/trial";
import { prisma } from "@/lib/prisma";
import { withOrg } from "@/lib/with-org";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  plan: z.enum(["STARTER", "GROWTH", "SCALE"]),
  interval: z.enum(["monthly", "annual"]).default("monthly"),
});

/**
 * POST /api/billing/checkout
 *
 * Creates a Stripe Checkout Session for the requested plan + interval
 * and returns its hosted URL. The client navigates to that URL — Stripe
 * handles the payment form, then redirects back to /settings/billing on
 * success (or back to billing with ?checkout=cancel).
 *
 * Trial handling:
 *  - If the org's in-app `trialEndsAt` is still in the future we pass
 *    `trial_end` (Unix timestamp) so Stripe honors the in-app trial
 *    start time (no double-trial — the user doesn't lose unused days).
 *  - Otherwise we give them a fresh `trial_period_days: 14` via Stripe.
 *  - `payment_method_collection: "always"` requires a card up front
 *    even during the trial — the customer isn't charged until trial
 *    end. This reduces post-trial drop-off compared to letting trials
 *    start cardless.
 *
 * Multi-tenant safe: the caller's orgId is captured both as the Stripe
 * customer's idempotency anchor (so re-clicking doesn't create duplicate
 * customers) and as `client_reference_id` (so the webhook can map the
 * resulting subscription back to this org even if no customer record
 * exists yet).
 *
 * ENTERPRISE has no Stripe price; calls for it return 400 — the UI
 * routes that tier to a `mailto:` link instead.
 */
export const POST = withOrg(async (req, { auth }) => {
  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid plan", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const planKey = parsed.data.plan as PlanKey;
  const interval: BillingInterval = parsed.data.interval;
  const planDef = getPlan(planKey);
  const priceId = getStripePriceId(planKey, interval);
  if (!priceId) {
    return NextResponse.json(
      {
        error: `${planDef.name} (${interval}) isn't configured for self-serve checkout. Contact sales for custom pricing.`,
      },
      { status: 400 },
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

  // Pull the org's existing Stripe customer + trial state so we can
  // honor the in-app trial start time and re-use the customer record.
  const org = await prisma.organization.findUnique({
    where: { id: auth.org.id },
    select: { stripeCustomerId: true, name: true, trialEndsAt: true },
  });

  // Need a billing contact for the customer record. We pick the caller's
  // own email rather than looking up the OrgUser/owner — the user
  // initiating checkout is by definition the one paying right now.
  const session = await prisma.user.findUnique({
    where: { id: auth.userId },
    select: { email: true, name: true },
  });

  const baseUrl =
    process.env.NEXTAUTH_URL?.trim() || "http://localhost:3000";

  // Build subscription_data: honor the in-app trial when active, else
  // grant a fresh 14-day Stripe trial. Either way Stripe collects a
  // payment method now (payment_method_collection: "always") but the
  // customer isn't charged until trial end.
  const subscriptionData: Stripe.Checkout.SessionCreateParams.SubscriptionData =
    {
      metadata: {
        orgId: auth.org.id,
        planKey: planDef.key,
        interval,
      },
    };
  if (org?.trialEndsAt && isInTrial(org.trialEndsAt)) {
    subscriptionData.trial_end = Math.floor(org.trialEndsAt.getTime() / 1000);
  } else {
    subscriptionData.trial_period_days = TRIAL_DAYS;
  }

  const checkoutSession = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: org?.stripeCustomerId ?? undefined,
    customer_email:
      org?.stripeCustomerId ? undefined : session?.email ?? undefined,
    client_reference_id: auth.org.id,
    line_items: [{ price: priceId, quantity: 1 }],
    subscription_data: subscriptionData,
    // Require a payment method at trial start. Stripe holds the card
    // and only charges it when the trial ends; the customer can update
    // it via the Billing Portal at any point.
    payment_method_collection: "always",
    metadata: {
      orgId: auth.org.id,
      planKey: planDef.key,
      interval,
    },
    success_url: `${baseUrl}/settings/billing?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${baseUrl}/settings/billing?checkout=cancel`,
    allow_promotion_codes: true,
    billing_address_collection: "auto",
  });

  return NextResponse.json({ url: checkoutSession.url }, { status: 200 });
});
