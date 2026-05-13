import {
  baseUrl,
  renderEmail,
  type EmailContent,
} from "@/lib/email/templates/layout";

export type GettingStartedContext = {
  recipientName: string;
  orgName: string;
};

export function gettingStartedEmail({
  recipientName,
  orgName,
}: GettingStartedContext): { subject: string; html: string; text: string } {
  const firstName = recipientName.trim().split(/\s+/)[0] || "there";
  const content: EmailContent = {
    preheader: `One CSV upload is all it takes to see your lapsed donors scored and ranked.`,
    heading: `${firstName} — five minutes to your first scored list.`,
    paragraphs: [
      `Yesterday you set up ${orgName} on DonorLume — and the fastest way to feel the value is sitting one CSV upload away.`,
      `Export a donor list from your CRM (Bloomerang, Salesforce, Little Green Light, Kindful, DonorPerfect) or event platform (OneCause, GiveButter, BetterUnite, Givesmart, Greater Giving) — anything that exports a spreadsheet works. DonorLume auto-detects column names, scores every lapsed donor 0–100 across recency / frequency / monetary / tenure, and groups them into cohorts you can filter and act on.`,
      `If you’d rather see the flow before exporting a real list, click “Load Sample Data” on the Lapsed page — we ship a 9-donor demo CSV that exercises every cohort.`,
    ],
    cta: {
      label: "Upload your first donor list →",
      href: `${baseUrl()}/lapsed`,
    },
    postscript:
      "Stuck on what to upload, or want a hand mapping a tricky CRM export? Reply to this email — Matt reads every reply personally.",
  };
  return {
    subject: `${firstName}, ready to upload your first donor list?`,
    ...renderEmail(content),
  };
}
