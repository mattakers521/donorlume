import { AssistantsClient } from "@/components/assistants/assistants-client";
import { trialAiUsage } from "@/lib/billing/ai-usage";
import { canEditOrgProfile, missingGroundingFields } from "@/lib/org-profile";
import { prisma } from "@/lib/prisma";
import { getOrgContext } from "@/lib/with-org";

export const dynamic = "force-dynamic";

export default async function AssistantsPage() {
  const { org, orgRole } = await getOrgContext();

  const [profile, trialUsed] = await Promise.all([
    prisma.organization.findUniqueOrThrow({
      where: { id: org.id },
      select: {
        mission: true,
        communityServed: true,
        focusAreas: true,
        website: true,
        donationPageUrl: true,
        logo: true,
      },
    }),
    trialAiUsage(org),
  ]);

  return (
    <AssistantsClient
      missingProfileFields={missingGroundingFields(profile).map((f) => f.label)}
      canEditProfile={canEditOrgProfile(orgRole)}
      initialTrialUsed={trialUsed}
    />
  );
}
