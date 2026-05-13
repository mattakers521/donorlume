-- Applied out-of-band via `prisma db push` because `migrate dev` requires
-- TTY for the trackingId unique-constraint warning (benign — new column
-- defaults NULL; Postgres unique constraints permit duplicate NULLs).
--
-- This file exists so `prisma migrate deploy` reproduces the same state
-- on a fresh database. Mark applied with:
--   npx prisma migrate resolve --applied 20260511_email_tracking

-- OutreachCampaign — aggregate counters bumped by tracking + webhook events.
ALTER TABLE "OutreachCampaign" ADD COLUMN     "deliveredCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "OutreachCampaign" ADD COLUMN     "openedCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "OutreachCampaign" ADD COLUMN     "clickedCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "OutreachCampaign" ADD COLUMN     "repliedCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "OutreachCampaign" ADD COLUMN     "bouncedCount" INTEGER NOT NULL DEFAULT 0;

-- OutreachDraft — send lifecycle + tracking.
ALTER TABLE "OutreachDraft" ADD COLUMN     "messageId" TEXT;
ALTER TABLE "OutreachDraft" ADD COLUMN     "deliveredAt" TIMESTAMP(3);
ALTER TABLE "OutreachDraft" ADD COLUMN     "openCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "OutreachDraft" ADD COLUMN     "clickedAt" TIMESTAMP(3);
ALTER TABLE "OutreachDraft" ADD COLUMN     "clickCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "OutreachDraft" ADD COLUMN     "bouncedAt" TIMESTAMP(3);
ALTER TABLE "OutreachDraft" ADD COLUMN     "bounceReason" TEXT;
ALTER TABLE "OutreachDraft" ADD COLUMN     "unsubscribedAt" TIMESTAMP(3);
ALTER TABLE "OutreachDraft" ADD COLUMN     "trackingId" TEXT;

CREATE UNIQUE INDEX "OutreachDraft_trackingId_key" ON "OutreachDraft"("trackingId");
CREATE INDEX "OutreachDraft_messageId_idx" ON "OutreachDraft"("messageId");

-- EmailClick — one row per click of a tracked link in a sent email.
CREATE TABLE "EmailClick" (
    "id" TEXT NOT NULL,
    "draftId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "clickedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userAgent" TEXT,

    CONSTRAINT "EmailClick_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "EmailClick_draftId_idx" ON "EmailClick"("draftId");
ALTER TABLE "EmailClick" ADD CONSTRAINT "EmailClick_draftId_fkey" FOREIGN KEY ("draftId") REFERENCES "OutreachDraft"("id") ON DELETE CASCADE ON UPDATE CASCADE;
