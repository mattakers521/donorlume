-- Applied out-of-band via `prisma db push` (no destructive changes).
-- All four columns are nullable DateTimes; existing rows backfill NULL.

ALTER TABLE "User" ADD COLUMN     "lastActiveAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN     "inactiveSlackedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN     "welcomeSentAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN     "gettingStartedNudgeSentAt" TIMESTAMP(3);
