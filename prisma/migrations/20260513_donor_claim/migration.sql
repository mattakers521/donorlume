-- Donor claiming. A team member "claims" a donor to signal they're
-- personally cultivating that relationship; other team members should
-- avoid sending conflicting outreach. SetNull on user delete preserves
-- the donor row but drops the (now-orphaned) claim.

ALTER TABLE "Donor" ADD COLUMN "claimedById" TEXT;
ALTER TABLE "Donor" ADD COLUMN "claimedAt"   TIMESTAMP(3);

ALTER TABLE "Donor"
  ADD CONSTRAINT "Donor_claimedById_fkey"
  FOREIGN KEY ("claimedById") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Donor_claimedById_idx" ON "Donor"("claimedById");
