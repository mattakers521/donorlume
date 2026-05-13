-- CreateEnum
CREATE TYPE "CohortFamily" AS ENUM ('GIVING_BEHAVIOR', 'ENGAGEMENT', 'ENTITY_TYPE', 'TRAJECTORY', 'CUSTOM');

-- CreateEnum
CREATE TYPE "CohortType" AS ENUM ('SYSTEM', 'CUSTOM');

-- CreateTable
CREATE TABLE "CohortDefinition" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "family" "CohortFamily" NOT NULL,
    "type" "CohortType" NOT NULL,
    "description" TEXT,
    "rule" JSONB,
    "sourceColumn" TEXT,
    "sourceValue" TEXT,
    "color" TEXT,
    "icon" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CohortDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DonorCohort" (
    "id" TEXT NOT NULL,
    "donorId" TEXT NOT NULL,
    "cohortDefinitionId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assignmentType" TEXT NOT NULL DEFAULT 'auto',
    "confidence" DOUBLE PRECISION,

    CONSTRAINT "DonorCohort_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CohortDefinition_orgId_family_idx" ON "CohortDefinition"("orgId", "family");

-- CreateIndex
CREATE UNIQUE INDEX "CohortDefinition_orgId_slug_key" ON "CohortDefinition"("orgId", "slug");

-- CreateIndex
CREATE INDEX "DonorCohort_cohortDefinitionId_idx" ON "DonorCohort"("cohortDefinitionId");

-- CreateIndex
CREATE INDEX "DonorCohort_donorId_idx" ON "DonorCohort"("donorId");

-- CreateIndex
CREATE UNIQUE INDEX "DonorCohort_donorId_cohortDefinitionId_key" ON "DonorCohort"("donorId", "cohortDefinitionId");

-- AddForeignKey
ALTER TABLE "CohortDefinition" ADD CONSTRAINT "CohortDefinition_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DonorCohort" ADD CONSTRAINT "DonorCohort_donorId_fkey" FOREIGN KEY ("donorId") REFERENCES "Donor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DonorCohort" ADD CONSTRAINT "DonorCohort_cohortDefinitionId_fkey" FOREIGN KEY ("cohortDefinitionId") REFERENCES "CohortDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;
