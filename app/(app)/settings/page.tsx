import { C } from "@/lib/design";
import { prisma } from "@/lib/prisma";
import { updatePreferences } from "@/lib/settings/actions";
import { getOrgContext } from "@/lib/with-org";
import {
  InfoCard,
  SectionCard,
  SelectRow,
  SettingsForm,
  TextAreaRow,
  TextRow,
} from "@/components/settings/settings-form";

export const dynamic = "force-dynamic";

const TONE_OPTIONS = [
  { value: "warm", label: "Warm" },
  { value: "formal", label: "Formal" },
  { value: "urgent", label: "Urgent" },
  { value: "grateful", label: "Grateful" },
  { value: "conversational", label: "Conversational" },
];

const TYPE_OPTIONS = [
  { value: "reactivation", label: "Reactivation" },
  { value: "renewal", label: "Renewal" },
  { value: "thank_you", label: "Thank you" },
  { value: "appeal", label: "Appeal" },
  { value: "stewardship", label: "Stewardship" },
];

export default async function PreferencesPage() {
  const { org } = await getOrgContext();
  const settings = await prisma.orgSettings.findUnique({
    where: { orgId: org.id },
  });

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
          Org-wide defaults that pre-fill new uploads and campaigns. Anyone
          on the team can edit these — changes take effect immediately for
          the next upload or draft.
        </p>

        <InfoCard title="Need a specific integration?">
          Integrations and custom sending domains are on the roadmap. Email{" "}
          <a
            href="mailto:support@donorlume.com?subject=CRM%20integration%20request"
            style={{ color: C.amberDark, fontWeight: 700 }}
          >
            support@donorlume.com
          </a>{" "}
          to request a specific connector.
        </InfoCard>

        <SettingsForm
          action={updatePreferences}
          successMessage="Preferences saved."
          submitLabel="Save preferences"
        >
          <SectionCard
            title="Lapsed donor scoring"
            description="How DonorLume decides who counts as 'lapsed' when you upload a CSV."
          >
            <SelectRow
              name="lapsedThresholdMonths"
              label="Default lapsed threshold"
              defaultValue={String(settings?.lapsedThresholdMonths ?? 12)}
              help="A donor with no gift in this many months is flagged as lapsed on upload."
              options={[
                { value: "3", label: "3 months" },
                { value: "6", label: "6 months" },
                { value: "12", label: "12 months (standard)" },
                { value: "18", label: "18 months" },
                { value: "24", label: "24 months" },
                { value: "36", label: "36 months" },
              ]}
            />
          </SectionCard>

          <SectionCard
            title="AI outreach defaults"
            description="Pre-filled on every new campaign. You can still override per-campaign."
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              <SelectRow
                name="defaultTone"
                label="Default tone"
                defaultValue={settings?.defaultTone ?? "warm"}
                options={TONE_OPTIONS}
              />
              <SelectRow
                name="defaultEmailType"
                label="Default email type"
                defaultValue={settings?.defaultEmailType ?? "reactivation"}
                options={TYPE_OPTIONS}
              />
              <TextAreaRow
                name="customInstructions"
                label="Custom instructions"
                rows={3}
                defaultValue={settings?.customInstructions ?? ""}
                placeholder="Optional — appended to every AI outreach prompt. E.g. 'Always mention our matching gift challenge.'"
                help="These instructions ride along on every draft your team generates. Keep them short and concrete."
              />
            </div>
          </SectionCard>

          <SectionCard
            title="Email signature"
            description="Used on the AI's drafts and sent emails. Per-campaign overrides still win."
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              <TextRow
                name="senderName"
                label="Sender name"
                defaultValue={settings?.senderName ?? ""}
                placeholder="Sarah Mitchell"
              />
              <TextRow
                name="senderTitle"
                label="Sender title"
                defaultValue={settings?.senderTitle ?? ""}
                placeholder="Director of Development"
              />
              <TextRow
                name="senderEmail"
                label="Reply-to address"
                type="email"
                defaultValue={settings?.senderEmail ?? ""}
                placeholder="sarah@yournonprofit.org"
                help="Where replies should land. Defaults to the campaign creator's email."
              />
            </div>
          </SectionCard>
        </SettingsForm>
      </div>
    </div>
  );
}
