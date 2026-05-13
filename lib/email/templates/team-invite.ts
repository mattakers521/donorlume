/**
 * Team-invite email template — sent when an org member uses
 * /settings/team to invite a teammate. Reuses the shared layout so the
 * inline starburst + brand styling matches every other transactional
 * email.
 *
 * Tone goals (per the UX brief):
 *   • Warm — leads with the inviter's name and explicitly says what
 *     DonorLume *is* so the invitee doesn't have to guess.
 *   • Concrete — frames the value in plain terms ("find, score, and
 *     reach the right supporters").
 *   • Clear CTA — the shared layout renders an oversized amber gradient
 *     "Accept Invitation" button below the body.
 *   • Honest framing — "14-day free trial" so the invitee knows the
 *     org's plan state and isn't surprised at the door.
 */

import { renderEmail } from "@/lib/email/templates/layout";

export function teamInviteEmail({
  orgName,
  inviterName,
  acceptUrl,
  roleLabel,
}: {
  orgName: string;
  inviterName: string;
  acceptUrl: string;
  roleLabel: string;
}) {
  const subject = `${inviterName} invited you to join ${orgName} on DonorLume`;
  return {
    subject,
    ...renderEmail({
      preheader: `${inviterName} invited you to ${orgName} on DonorLume — accept to get started.`,
      heading: `${inviterName} invited you to join ${orgName}.`,
      paragraphs: [
        `DonorLume is a donor intelligence platform that helps your team find, score, and reach the right supporters — without the spreadsheet wrangling.`,
        `You'll be joining as a ${roleLabel} alongside ${inviterName} and the rest of the ${orgName} team. ${orgName} is currently on a 14-day free trial, so you'll have full access from the moment you accept.`,
        `Click the button below to set your password and land in the workspace. The link expires in 7 days — if you didn't expect this invitation, you can safely ignore it.`,
      ],
      cta: {
        label: "Accept Invitation →",
        href: acceptUrl,
      },
      postscript:
        "Questions? Reply to this email or chat with the AI assistant inside the app — we're happy to help.",
    }),
  };
}
