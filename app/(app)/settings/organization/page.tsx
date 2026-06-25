import { updateOrganization } from "@/lib/settings/actions";
import { C } from "@/lib/design";
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

export const dynamic = "force-dynamic";

export default async function OrganizationPage() {
  const { org } = await getOrgContext();
  const fresh = await prisma.organization.findUnique({
    where: { id: org.id },
    select: {
      name: true,
      mission: true,
      causeArea: true,
      address: true,
      website: true,
      logo: true,
    },
  });

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
          These details feed every AI outreach prompt and the prospect-matching
          signals used in Discover. The more specific you are about your
          mission and cause area, the better your generated emails read.
        </p>

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

        <SettingsForm
          action={updateOrganization}
          successMessage="Organization profile updated."
          submitLabel="Save organization"
        >
          <SectionCard
            title="Identity"
            description="What we show on emails, dashboards, and your campaign reports."
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
                name="causeArea"
                label="Cause area"
                help="A short phrase — used in the AI prompt to anchor tone and audience. Examples: food security, youth education, animal welfare."
                defaultValue={fresh?.causeArea ?? ""}
                placeholder="e.g. food security"
              />
              <TextAreaRow
                name="mission"
                label="Mission"
                help="One or two sentences. This is the most-cited field in your AI outreach — every email opens from this voice."
                rows={4}
                defaultValue={fresh?.mission ?? ""}
                placeholder="We feed families across the Pacific Northwest, one neighborhood pantry at a time."
              />
            </div>
          </SectionCard>

          <SectionCard
            title="Contact details"
            description="Used in email signatures and shown on your campaign reports."
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              <TextRow
                name="website"
                label="Website"
                type="url"
                defaultValue={fresh?.website ?? ""}
                placeholder="https://yournonprofit.org"
              />
              <TextAreaRow
                name="address"
                label="Mailing address"
                help="Appears in the footer of outreach emails. CAN-SPAM-friendly."
                rows={3}
                defaultValue={fresh?.address ?? ""}
                placeholder={"123 Main Street\nPortland, OR 97201"}
              />
              <TextRow
                name="logo"
                label="Logo URL"
                help="Paste a hosted PNG or SVG URL."
                type="url"
                defaultValue={fresh?.logo ?? ""}
                placeholder="https://yournonprofit.org/logo.png"
              />
            </div>
          </SectionCard>
        </SettingsForm>
      </div>
    </div>
  );
}
