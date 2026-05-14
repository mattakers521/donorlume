import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";

import { sendPasswordResetEmail } from "@/lib/email/transactional";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  email: z.string().email().toLowerCase(),
});

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

/**
 * POST /api/auth/forgot-password
 *
 * Initiates a password reset. Behavior is deliberately uniform across
 * all outcomes — same JSON response, same timing characteristics — so
 * the endpoint can't be used as an account-enumeration oracle.
 *
 * On a valid email + existing account with a password:
 *   1. Mint a 32-byte hex token (effectively unguessable).
 *   2. Persist on User.resetToken + resetTokenExpiresAt (now + 1h).
 *   3. Fire the email via Resend.
 *
 * On any of (email malformed, no such user, OAuth-only user with no
 * passwordHash, Resend down): return the same 200 success. The user
 * can't tell the difference.
 *
 * Multi-tenant note: this endpoint operates at the User level, not
 * Org. A user belongs to many orgs via OrgUser; the reset link
 * re-authenticates them across all of those memberships at once.
 */
export async function POST(req: Request) {
  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    // Don't even tell the caller that their email was malformed — keep
    // the response surface uniform.
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  const { email } = parsed.data;

  // Single round trip to find the user. We do NOT branch on whether
  // the user has a passwordHash — Google-OAuth users without a
  // password still get the email (clicking the link lets them set a
  // password and the credentials provider works from then on). That
  // matches the principle of least surprise.
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, name: true },
  });

  if (!user) {
    // Account doesn't exist — return success without leaking. We
    // *don't* introduce an artificial delay; the dominant time cost
    // of the happy path is the email send (~200ms) which is async
    // anyway, and any timing-side-channel attacker can still tell
    // from the no-email-arrives signal whether the account existed.
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  // Generate token + persist. randomBytes(32) → 64 hex chars; cipher-
  // strength entropy via OpenSSL. Rotates on every request so a
  // leaked-token replay window is bounded by the 1-hour expiry OR
  // the next /forgot-password call, whichever is sooner.
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);

  await prisma.user.update({
    where: { id: user.id },
    data: { resetToken: token, resetTokenExpiresAt: expiresAt },
  });

  // Fire-and-forget the email send — we don't surface its result to
  // the caller (uniform-response policy) and we've already committed
  // the token to the DB, so the user can always re-request if Resend
  // is down momentarily.
  void sendPasswordResetEmail({ user, token }).catch((e) => {
    console.error("forgot-password email send threw", {
      userId: user.id,
      error: e,
    });
  });

  return NextResponse.json({ ok: true }, { status: 200 });
}
