-- Phase 1 · Feature 1 — Organization Profile ("Your Why").
-- Additive only: every new column is nullable or has a default, so the
-- currently-deployed code keeps working against this schema.
ALTER TABLE "Organization" ADD COLUMN "communityServed" TEXT;
ALTER TABLE "Organization" ADD COLUMN "focusAreas" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "Organization" ADD COLUMN "donationPageUrl" TEXT;

-- Carry the legacy single cause area into the new tag list so existing
-- orgs don't lose what they already entered. causeArea itself is left
-- in place (no destructive change); the app stops writing it.
UPDATE "Organization"
SET "focusAreas" = ARRAY[btrim("causeArea")]
WHERE "causeArea" IS NOT NULL AND btrim("causeArea") <> '';
