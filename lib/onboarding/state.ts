import "server-only";

import { cache } from "react";

import { prisma } from "@/lib/prisma";

export type OnboardingStepKey =
  | "profile"
  | "prospects"
  | "donors"
  | "outreach"
  | "send";

export type OnboardingStep = {
  key: OnboardingStepKey;
  title: string;
  body: string;
  cta: string;
  href: string;
  /** Friendly past-tense phrase used by step-complete toasts. */
  completedToast: string;
  done: boolean;
  /**
   * Optional steps render an "Optional" badge in the checklist and
   * don't block the overall "all required complete" computation. The
   * user can still tick them off — they just aren't blockers for
   * progress-bar dismissal or the next-step ordering.
   */
  optional?: boolean;
};

export type OnboardingState = {
  steps: OnboardingStep[];
  /**
   * Subset of `steps` filtered to what should actually render in the
   * dashboard checklist right now. Step 5 ("send") is hidden until
   * step 4 ("outreach") is done — sending a draft requires a campaign
   * to exist, so showing both at once is misleading.
   */
  visibleSteps: OnboardingStep[];
  completedCount: number;
  total: number;
  /** Visibility rule for the dashboard checklist card. */
  showChecklist: boolean;
  /** Visibility rule for the persistent top progress bar. */
  showProgressBar: boolean;
  /** First not-yet-done step — drives the progress bar copy. */
  nextStep: OnboardingStep | null;
  dismissed: boolean;
};

type OrgForOnboarding = {
  id: string;
  name: string;
  mission: string | null;
  /** "event" | "donors" | null — from the landing "Choose Your Path" cards. */
  signupPath: string | null;
};

/**
 * Resolves the org's current onboarding progress. Wrapped in React's
 * `cache()` so the layout AND the dashboard page within a single render
 * pass share one DB round trip — without this, every page load would
 * pay for the queries twice (once for the layout's progress bar, once
 * for the dashboard checklist).
 */
export const getOnboardingState = cache(
  async (
    org: OrgForOnboarding,
    userDismissed: boolean,
  ): Promise<OnboardingState> => {
    const [
      donorListCount,
      prospectCount,
      campaignCount,
      sentDraftCount,
      latestCampaign,
    ] = await Promise.all([
      prisma.donorList.count({ where: { orgId: org.id } }),
      prisma.prospect.count({ where: { orgId: org.id } }),
      prisma.outreachCampaign.count({ where: { orgId: org.id } }),
      prisma.outreachDraft.count({
        where: {
          campaign: { orgId: org.id },
          messageId: { not: null },
        },
      }),
      // Latest campaign — drives the step 5 CTA so the user lands
      // directly on the report page where the per-draft Send button
      // is visible, instead of the campaign-list page.
      prisma.outreachCampaign.findFirst({
        where: { orgId: org.id },
        orderBy: { createdAt: "desc" },
        select: { id: true },
      }),
    ]);

    const profileDone =
      !!org.name?.trim() && !!org.mission?.trim();
    const outreachDone = campaignCount > 0;
    const sendHref = latestCampaign
      ? `/outreach/campaigns/${latestCampaign.id}?onboarding=1`
      : "/outreach";

    // Order: profile → donors → outreach → prospects (optional) → send.
    // Funder discovery moved out of the critical path because most new
    // orgs activate via their existing donor list, not 990 prospecting;
    // marking it optional keeps it on the checklist without blocking
    // the progress bar from clearing.
    const steps: OnboardingStep[] = [
      {
        key: "profile",
        title: "Complete your org profile",
        body: "Add your mission and sender details — so every AI-written email sounds like it came from you, not a template.",
        cta: "Edit profile",
        href: "/settings",
        completedToast: "You've filled out your org profile.",
        done: profileDone,
      },
      // Donors-step copy varies on Organization.signupPath. Event-path
      // users see language that names the platforms they actually use;
      // donor-path users (the default) see CRM-export language.
      org.signupPath === "event"
        ? {
            key: "donors" as const,
            title: "Upload your event attendee data",
            body: "Export from OneCause, GiveButter, BetterUnite, Givesmart, or Greater Giving — so we can score every attendee for follow-up potential and surface the warmest people to call this week.",
            cta: "Upload event data",
            href: "/lapsed",
            completedToast: "You've uploaded your first event list.",
            done: donorListCount > 0,
          }
        : {
            key: "donors" as const,
            title: "Upload your donor list",
            body: "Export a CSV from your CRM — so we can identify your best reactivation opportunities and rank them 0–100 by recency, frequency, monetary, and tenure.",
            cta: "Upload donors",
            href: "/lapsed",
            completedToast: "You've uploaded your first donor list.",
            done: donorListCount > 0,
          },
      {
        key: "outreach",
        title: "Generate your first outreach",
        body: "Pick a segment and let Claude draft the emails — so you can send personalized outreach in minutes instead of writing each one by hand.",
        cta: "Start a campaign",
        href: "/outreach/new?onboarding=1",
        completedToast: "You've created your first outreach campaign.",
        done: outreachDone,
      },
      {
        key: "prospects",
        title: "Find your first funder",
        body: "Search public 990 filings — so you can build a pipeline of foundations that already fund work like yours.",
        cta: "Open Find Funders",
        href: "/discover",
        completedToast: "You've saved your first funder.",
        done: prospectCount > 0,
        optional: true,
      },
      {
        key: "send",
        title: "Send your first email",
        body: "Hit send on a draft from your campaign report — so DonorLume can start tracking opens, clicks, and replies and show you what's landing.",
        cta: "Send a draft",
        href: sendHref,
        completedToast: "You've sent your first email through DonorLume.",
        done: sentDraftCount > 0,
      },
    ];

    const completedCount = steps.filter((s) => s.done).length;
    const total = steps.length;
    const requiredSteps = steps.filter((s) => !s.optional);
    const requiredDoneCount = requiredSteps.filter((s) => s.done).length;
    const allComplete = requiredDoneCount >= requiredSteps.length;
    // Prefer the first required not-done step for the progress bar's
    // "Next: …" line so the user is always guided toward a blocker
    // rather than to an optional task. Fall back to the first optional
    // not-done step (so we still surface it if every required one is
    // complete), then to null when truly nothing is left.
    const nextStep =
      requiredSteps.find((s) => !s.done) ??
      steps.find((s) => s.optional && !s.done) ??
      null;
    // Hide the "send" step from the visible list until "outreach" is
    // done. Sending a draft requires a campaign to exist, so showing
    // both simultaneously is misleading; we re-introduce send the
    // moment the user wraps outreach (toast + router.refresh re-renders
    // the dashboard immediately).
    const visibleSteps = outreachDone
      ? steps
      : steps.filter((s) => s.key !== "send");

    return {
      steps,
      visibleSteps,
      completedCount,
      total,
      // Dashboard checklist card: stays visible until ALL steps are
      // done or the user explicitly dismisses. Previously this hid at
      // 3-of-5 (the rationale was "they've got the hang of it"), but
      // losing the guide mid-onboarding leaves the user without a
      // pointer to step 4 (generate outreach) and step 5 (send) — the
      // two highest-value milestones. Now the card sticks around for
      // the whole run.
      showChecklist: !userDismissed && completedCount < total,
      // Persistent progress bar: shows until ALL steps done or dismissed.
      showProgressBar: !userDismissed && !allComplete,
      nextStep,
      dismissed: userDismissed,
    };
  },
);
