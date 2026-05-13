-- Account management — Organization profile fields, User notification
-- preferences, and the Invitation table for team invites. Already
-- applied to Neon via `prisma db push`; registered with `migrate resolve`.

ALTER TABLE "Organization"
  ADD COLUMN "causeArea" TEXT,
  ADD COLUMN "address"   TEXT;

ALTER TABLE "User"
  ADD COLUMN "notifyWelcomeEmails"            BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "notifyGettingStartedNudges"     BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "notifyCampaignCompletionAlerts" BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE "Invitation" (
  "id"          TEXT NOT NULL,
  "orgId"       TEXT NOT NULL,
  "email"       TEXT NOT NULL,
  "role"        "Role" NOT NULL DEFAULT 'MEMBER',
  "token"       TEXT NOT NULL,
  "invitedById" TEXT NOT NULL,
  "expiresAt"   TIMESTAMP(3) NOT NULL,
  "acceptedAt"  TIMESTAMP(3),
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Invitation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Invitation_token_key" ON "Invitation"("token");
CREATE UNIQUE INDEX "Invitation_orgId_email_key" ON "Invitation"("orgId", "email");

ALTER TABLE "Invitation"
  ADD CONSTRAINT "Invitation_orgId_fkey"
    FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE;
ALTER TABLE "Invitation"
  ADD CONSTRAINT "Invitation_invitedById_fkey"
    FOREIGN KEY ("invitedById") REFERENCES "User"("id") ON DELETE CASCADE;
