-- Track who uploaded each DonorList. Nullable so pre-existing rows
-- backfill as NULL (we have no provenance for them) and so a user
-- delete uses ON DELETE SET NULL — we keep the org's historical
-- upload records even when an uploader leaves.

ALTER TABLE "DonorList" ADD COLUMN "uploadedByUserId" TEXT;

ALTER TABLE "DonorList"
  ADD CONSTRAINT "DonorList_uploadedByUserId_fkey"
  FOREIGN KEY ("uploadedByUserId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "DonorList_uploadedByUserId_idx"
  ON "DonorList"("uploadedByUserId");
