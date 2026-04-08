CREATE TYPE "PartnerApplicationNoteVisibility" AS ENUM ('INTERNAL', 'EXTERNAL');

ALTER TABLE "ParticipantPartnerProfile"
ADD COLUMN "entertainmentActType" TEXT,
ADD COLUMN "entertainmentGenres" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

ALTER TABLE "PartnerApplication"
ADD COLUMN "applicationVersion" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN "applicationPayload" JSONB;

CREATE TABLE "PartnerApplicationNote" (
    "id" TEXT NOT NULL,
    "partnerApplicationId" TEXT NOT NULL,
    "authorBackofficeUserId" TEXT,
    "authorPartnerUserId" TEXT,
    "visibility" "PartnerApplicationNoteVisibility" NOT NULL,
    "body" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PartnerApplicationNote_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PartnerApplicationNote_partnerApplicationId_idx" ON "PartnerApplicationNote"("partnerApplicationId");
CREATE INDEX "PartnerApplicationNote_authorBackofficeUserId_idx" ON "PartnerApplicationNote"("authorBackofficeUserId");
CREATE INDEX "PartnerApplicationNote_authorPartnerUserId_idx" ON "PartnerApplicationNote"("authorPartnerUserId");
CREATE INDEX "PartnerApplicationNote_visibility_idx" ON "PartnerApplicationNote"("visibility");
CREATE INDEX "PartnerApplicationNote_createdAt_idx" ON "PartnerApplicationNote"("createdAt");

ALTER TABLE "PartnerApplicationNote"
ADD CONSTRAINT "PartnerApplicationNote_partnerApplicationId_fkey"
FOREIGN KEY ("partnerApplicationId") REFERENCES "PartnerApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PartnerApplicationNote"
ADD CONSTRAINT "PartnerApplicationNote_authorBackofficeUserId_fkey"
FOREIGN KEY ("authorBackofficeUserId") REFERENCES "BackofficeUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PartnerApplicationNote"
ADD CONSTRAINT "PartnerApplicationNote_authorPartnerUserId_fkey"
FOREIGN KEY ("authorPartnerUserId") REFERENCES "PartnerUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
