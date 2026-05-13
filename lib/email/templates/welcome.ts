import {
  baseUrl,
  renderEmail,
  type EmailContent,
} from "@/lib/email/templates/layout";

export type WelcomeContext = {
  recipientName: string;
  orgName: string;
};

/**
 * First-touch welcome email. Sent the moment a user finishes signup.
 *
 * Goals (per the UX brief):
 *   • Warm, personal — leads with the user's first name and their org.
 *   • Clear — a numbered "Here's what to do first" block with 3 steps
 *     mirrors the dashboard onboarding checklist so the email and the
 *     app reinforce each other.
 *   • Prominent CTA — the gradient "Open DonorLume" button in the
 *     shared layout lands the user on the dashboard, where the
 *     checklist takes over.
 *   • Friendly footer — "reply to this email or chat with our AI
 *     assistant inside the app" so the user always has a next move
 *     even when they're not sure what to ask.
 */
export function welcomeEmail({
  recipientName,
  orgName,
}: WelcomeContext): { subject: string; html: string; text: string } {
  const firstName = recipientName.trim().split(/\s+/)[0] || "there";
  const content: EmailContent = {
    preheader: `${orgName} is set up on DonorLume. Here's where to start.`,
    heading: `Welcome to DonorLume, ${firstName}.`,
    paragraphs: [
      `${orgName} is set up and ready to go. DonorLume helps you find aligned funders, score lapsed donors for reactivation, and turn every list into personalized outreach — without the spreadsheet wrangling.`,
      `Most fundraisers feel real lift the very first session. Here's the fastest path:`,
    ],
    steps: {
      title: "Here's what to do first",
      items: [
        {
          title: "Search for a prospect",
          body: "Find a foundation aligned with your mission in seconds — we pull from every 990 filing the IRS has on record.",
        },
        {
          title: "Upload your donor list",
          body: "Drop in a CSV from any CRM. We auto-detect column names and score every lapsed donor 0–100 by reactivation priority.",
        },
        {
          title: "Generate your first outreach",
          body: "Pick a donor and let Claude write a personalized email referencing their actual giving history. Edit, copy, or send.",
        },
      ],
    },
    cta: {
      label: "Open DonorLume →",
      href: `${baseUrl()}/dashboard`,
    },
    postscript:
      "Questions? Reply to this email — it lands straight in our inbox. Or chat with the AI assistant inside the app (look for the spark in the bottom-right). — Matt Akers, Founder, Vibrant Causes",
  };
  return {
    subject: `Welcome to DonorLume, ${firstName}`,
    ...renderEmail(content),
  };
}
