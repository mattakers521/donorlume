-- Password reset flow. resetToken stored directly (no hashing) — the
-- token is 32 bytes of crypto-random hex which is effectively
-- unguessable, and the value rotates every time /forgot-password is
-- hit. Unique index supports the single-row lookup at reset time.

ALTER TABLE "User" ADD COLUMN "resetToken"          TEXT;
ALTER TABLE "User" ADD COLUMN "resetTokenExpiresAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "User_resetToken_key" ON "User"("resetToken");
