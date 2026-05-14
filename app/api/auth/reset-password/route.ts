import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";

import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  token: z.string().min(32).max(128),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

/**
 * POST /api/auth/reset-password
 *
 * Consumes the reset token, hashes the new password, and atomically
 * clears the token so it can't be reused.
 *
 * Error responses are intentionally specific (4xx + message) — unlike
 * /forgot-password where uniformity protects account enumeration, this
 * endpoint already requires the user to hold a valid token, so leaking
 * "token expired" vs "token invalid" doesn't broaden the attack
 * surface. Clear feedback helps the legitimate user know whether to
 * request a new email or check their network.
 */
export async function POST(req: Request) {
  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error:
          parsed.error.issues[0]?.message ?? "Invalid token or password.",
      },
      { status: 400 },
    );
  }

  const { token, password } = parsed.data;

  const user = await prisma.user.findUnique({
    where: { resetToken: token },
    select: {
      id: true,
      email: true,
      resetTokenExpiresAt: true,
    },
  });

  if (!user) {
    return NextResponse.json(
      {
        error:
          "This reset link isn't valid. It may have been used already — request a new one if you still need to reset.",
      },
      { status: 400 },
    );
  }

  // Expiry check is independent of token-presence check so we surface
  // a precise message — "expired" tells the user "the link aged out;
  // request a new one" instead of the more cryptic "invalid".
  if (
    !user.resetTokenExpiresAt ||
    user.resetTokenExpiresAt.getTime() < Date.now()
  ) {
    // Clean up the dead token to keep the row tidy.
    await prisma.user.update({
      where: { id: user.id },
      data: { resetToken: null, resetTokenExpiresAt: null },
    });
    return NextResponse.json(
      {
        error:
          "This reset link has expired. Request a new one from /forgot-password.",
      },
      { status: 400 },
    );
  }

  // Hash + atomically swap: new passwordHash in, token cleared. Cost
  // 12 matches the register route (~250 ms on modern hardware — slow
  // enough to deter brute-force, fast enough that signup feels OK).
  const passwordHash = await bcrypt.hash(password, 12);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash,
      resetToken: null,
      resetTokenExpiresAt: null,
    },
  });

  return NextResponse.json(
    { ok: true, email: user.email },
    { status: 200 },
  );
}
