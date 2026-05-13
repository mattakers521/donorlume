-- Records the timestamp at which a user accepted DonorLume's Terms of
-- Service + Privacy Policy. New signups (password + Google OAuth) must
-- accept before account creation; pre-existing rows stay NULL.
-- Already applied to Neon via `prisma db push`.
ALTER TABLE "User" ADD COLUMN "termsAcceptedAt" TIMESTAMP(3);
