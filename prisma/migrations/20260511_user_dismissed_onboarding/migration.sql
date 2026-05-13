-- Add User.dismissedOnboarding boolean for the dashboard checklist.
-- Already applied to Neon via `prisma db push`; registered with `migrate resolve`.
ALTER TABLE "User"
  ADD COLUMN "dismissedOnboarding" BOOLEAN NOT NULL DEFAULT false;
