import { type NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";

import { planFromPriceId, type PlanKey } from "@/lib/billing/plans";
import { getStripe, getWebhookSecret } from "@/lib/billing/stripe";
import { notifyAdmin } from "@/lib/notifications/admin";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/webhooks/stripe
 *
 * Listens for the four subscription-lifecycle events that drive the
 * Organization billing state:
 *   - customer.subscription.created   → first checkout (or trial start)
 *   - customer.subscription.updated   → plan change / cancel-at-period-end
 *   - customer.subscription.deleted   → terminal state (subscription ended)
 *   - invoice.payment_failed          → mark stripeStatus = "past_due"
 *
 * Verifies the Stripe signature, then either resolves the org by
 * stripeCustomerId (most common) or, for the very first checkout, by
 * the `client_reference_id` we set on Checkout Session create.
 *
 * Idempotent: Stripe retries with the same event ID. Our writes use
 * primary-key lookups + `update`, so a retried event re-applies the
 * same state without side effects.
 */
export async function POST(req: NextRequest) {
  const sig = req.headers.get("stripe-signature");
  if (!sig) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let stripe: ReturnType<typeof getStripe>;
  let secret: string;
  try {
    stripe = getStripe();
    secret = getWebhookSecret();
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Stripe not configured." },
      { status: 500 },
    );
  }

  // Body must be the RAW text — Stripe signs the exact bytes that were
  // POSTed, so we can't rely on Next's JSON parser.
  const rawBody = await req.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, secret);
  } catch (err) {
    console.error("Stripe webhook signature verification failed", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "customer.subscription.created":
      case "customer.subscription.updated":
        await applySubscription(event.data.object as Stripe.Subscription);
        break;
      case "customer.subscription.deleted":
        await applySubscriptionDeleted(
          event.data.object as Stripe.Subscription,
        );
        break;
      case "invoice.payment_failed":
        await applyPaymentFailed(event.data.object as Stripe.Invoice);
        break;
      default:
        // Acknowledge unknown events so Stripe stops retrying. Logging at
        // info level keeps the webhooks dashboard quiet.
        console.log(`stripe webhook: ignoring event ${event.type}`);
    }
  } catch (e) {
    console.error("Stripe webhook handler crashed", { eventType: event.type, e });
    // Returning 500 makes Stripe retry — which is what we want for
    // transient DB issues. Stripe gives up after the retry schedule
    // (~3 days), and we'll have logs to triage.
    return NextResponse.json(
      { error: "Handler error" },
      { status: 500 },
    );
  }

  return NextResponse.json({ received: true }, { status: 200 });
}

// ─── Event handlers ────────────────────────────────────────────────────

async function applySubscription(sub: Stripe.Subscription) {
  const customerId =
    typeof sub.customer === "string" ? sub.customer : sub.customer.id;

  // Most-precise → least-precise lookup. We first try by saved customer
  // (steady-state path), then fall back to the orgId stamped on the
  // subscription metadata (first-checkout path).
  const org =
    (await prisma.organization.findFirst({
      where: { stripeCustomerId: customerId },
    })) ??
    (sub.metadata?.orgId
      ? await prisma.organization.findUnique({
          where: { id: sub.metadata.orgId },
        })
      : null);

  if (!org) {
    console.warn("Stripe webhook: no org found for subscription", {
      subscriptionId: sub.id,
      customerId,
      metadataOrgId: sub.metadata?.orgId,
    });
    return;
  }

  // The plan tier is whichever PRICE this subscription is currently on.
  // A multi-item subscription would need a different model; we constrain
  // checkout to single-line subscriptions so this assumption holds.
  const item = sub.items.data[0];
  const priceId = item?.price.id ?? sub.metadata?.priceId ?? null;
  const matched = priceId ? planFromPriceId(priceId) : null;
  const planKey: PlanKey = matched?.plan.key ?? (org.plan as PlanKey);

  const previousPlan = org.plan as PlanKey;
  const isUpgrade = orderRank(planKey) > orderRank(previousPlan);

  const currentPeriodEnd = item?.current_period_end
    ? new Date(item.current_period_end * 1000)
    : null;
  const trialEndsAt = sub.trial_end ? new Date(sub.trial_end * 1000) : null;

  await prisma.organization.update({
    where: { id: org.id },
    data: {
      plan: planKey,
      stripeCustomerId: customerId,
      stripeSubscriptionId: sub.id,
      stripePriceId: priceId,
      stripeStatus: sub.status,
      currentPeriodEnd,
      trialEndsAt,
      cancelAtPeriodEnd: sub.cancel_at_period_end ?? false,
    },
  });

  if (isUpgrade) {
    notifyAdmin("plan-upgrade", {
      orgName: org.name,
      fromPlan: previousPlan,
      toPlan: planKey,
    });
  }
}

async function applySubscriptionDeleted(sub: Stripe.Subscription) {
  const customerId =
    typeof sub.customer === "string" ? sub.customer : sub.customer.id;
  const org = await prisma.organization.findFirst({
    where: { stripeCustomerId: customerId },
  });
  if (!org) return;

  await prisma.organization.update({
    where: { id: org.id },
    data: {
      stripeSubscriptionId: null,
      stripePriceId: null,
      stripeStatus: "canceled",
      cancelAtPeriodEnd: false,
      // Plan field is left alone — the org keeps its tier label for UI
      // continuity until they re-subscribe. Access gating runs off
      // stripeStatus, not plan, for canceled accounts.
    },
  });
}

async function applyPaymentFailed(invoice: Stripe.Invoice) {
  const customerId =
    typeof invoice.customer === "string"
      ? invoice.customer
      : invoice.customer?.id;
  if (!customerId) return;

  const org = await prisma.organization.findFirst({
    where: { stripeCustomerId: customerId },
  });
  if (!org) return;

  await prisma.organization.update({
    where: { id: org.id },
    data: { stripeStatus: "past_due" },
  });
}

// ─── helpers ───────────────────────────────────────────────────────────

const PLAN_RANK: Record<PlanKey, number> = {
  STARTER: 1,
  GROWTH: 2,
  SCALE: 3,
  ENTERPRISE: 4,
};
function orderRank(p: PlanKey): number {
  return PLAN_RANK[p] ?? 0;
}
