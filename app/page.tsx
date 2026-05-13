import { auth } from "@/auth";
import { LandingAbout } from "@/components/landing/about";
import { LandingCohorts } from "@/components/landing/cohorts";
import { LandingContact } from "@/components/landing/contact";
import { LandingFaq } from "@/components/landing/faq";
import { LandingFeatures } from "@/components/landing/features";
import { LandingFooter } from "@/components/landing/footer";
import { LandingHeader } from "@/components/landing/header";
import { LandingHero } from "@/components/landing/hero";
import { LandingChoosePath } from "@/components/landing/choose-path";
import { LandingModules } from "@/components/landing/modules";
import { LandingPricing } from "@/components/landing/pricing";
import { LandingProblem } from "@/components/landing/problem";
import { LandingTwoPaths } from "@/components/landing/two-paths";

export const dynamic = "force-dynamic";

export default async function LandingPage() {
  // Server-side session check so the header can swap "Sign In / Get Started"
  // for "Open App →" when the visitor already has a session. We deliberately
  // do NOT auto-redirect signed-in users — they can still browse the
  // marketing page, then click into the app.
  const session = await auth();
  const isAuthed = !!session?.user?.id;

  return (
    <>
      <LandingHeader isAuthed={isAuthed} />
      <main>
        <LandingHero />
        <LandingProblem />
        <LandingChoosePath />
        <LandingModules />
        <LandingCohorts />
        <LandingFeatures />
        <LandingTwoPaths />
        <LandingPricing />
        <LandingFaq />
        <LandingAbout />
        <LandingContact />
      </main>
      <LandingFooter />
    </>
  );
}
