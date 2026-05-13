import { C } from "@/lib/design";
import { prisma } from "@/lib/prisma";
import {
  changePassword,
  updateNotificationPreferences,
  updateProfile,
} from "@/lib/settings/actions";
import { getOrgContext } from "@/lib/with-org";
import {
  SectionCard,
  SettingsForm,
  TextRow,
  ToggleRow,
} from "@/components/settings/settings-form";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const { user } = await getOrgContext();
  const fresh = await prisma.user.findUnique({
    where: { id: user.id },
    select: {
      name: true,
      email: true,
      passwordHash: true,
      notifyWelcomeEmails: true,
      notifyGettingStartedNudges: true,
      notifyCampaignCompletionAlerts: true,
    },
  });

  const hasPassword = !!fresh?.passwordHash;

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
          Your personal account details and which emails DonorLume sends you.
        </p>

        {/* Identity form — name + email */}
        <SettingsForm
          action={updateProfile}
          successMessage="Profile updated."
          submitLabel="Save profile"
        >
          <SectionCard title="Identity">
            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              <TextRow
                name="name"
                label="Full name"
                required
                defaultValue={fresh?.name ?? ""}
                placeholder="Sarah Mitchell"
                autoComplete="name"
              />
              <TextRow
                name="email"
                label="Email"
                type="email"
                required
                defaultValue={fresh?.email ?? ""}
                placeholder="sarah@yournonprofit.org"
                autoComplete="email"
                help="This is the address you sign in with and where DonorLume sends notifications."
              />
            </div>
          </SectionCard>
        </SettingsForm>

        {/* Password form */}
        {hasPassword ? (
          <SettingsForm
            action={changePassword}
            successMessage="Password updated."
            submitLabel="Update password"
          >
            <SectionCard
              title="Password"
              description="Choose something at least 8 characters long."
            >
              <div
                style={{ display: "flex", flexDirection: "column", gap: 18 }}
              >
                <TextRow
                  name="currentPassword"
                  label="Current password"
                  type="password"
                  required
                  autoComplete="current-password"
                />
                <TextRow
                  name="newPassword"
                  label="New password"
                  type="password"
                  required
                  autoComplete="new-password"
                />
              </div>
            </SectionCard>
          </SettingsForm>
        ) : (
          <SectionCard
            title="Password"
            description="You signed in with Google, so you don't have a DonorLume password yet. To set one, sign out and use the password-reset link on the login page."
          >
            <div
              style={{
                fontSize: 13,
                color: C.textSecondary,
                fontWeight: 500,
              }}
            >
              No password on file.
            </div>
          </SectionCard>
        )}

        {/* Notification preferences */}
        <SettingsForm
          action={updateNotificationPreferences}
          successMessage="Notification preferences saved."
          submitLabel="Save preferences"
        >
          <SectionCard
            title="Notifications"
            description="DonorLume only sends what you ask for. Toggles take effect immediately for the next message in each category."
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <ToggleRow
                name="notifyWelcomeEmails"
                label="Welcome email"
                description="The single email you receive right after signing up."
                defaultChecked={fresh?.notifyWelcomeEmails ?? true}
              />
              <ToggleRow
                name="notifyGettingStartedNudges"
                label="Getting-started nudge"
                description="A one-time reminder 24 hours after signup if you haven't uploaded a donor list."
                defaultChecked={
                  fresh?.notifyGettingStartedNudges ?? true
                }
              />
              <ToggleRow
                name="notifyCampaignCompletionAlerts"
                label="Campaign completion alerts"
                description="A summary email when one of your outreach campaigns finishes sending."
                defaultChecked={
                  fresh?.notifyCampaignCompletionAlerts ?? true
                }
              />
            </div>
          </SectionCard>
        </SettingsForm>
      </div>
    </div>
  );
}
