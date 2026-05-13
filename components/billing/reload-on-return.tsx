"use client";

import { useEffect } from "react";

/**
 * Constant + key used by the billing-page reload mechanism. Exported so
 * the buttons that initiate Stripe redirects can set the flag, and the
 * listener component below can read + clear it.
 */
export const CHECKOUT_IN_FLIGHT_KEY = "dl_checkout_in_flight";

/**
 * Forces a full reload whenever the billing page becomes visible AFTER
 * a checkout-button click — even if the user gets back here via the
 * browser back button, a tab switch, or closing the Stripe tab.
 *
 * Why this exists: clicking a plan calls `window.location.assign(stripeUrl)`.
 * Safari/Chrome/Firefox each handle the return trip differently:
 *
 *   • Sometimes the page is restored from the bfcache (`pageshow` with
 *     `persisted: true`).
 *   • Sometimes a `visibilitychange` fires when the tab refocuses.
 *   • Sometimes neither fires reliably (browser variance).
 *
 * Relying on any single signal leaves a hole. Instead we set a
 * sessionStorage flag the instant a button initiates a redirect, then
 * listen for ANY signal that the user is looking at the billing page
 * again. If the flag is still set, a checkout was in flight when they
 * left — reload to flush any half-baked state.
 *
 * sessionStorage is scoped to the tab session, so:
 *   • Closing the tab clears the flag (no stale-reload on a future tab).
 *   • The flag survives navigation away + bfcache restore + tab switching.
 *   • Stripe redirecting BACK to /settings/billing?checkout=success is a
 *     fresh full load — the page renders, clears the flag on mount, and
 *     subsequent tab switches don't fire spurious reloads.
 *
 * Renders nothing.
 */
export function ReloadOnReturn() {
  useEffect(() => {
    // Clear the flag at first mount. This handles the "Stripe redirected
    // back here as a success URL" case — the page is fresh, no reload
    // needed. The flag was set at click-time, persisted through the
    // round trip, and is now safe to discard. If we DON'T clear here,
    // the user's first tab-switch-back-to-this-page would trigger an
    // unnecessary reload.
    sessionStorage.removeItem(CHECKOUT_IN_FLIGHT_KEY);

    const maybeReload = () => {
      if (sessionStorage.getItem(CHECKOUT_IN_FLIGHT_KEY)) {
        sessionStorage.removeItem(CHECKOUT_IN_FLIGHT_KEY);
        window.location.reload();
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") maybeReload();
    };
    const onPageShow = (e: PageTransitionEvent) => {
      // pageshow with persisted=true is the bfcache signal. Some
      // browsers fire this without ever firing visibilitychange on
      // restore — keep it as a belt-and-suspenders backup.
      if (e.persisted) maybeReload();
    };
    const onFocus = () => maybeReload();

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pageshow", onPageShow);
    window.addEventListener("focus", onFocus);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pageshow", onPageShow);
      window.removeEventListener("focus", onFocus);
    };
  }, []);
  return null;
}
