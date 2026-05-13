import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { OnboardingForm } from "@/app/(auth)/onboarding/onboarding-form";

export const dynamic = "force-dynamic";

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ path?: string }>;
}) {
  // Three states this page handles:
  //   1. anonymous user → /login (middleware should already gate this, but
  //      we double-check server-side)
  //   2. authed user WITH an org → /dashboard (they don't need onboarding)
  //   3. authed user WITHOUT an org → render the form
  console.log("[server-trace] /onboarding page entry");
  const session = await auth();
  if (!session?.user?.id) {
    console.warn("[server-trace] /onboarding: no session → /login");
    redirect("/login?callbackUrl=/onboarding");
  }

  const orgUser = await prisma.orgUser.findFirst({
    where: { userId: session.user.id },
    select: { orgId: true },
  });
  if (orgUser) {
    console.warn(
      `[server-trace] /onboarding: session userId=${session.user.id} HAS orgUser orgId=${orgUser.orgId} → redirect(/dashboard) ← CHAIN TRAP`,
    );
    redirect("/dashboard");
  }
  console.log(
    `[server-trace] /onboarding: session userId=${session.user.id} has NO orgUser → render form`,
  );

  // ?path=event|donors carried from the landing → /signup → Google OAuth
  // round-trip so we can stamp it on the org at create time.
  const { path } = await searchParams;
  const signupPath: "event" | "donors" | null =
    path === "event" || path === "donors" ? path : null;

  return (
    <OnboardingForm
      defaultSenderName={session.user.name ?? ""}
      userEmail={session.user.email ?? ""}
      signupPath={signupPath}
    />
  );
}
