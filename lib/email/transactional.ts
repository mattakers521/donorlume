/**
 * Transactional email senders — welcome + getting-started nudge.
 *
 * Each function is idempotent against the corresponding User.*SentAt
 * column (no-op if already sent). They use the same Resend client +
 * EMAIL_FROM as `lib/email/send.ts`, but skip the open/click tracking
 * pipeline entirely — these are lifecycle pings, not donor outreach.
 *
 * Always fire-and-forget from request handlers; failures log and are
 * swallowed so a flaky Resend doesn't break signup.
 */

import "server-only";

import type { Organization, User } from "@prisma/client";

import { getFromAddress, getResend } from "@/lib/email/resend";
import { gettingStartedEmail } from "@/lib/email/templates/getting-started";
import { passwordResetEmail } from "@/lib/email/templates/password-reset";
import { welcomeEmail } from "@/lib/email/templates/welcome";
import { prisma } from "@/lib/prisma";

type SendArgs = { user: User; org: Pick<Organization, "name"> };

export async function sendWelcomeEmail({
  user,
  org,
}: SendArgs): Promise<{ kind: "sent" | "skipped"; reason?: string }> {
  if (user.welcomeSentAt) return { kind: "skipped", reason: "already-sent" };
  if (!user.email) return { kind: "skipped", reason: "no-email" };
  if (!user.notifyWelcomeEmails)
    return { kind: "skipped", reason: "opted-out" };

  const { subject, html, text } = welcomeEmail({
    recipientName: user.name ?? user.email,
    orgName: org.name,
  });

  try {
    const resend = getResend();
    const from = getFromAddress();
    const result = await resend.emails.send({
      from,
      to: user.email,
      subject,
      html,
      text,
      headers: {
        "X-DonorLume-Lifecycle": "welcome",
        "X-DonorLume-User-Id": user.id,
      },
    });
    if (result.error) {
      console.error("welcome email Resend error", {
        userId: user.id,
        error: result.error,
      });
      return { kind: "skipped", reason: result.error.message ?? "resend-error" };
    }
    await prisma.user.update({
      where: { id: user.id },
      data: { welcomeSentAt: new Date() },
    });
    return { kind: "sent" };
  } catch (e) {
    console.error("sendWelcomeEmail failed", { userId: user.id, error: e });
    return {
      kind: "skipped",
      reason: e instanceof Error ? e.message : "unknown",
    };
  }
}

/**
 * Sends the password-reset email. Caller already minted the token and
 * persisted it on the User row; this function only renders the email
 * and hands it to Resend.
 *
 * Returns a tagged status so the calling route can decide what to log;
 * it never throws — a Resend outage shouldn't crash /forgot-password
 * (and we never reveal whether the email succeeded to the user anyway,
 * per the anti-enumeration policy in the route).
 */
export async function sendPasswordResetEmail({
  user,
  token,
}: {
  user: Pick<User, "id" | "email" | "name">;
  token: string;
}): Promise<{ kind: "sent" | "skipped"; reason?: string }> {
  if (!user.email) return { kind: "skipped", reason: "no-email" };

  const { subject, html, text } = passwordResetEmail({
    recipientName: user.name,
    token,
  });

  try {
    const resend = getResend();
    const from = getFromAddress();
    const result = await resend.emails.send({
      from,
      to: user.email,
      subject,
      html,
      text,
      headers: {
        "X-DonorLume-Lifecycle": "password-reset",
        "X-DonorLume-User-Id": user.id,
      },
    });
    if (result.error) {
      console.error("password-reset email Resend error", {
        userId: user.id,
        error: result.error,
      });
      return {
        kind: "skipped",
        reason: result.error.message ?? "resend-error",
      };
    }
    return { kind: "sent" };
  } catch (e) {
    console.error("sendPasswordResetEmail failed", { userId: user.id, error: e });
    return {
      kind: "skipped",
      reason: e instanceof Error ? e.message : "unknown",
    };
  }
}

export async function sendGettingStartedNudge({
  user,
  org,
}: SendArgs): Promise<{ kind: "sent" | "skipped"; reason?: string }> {
  if (user.gettingStartedNudgeSentAt)
    return { kind: "skipped", reason: "already-sent" };
  if (!user.email) return { kind: "skipped", reason: "no-email" };
  if (!user.notifyGettingStartedNudges)
    return { kind: "skipped", reason: "opted-out" };

  const { subject, html, text } = gettingStartedEmail({
    recipientName: user.name ?? user.email,
    orgName: org.name,
  });

  try {
    const resend = getResend();
    const from = getFromAddress();
    const result = await resend.emails.send({
      from,
      to: user.email,
      subject,
      html,
      text,
      headers: {
        "X-DonorLume-Lifecycle": "getting-started",
        "X-DonorLume-User-Id": user.id,
      },
    });
    if (result.error) {
      console.error("getting-started email Resend error", {
        userId: user.id,
        error: result.error,
      });
      return { kind: "skipped", reason: result.error.message ?? "resend-error" };
    }
    await prisma.user.update({
      where: { id: user.id },
      data: { gettingStartedNudgeSentAt: new Date() },
    });
    return { kind: "sent" };
  } catch (e) {
    console.error("sendGettingStartedNudge failed", {
      userId: user.id,
      error: e,
    });
    return {
      kind: "skipped",
      reason: e instanceof Error ? e.message : "unknown",
    };
  }
}
