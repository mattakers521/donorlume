import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { CelebrateView } from "@/components/celebrate/celebrate-view";

export const dynamic = "force-dynamic";

/**
 * Onboarding completion screen. Reached when a user's first-ever email
 * send returns `firstSend: true` from the server — both the in-app
 * AI Outreach Studio (`outreach-client.tsx`) and the server-rendered
 * campaign report (`campaign-draft-table.tsx`) `router.push` here.
 *
 * Lives at the top level (NOT inside `app/(app)/`) so it renders
 * full-screen without the sidebar, topbar, or onboarding progress
 * strip — the celebration is meant to feel like its own moment. The
 * route is still session-gated via `auth.config.ts` (`/celebrate` is
 * in the protected list).
 */
export default async function CelebratePage() {
  // Unauthed users get bounced — middleware would normally handle this
  // but the celebration is itself a milestone screen, so we belt-and-
  // braces it server-side too. (No org check: we don't need org context
  // to render the celebration copy.)
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }
  return <CelebrateView />;
}
