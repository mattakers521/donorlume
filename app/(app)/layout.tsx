import type { ReactNode } from "react";

import { getOnboardingState } from "@/lib/onboarding/state";
import { getOrgContext } from "@/lib/with-org";
import { AppShell } from "@/components/app-shell";

/**
 * Authenticated app shell.
 *
 * Server Component — runs on every request to /(app)/* routes. Resolves
 * the calling user + org via getOrgContext() (redirects to /login if no
 * session, /onboarding if the user has no OrgUser row yet) and computes
 * the onboarding bar state. `getOnboardingState` is memoized via React
 * `cache()` so the dashboard page can reuse the same result without a
 * second DB round trip.
 */
export default async function AppLayout({
  children,
}: {
  children: ReactNode;
}) {
  console.log("[server-trace] (app) LAYOUT entry");
  const { user, org } = await getOrgContext();
  console.log(
    `[server-trace] (app) LAYOUT: getOrgContext OK user=${user.id} org=${org.id}`,
  );
  const onboarding = await getOnboardingState(
    {
      id: org.id,
      name: org.name,
      mission: org.mission,
      signupPath: org.signupPath,
    },
    user.dismissedOnboarding,
  );

  const onboardingBar = onboarding.showProgressBar && onboarding.nextStep
    ? {
        completedCount: onboarding.completedCount,
        total: onboarding.total,
        // 1-based "Step N of 5" — N is the position of the next not-done step.
        nextStepIndex:
          onboarding.steps.findIndex(
            (s) => s.key === onboarding.nextStep!.key,
          ) + 1,
        nextStepTitle: onboarding.nextStep.title,
      }
    : null;

  return (
    <AppShell
      user={{ name: user.name, email: user.email, image: user.image }}
      orgName={org.name}
      onboardingBar={onboardingBar}
    >
      {children}
    </AppShell>
  );
}
