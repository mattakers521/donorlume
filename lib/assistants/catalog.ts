/**
 * AI Assistants hub (Phase 1 Feature 2) — the catalog.
 *
 * Exactly two assistants for Phase 1. Each quick-start is a one-click
 * starting point; its `task` text becomes the user prompt. Pure module
 * (no `server-only`) so the page, the API route, and tests share it.
 */

import { PROMPT_TIME_ZONE } from "@/lib/ai/writing-rules";

export type AssistantId = "content-writer" | "campaign-creator";

/**
 * Output shape for a quick-start:
 *   email    → "Subject:" line + body (can be pushed into AI Outreach)
 *   social   → post text, hashtags allowed
 *   blurb    → newsletter paragraph(s), no subject
 *   campaign → brief + 3-email sequence (see lib/assistants/campaign.ts)
 */
export type OutputFormat = "email" | "social" | "blurb" | "campaign";

export type QuickStart = {
  id: string;
  label: string;
  format: OutputFormat;
  /** Outreach email type to preselect when handing off to /outreach/new. */
  outreachEmailType?: "impact_update" | "year_end" | "event_invite";
  /** Adds this year's Giving Tuesday date to the prompt context. */
  givingTuesday?: true;
  task: string;
};

export type Assistant = {
  id: AssistantId;
  name: string;
  description: string;
  quickStarts: QuickStart[];
};

export const ASSISTANTS: Assistant[] = [
  {
    id: "content-writer",
    name: "Content Writer",
    description:
      "Ready-to-edit copy in your voice — thank-yous, appeals, social posts, and newsletter pieces.",
    quickStarts: [
      {
        id: "thank-you-email",
        label: "Thank-you email",
        format: "email",
        outreachEmailType: "impact_update",
        task: "Write a thank-you email to supporters who recently gave. Open with a greeting that works for any supporter (such as \"Dear friend,\"). Thank them sincerely, connect their support to the mission and the community served, and do not ask for another gift. Keep it under 200 words.",
      },
      {
        id: "year-end-appeal",
        label: "Year-end appeal",
        format: "email",
        outreachEmailType: "year_end",
        task: "Write a year-end appeal email to the organization's supporters. Open with a greeting that works for any supporter (such as \"Dear friend,\"). Reflect on the year in general terms drawn from the mission, explain why year-end support matters, and make one clear, warm ask. Keep it under 250 words.",
      },
      {
        id: "giving-tuesday-post",
        label: "Giving Tuesday post",
        format: "social",
        givingTuesday: true,
        task: "Write one social media post for Giving Tuesday that works on Facebook, Instagram, and LinkedIn. 50 to 100 words, warm and specific to the mission and community served, with one clear call to give. End with 2 or 3 relevant hashtags, including #GivingTuesday. Output only the post text.",
      },
      {
        id: "newsletter-blurb",
        label: "Newsletter blurb",
        format: "blurb",
        task: "Write a short newsletter piece (80 to 150 words) for the organization's supporters: a short headline on its own line, then one or two paragraphs that share what the organization is focused on and how readers can stay involved. Output only the headline and paragraphs.",
      },
    ],
  },
  {
    id: "campaign-creator",
    name: "Campaign Creator",
    description:
      "A campaign brief — audience, message arc, and timeline — plus a three-email sequence to run it.",
    quickStarts: [
      {
        id: "giving-tuesday-campaign",
        label: "Giving Tuesday campaign",
        format: "campaign",
        givingTuesday: true,
        task: "Plan a Giving Tuesday campaign: a teaser before the day, a Giving Tuesday morning ask, and a final-hours reminder on the day itself.",
      },
      {
        id: "30-day-challenge",
        label: "30-day challenge",
        format: "campaign",
        task: "Plan a 30-day giving challenge that starts about two weeks from today: a launch email, a midpoint progress email, and a final-days email.",
      },
      {
        id: "event-follow-up",
        label: "Event follow-up",
        format: "campaign",
        task: "Plan a follow-up sequence for people who attended a recent event: a thank-you for coming, a story connected to the mission, and an invitation to give or get involved.",
      },
    ],
  },
];

export function findQuickStart(
  assistantId: string,
  quickStartId: string,
): { assistant: Assistant; quickStart: QuickStart } | null {
  const assistant = ASSISTANTS.find((a) => a.id === assistantId);
  const quickStart = assistant?.quickStarts.find((q) => q.id === quickStartId);
  return assistant && quickStart ? { assistant, quickStart } : null;
}

/**
 * Giving Tuesday is the Tuesday after U.S. Thanksgiving (the fourth
 * Thursday of November). Returns the next one on or after `today`,
 * where "today" is the calendar date in New York (the same zone the
 * prompt's date line uses).
 */
export function nextGivingTuesday(today: Date): Date {
  const forYear = (year: number) => {
    const nov1 = new Date(Date.UTC(year, 10, 1));
    const firstThursday = 1 + ((4 - nov1.getUTCDay() + 7) % 7);
    // Noon UTC so New York formatting lands on the same calendar day.
    return new Date(Date.UTC(year, 10, firstThursday + 21 + 5, 12));
  };
  const [y, m, d] = new Intl.DateTimeFormat("en-CA", {
    timeZone: PROMPT_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .format(today)
    .split("-")
    .map(Number);
  const todayNoon = Date.UTC(y, m - 1, d, 12);
  const thisYear = forYear(y);
  return thisYear.getTime() >= todayNoon ? thisYear : forYear(y + 1);
}
