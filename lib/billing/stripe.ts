import "server-only";

import Stripe from "stripe";

/**
 * Lazy Stripe singleton — avoids throwing at module-load when
 * STRIPE_SECRET_KEY is unset (dev). Route handlers call getStripe()
 * inside the request path so a missing key surfaces as a clean 500
 * with a clear message instead of a stack trace from import.
 */

let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (_stripe) return _stripe;
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key || key.startsWith("sk_test_REPLACE")) {
    throw new Error(
      "STRIPE_SECRET_KEY is not set. Add a key from https://dashboard.stripe.com/test/apikeys to .env",
    );
  }
  _stripe = new Stripe(key, {
    // Pin a stable API version so a transparent Stripe rollout can't
    // change webhook payload shapes under us. Update intentionally
    // when we bump our integration.
    apiVersion: "2025-10-29.clover" as Stripe.LatestApiVersion,
    typescript: true,
  });
  return _stripe;
}

export function getWebhookSecret(): string {
  const v = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!v || v.startsWith("whsec_REPLACE")) {
    throw new Error(
      "STRIPE_WEBHOOK_SECRET is not set. Copy it from your Stripe webhook endpoint.",
    );
  }
  return v;
}
