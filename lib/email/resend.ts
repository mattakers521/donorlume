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
