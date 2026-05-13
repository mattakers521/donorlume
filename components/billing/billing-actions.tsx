"use client";

import { useState } from "react";
import { ExternalLink, Loader2 } from "lucide-react";

import { C } from "@/lib/design";
import { CHECKOUT_IN_FLIGHT_KEY } from "@/components/billing/reload-on-return";

/**
 * Tells the page-level `<ReloadOnReturn />` listener that a Stripe
 * redirect is in flight. The listener clears this flag + reloads when
 * the page becomes visible again — back button, tab switch, anything.
 */
function markCheckoutInFlight() {
  try {
    sessionStorage.setItem(CHECKOUT_IN_FLIGHT_KEY, "1");
  } catch {
    // Private-browsing modes can throw on sessionStorage writes — the
    // worst case is the page won't auto-reload on return; not fatal.
  }
}

function clearCheckoutInFlight() {
  try {
    sessionStorage.removeItem(CHECKOUT_IN_FLIGHT_KEY);
  } catch {
    /* ignore */
  }
}

type Props = {
  hasStripeCustomer: boolean;
};

/**
 * "Manage subscription" button — opens the Stripe Billing Portal.
 * Hidden if the org has never checked out (no stripeCustomerId yet);
 * the plan-grid below the current-plan card handles first-time signup.
 */
export function BillingActions({ hasStripeCustomer }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!hasStripeCustomer) {
    return (
      <div
        style={{
          fontSize: 13,
          color: C.textSecondary,
          fontWeight: 500,
          textAlign: "right",
          maxWidth: 220,
        }}
      >
        Pick a plan below to start your subscription.
      </div>
    );
  }

  const openPortal = async () => {
    if (loading) return;
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/billing/portal", { method: "POST" });
      const body = (await res.json().catch(() => ({}))) as {
        url?: string;
        error?: string;
      };
      if (!res.ok || !body.url) {
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      // Set the flag right before navigating — paired with the page-
      // level <ReloadOnReturn /> listener, this triggers a reload when
      // the user comes back from the Stripe Portal.
      markCheckoutInFlight();
      window.location.assign(body.url);
    } catch (e) {
      clearCheckoutInFlight();
      setError(
        e instanceof Error
          ? e.message
          : "Couldn't open the billing portal — try again.",
      );
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-end",
        gap: 8,
      }}
    >
      <button
        type="button"
        onClick={openPortal}
        disabled={loading}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          padding: "12px 22px",
          borderRadius: 12,
          background: `linear-gradient(135deg, ${C.amber}, ${C.orange})`,
          color: "#fff",
          border: "none",
          fontSize: 14,
          fontWeight: 700,
          cursor: loading ? "default" : "pointer",
          opacity: loading ? 0.85 : 1,
          fontFamily: "var(--font-jakarta), sans-serif",
        }}
      >
        {loading ? (
          <Loader2 size={16} className="spin" />
        ) : (
          <ExternalLink size={16} />
        )}
        Manage subscription
      </button>
      {error && (
        <div style={{ fontSize: 12, color: C.red, fontWeight: 600 }}>
          {error}
        </div>
      )}
    </div>
  );
}

type CheckoutProps = {
  planKey: "STARTER" | "GROWTH" | "SCALE";
  interval: "monthly" | "annual";
  label?: string;
};

/**
 * Per-tier checkout button used inside the plan-comparison grid.
 * POSTs /api/billing/checkout and forwards to Stripe's hosted page.
 */
export function CheckoutPlanButton({
  planKey,
  interval,
  label,
}: CheckoutProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onClick = async () => {
    if (loading) return;
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: planKey, interval }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        url?: string;
        error?: string;
      };
      if (!res.ok || !body.url) {
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      // Flag the page as checkout-in-flight before redirecting so
      // <ReloadOnReturn /> auto-refreshes when the user comes back
      // (back button, tab switch, closed Stripe tab — any path).
      markCheckoutInFlight();
      window.location.assign(body.url);
    } catch (e) {
      clearCheckoutInFlight();
      setError(
        e instanceof Error
          ? e.message
          : "Couldn't start checkout — try again.",
      );
      setLoading(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <button
        type="button"
        onClick={onClick}
        disabled={loading}
        style={{
          display: "flex",
          width: "100%",
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
          padding: "10px 14px",
          borderRadius: 10,
          background: `linear-gradient(135deg, ${C.amber}, ${C.orange})`,
          color: "#fff",
          border: "none",
          fontSize: 13,
          fontWeight: 700,
          cursor: loading ? "default" : "pointer",
          opacity: loading ? 0.85 : 1,
          fontFamily: "var(--font-jakarta), sans-serif",
        }}
      >
        {loading && <Loader2 size={14} className="spin" />}
        {label ?? "Switch to this plan"}
      </button>
      {error && (
        <div style={{ fontSize: 11, color: C.red, fontWeight: 600 }}>
          {error}
        </div>
      )}
      {/* Legal note — Stripe's consent_collection.terms_of_service is
          available but requires a ToS URL set in the Stripe dashboard
          (Settings → Public details). Until that's configured, this
          inline line covers the legal disclosure. */}
      <p
        style={{
          margin: 0,
          fontSize: 11,
          lineHeight: 1.45,
          color: C.textTertiary,
          fontWeight: 500,
          textAlign: "center",
        }}
      >
        By subscribing, you agree to our{" "}
        <a
          href="/terms"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            color: C.textSecondary,
            fontWeight: 600,
            textDecoration: "underline",
            textUnderlineOffset: 2,
          }}
        >
          Terms of Service
        </a>{" "}
        and{" "}
        <a
          href="/privacy"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            color: C.textSecondary,
            fontWeight: 600,
            textDecoration: "underline",
            textUnderlineOffset: 2,
          }}
        >
          Privacy Policy
        </a>
        .
      </p>
    </div>
  );
}
