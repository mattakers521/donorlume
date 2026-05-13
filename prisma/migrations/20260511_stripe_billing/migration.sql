-- Stripe billing — replays cleanly on a fresh DB.
-- Already applied to Neon via `prisma db push` + a manual UPDATE backfill
-- for the FREE → STARTER pre-step; registered with `migrate resolve`.

-- 1. Backfill existing FREE rows to STARTER so the enum swap doesn't blow up.
UPDATE "Organization" SET plan = 'STARTER' WHERE plan = 'FREE';

-- 2. Rotate the Plan enum: drop FREE, add SCALE.
ALTER TYPE "Plan" RENAME TO "Plan_old";
CREATE TYPE "Plan" AS ENUM ('STARTER', 'GROWTH', 'SCALE', 'ENTERPRISE');
ALTER TABLE "Organization"
  ALTER COLUMN plan DROP DEFAULT,
  ALTER COLUMN plan TYPE "Plan" USING plan::text::"Plan",
  ALTER COLUMN plan SET DEFAULT 'STARTER';
DROP TYPE "Plan_old";

-- 3. Drop the old stripeId column and add the full billing column set.
ALTER TABLE "Organization" DROP COLUMN IF EXISTS "stripeId";
ALTER TABLE "Organization"
  ADD COLUMN "stripeCustomerId"     TEXT,
  ADD COLUMN "stripeSubscriptionId" TEXT,
  ADD COLUMN "stripePriceId"        TEXT,
  ADD COLUMN "stripeStatus"         TEXT,
  ADD COLUMN "currentPeriodEnd"     TIMESTAMP(3),
  ADD COLUMN "cancelAtPeriodEnd"    BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "trialEndsAt"          TIMESTAMP(3);

CREATE UNIQUE INDEX "Organization_stripeCustomerId_key"
  ON "Organization"("stripeCustomerId");
CREATE UNIQUE INDEX "Organization_stripeSubscriptionId_key"
  ON "Organization"("stripeSubscriptionId");
