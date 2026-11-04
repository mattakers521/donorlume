import { updateOrganization } from "@/lib/settings/actions";
import { C } from "@/lib/design";
import { isProfileGrounded, profileStrength } from "@/lib/org-profile";
import { getFromEmail, isTestSendingDomain } from "@/lib/email/resend";
import { prisma } from "@/lib/prisma";
import { getOrgContext } from "@/lib/with-org";
import {
  InfoCard,
  SectionCard,
  SettingsForm,
  TextAreaRow,
  TextRow,
} from "@/components/settings/settings-form";
import { FocusAreasInput } from "@/components/settings/focus-areas-input";
import { ProfileStrengthCard } from "@/components/settings/profile-strength";

export const dynamic = "force-dynamic";

export default async function OrganizationPage() {
  const { org } = await getOrgContext();
  const fresh = await prisma.organization.findUnique({
    where: { id: org.id },
    select: {
      name: true,
      mission: true,
      communityServed: true,
      focusAreas: true,
      address: true,
      website: true,
      donationPageUrl: true,
      logo: true,
    },
  });
  const profile = {
    mission: fresh?.mission ?? null,
    communityServed: fresh?.communityServed ?? null,
    focusAreas: fresh?.focusAreas ?? [],
    website: fresh?.website ?? null,
    donationPageUrl: fresh?.donationPageUrl ?? null,
    logo: fresh?.logo ?? null,
  };
  const strength = profileStrength(profile);
  const grounded = isProfileGrounded(profile);

  // Sender preflight — surfaces whether outreach can actually leave
  // the building, and warns when EMAIL_FROM is still pointing at
  // Resend's test domain (matches the 412 guard in the send route).
  const fromAddress = getFromEmail();
  const senderIsTestDomain = isTestSendingDomain();

  return (
    <div style={{ padding: "8px clamp(0px, 2vw, 8px)" }}>
      <div style={{ maxWidth: 720 }}>
        <p
          style={{
            margin: "0 0 24px",
            fontSize: 14,
            color: C.textBody,
            fontWeight: 500,
            lineHeight: 1.6,
          }}
        >
          Your organization profile is the foundation for every AI feature in
          DonorLume. The more specific you are about your mission, community,
          and focus areas, the more each draft sounds like you.
        </p>

        <ProfileStrengthCard strength={strength} grounded={grounded} />

        <SettingsForm
          action={updateOrganization}
          successMessage="Organization profile saved."
          submitLabel="Save profile"
        >
          <SectionCard
            title="Your why"
            description="The heart of your profile. Every AI-written email, campaign, and card in DonorLume starts from these three answers."
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              <TextAreaRow
                name="mission"
                label="Mission"
                help="Two to four sentences on why your organization exists — in your own voice. This is the most-cited field in every AI draft."
                rows={4}
                defaultValue={fresh?.mission ?? ""}
                placeholder="We make sure no veteran in Central Indiana comes home to an empty table. Our volunteers deliver groceries, rides, and a friendly face to the families who served."
              />
              <TextRow
                name="communityServed"
                label="Community served"
                help="Who and where, in a short phrase. The AI uses this to make every email feel local."
                defaultValue={fresh?.communityServed ?? ""}
                placeholder="Indianapolis, IN — veterans and their families"
              />
              <FocusAreasInput
                name="focusAreas"
                label="Focus areas"
                help="Type a focus area and press Enter. Up to 8 — e.g. Veterans, Food security, Mental health."
                defaultValue={fresh?.focusAreas ?? []}
                placeholder="e.g. Veterans"
              />
            </div>
          </SectionCard>

          <SectionCard
            title="Identity"
            description="How your organization appears on emails and reports."
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              <TextRow
                name="name"
                label="Organization name"
                required
                defaultValue={fresh?.name ?? ""}
                placeholder="Hope Foundation"
              />
              <TextRow
                name="logo"
                label="Logo URL"
                help="Optional. Paste a link to a hosted PNG or SVG of your logo."
                inputMode="url"
                defaultValue={fresh?.logo ?? ""}
                placeholder="https://yournonprofit.org/logo.png"
              />
            </div>
          </SectionCard>

          <SectionCard
            title="Links & contact"
            description="Where supporters can learn more and give. DonorLume never processes donations — we send people to your existing giving page."
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              <TextRow
                name="website"
                label="Website"
                inputMode="url"
                defaultValue={fresh?.website ?? ""}
                placeholder="yournonprofit.org"
              />
              <TextRow
                name="donationPageUrl"
                label="Donation page"
                help="The page where people already give to you today (Givebutter, Bloomerang, PayPal, your own site…)."
                inputMode="url"
                defaultValue={fresh?.donationPageUrl ?? ""}
                placeholder="yournonprofit.org/give"
              />
              <TextAreaRow
                name="address"
                label="Mailing address"
                help="Appears in the footer of outreach emails. CAN-SPAM-friendly."
                rows={3}
                defaultValue={fresh?.address ?? ""}
                placeholder={"123 Main Street\nPortland, OR 97201"}
              />
            </div>
          </SectionCard>
        </SettingsForm>

        <div style={{ height: 12 }} />

        <SectionCard
          title="Sender"
          description="The address every outreach email goes out from. Recipients see this in their inbox and use it to reply."
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 14,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "14px 16px",
                borderRadius: 12,
                backgroundColor: senderIsTestDomain
                  ? C.orangeLight
                  : C.amberLight,
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 800,
                    letterSpacing: 1.2,
                    textTransform: "uppercase",
                    color: senderIsTestDomain ? C.orange : C.amberDark,
                    marginBottom: 4,
                  }}
                >
                  {senderIsTestDomain
                    ? "Sending not yet configured"
                    : "Sending from"}
                </div>
                <div
                  style={{
                    fontSize: 15,
                    fontWeight: 700,
                    color: C.text,
                    wordBreak: "break-all",
                  }}
                >
                  {fromAddress ?? "EMAIL_FROM is not set."}
                </div>
                {senderIsTestDomain && (
                  <p
                    style={{
                      margin: "8px 0 0",
                      fontSize: 13,
                      color: C.textBody,
                      fontWeight: 500,
                      lineHeight: 1.55,
                    }}
                  >
                    This is Resend&rsquo;s test domain — it only delivers
                    to the Resend account owner&rsquo;s inbox, not to your
                    donors. Send buttons in /outreach are blocked until a
                    real sending domain is configured. Email{" "}
                    <a
                      href="mailto:support@donorlume.com?subject=Sending%20domain%20setup"
                      style={{ color: C.amberDark, fontWeight: 700 }}
                    >
                      support@donorlume.com
                    </a>{" "}
                    to get set up.
                  </p>
                )}
              </div>
            </div>
            <p
              style={{
                margin: 0,
                fontSize: 13,
                color: C.textSecondary,
                lineHeight: 1.55,
                fontWeight: 500,
              }}
            >
              <strong style={{ color: C.text }}>
                Custom sending domains — coming soon.
              </strong>{" "}
              Per-org From addresses (you@yournonprofit.org) are on the
              roadmap. For now every workspace shares the DonorLume
              sender above. To prioritize your domain, email{" "}
              <a
                href="mailto:support@donorlume.com?subject=Custom%20sending%20domain"
                style={{ color: C.amberDark, fontWeight: 700 }}
              >
                support@donorlume.com
              </a>
              .
            </p>
          </div>
        </SectionCard>

        <InfoCard title="Need a specific integration?">
          Integrations and CRM connectors are on the roadmap. Email{" "}
          <a
            href="mailto:support@donorlume.com?subject=CRM%20integration%20request"
            style={{ color: C.amberDark, fontWeight: 700 }}
          >
            support@donorlume.com
          </a>{" "}
          to request a specific connector.
        </InfoCard>

      </div>
    </div>
  );
}
