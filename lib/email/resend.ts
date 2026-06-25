/**
 * Resend client singleton — Spec §1.
 *
 * Lazy-initialized so missing keys don't crash module evaluation; they
 * surface as a clean 500 in the send route instead.
 */

import "server-only";

import { Resend } from "resend";

let client: Resend | null = null;

export function getResend(): Resend {
  if (client) return client;
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    throw new Error(
      "RESEND_API_KEY is not set. Get a key at https://resend.com/api-keys, then add it to .env.",
    );
  }
  client = new Resend(key);
  return client;
}

export function getFromAddress(): string {
  const from = process.env.EMAIL_FROM?.trim();
  if (!from) {
    throw new Error(
      "EMAIL_FROM is not set. Use `\"Name <addr@domain>\"` or bare `\"addr@domain\"`.",
    );
  }
  return from;
}

/**
 * Pulls the `addr@domain` part out of `EMAIL_FROM`, which arrives in
 * either bare (`addr@domain`) or RFC-2822 angle-wrapped (`Name
 * <addr@domain>`) form. Returns null when the env var is unset or
 * unparseable — callers should treat that as a configuration error,
 * not a domain check.
 */
export function getFromEmail(): string | null {
  const raw = process.env.EMAIL_FROM?.trim();
  if (!raw) return null;
  const angled = raw.match(/<([^>]+)>/);
  const candidate = (angled ? angled[1] : raw).trim().toLowerCase();
  return candidate.includes("@") ? candidate : null;
}

/**
 * True when the configured sender resolves to Resend's free test
 * domain (`*.resend.dev`). Those addresses only deliver to the Resend
 * account owner's own inbox — they're not real outbound sending. The
 * send route uses this to refuse real-customer sends with a 412 so
 * the UI can surface "Verify a sending domain first."
 */
export function isTestSendingDomain(): boolean {
  const addr = getFromEmail();
  if (!addr) return false;
  const domain = addr.split("@")[1] ?? "";
  return domain === "resend.dev" || domain.endsWith(".resend.dev");
}
