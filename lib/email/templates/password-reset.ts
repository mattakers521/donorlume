import {
  baseUrl,
  renderEmail,
  type EmailContent,
} from "@/lib/email/templates/layout";

export type PasswordResetContext = {
  recipientName: string | null;
  /** Raw reset token; appended to the URL as ?token=. */
  token: string;
};

/**
 * Password-reset email. Plain, single-purpose: who-is-this-for header,
 * one-sentence why, prominent "Reset Your Password" gradient button,
 * fine-print on the 1-hour expiry + the "ignore if you didn't request"
 * safety line.
 *
 * The reset URL uses `baseUrl()` which reads PUBLIC_BASE_URL or
 * NEXTAUTH_URL — so localhost emails point at http://localhost:3000
 * and production emails point at https://donorlume.com without code
 * changes.
 */
export function passwordResetEmail({
  recipientName,
  token,
}: PasswordResetContext): { subject: string; html: string; text: string } {
  const firstName = recipientName?.trim().split(/\s+/)[0] || "there";
  const resetUrl = `${baseUrl()}/reset-password?token=${encodeURIComponent(token)}`;

  const content: EmailContent = {
    preheader:
      "Reset your DonorLume password — the link expires in 1 hour.",
    heading: "Reset your password",
    paragraphs: [
      `Hi ${firstName} — someone (hopefully you) asked to reset the password on your DonorLume account.`,
      `Click the button below within the next hour to choose a new password. The link expires after that for your security.`,
    ],
    cta: {
      label: "Reset Your Password →",
      href: resetUrl,
    },
    postscript:
      "If you didn't request this, you can safely ignore this email — your password won't change. Questions? Reply to this email or contact support@donorlume.com.",
  };
  return {
    subject: "Reset your DonorLume password",
    ...renderEmail(content),
  };
}
