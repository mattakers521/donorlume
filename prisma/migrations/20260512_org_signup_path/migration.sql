-- Captures which landing-page "Choose Your Path" card the user clicked
-- through. Drives onboarding-checklist copy for step 2 (event-platform
-- exports vs CRM exports). Already applied to Neon via `prisma db push`.
ALTER TABLE "Organization" ADD COLUMN "signupPath" TEXT;
