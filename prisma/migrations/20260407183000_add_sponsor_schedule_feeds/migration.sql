CREATE TYPE "SchedulePublicFeedSource" AS ENUM ('ASSIGNMENTS', 'SPONSORS');

ALTER TABLE "SchedulePublicFeed"
ADD COLUMN "source" "SchedulePublicFeedSource" NOT NULL DEFAULT 'ASSIGNMENTS',
ADD COLUMN "includeProfileImages" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "onlyProfileImages" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "SchedulePublicFeed"
ALTER COLUMN "participantType" DROP NOT NULL;

CREATE TABLE "SchedulePublicFeedSponsor" (
    "id" TEXT NOT NULL,
    "schedulePublicFeedId" TEXT NOT NULL,
    "sponsorPartnerProfileId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SchedulePublicFeedSponsor_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SchedulePublicFeed_source_idx" ON "SchedulePublicFeed"("source");
CREATE INDEX "SchedulePublicFeedSponsor_schedulePublicFeedId_idx" ON "SchedulePublicFeedSponsor"("schedulePublicFeedId");
CREATE INDEX "SchedulePublicFeedSponsor_sponsorPartnerProfileId_idx" ON "SchedulePublicFeedSponsor"("sponsorPartnerProfileId");
CREATE UNIQUE INDEX "SchedulePublicFeedSponsor_schedulePublicFeedId_sponsorPartnerProfileId_key"
ON "SchedulePublicFeedSponsor"("schedulePublicFeedId", "sponsorPartnerProfileId");

ALTER TABLE "SchedulePublicFeedSponsor"
ADD CONSTRAINT "SchedulePublicFeedSponsor_schedulePublicFeedId_fkey"
FOREIGN KEY ("schedulePublicFeedId") REFERENCES "SchedulePublicFeed"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SchedulePublicFeedSponsor"
ADD CONSTRAINT "SchedulePublicFeedSponsor_sponsorPartnerProfileId_fkey"
FOREIGN KEY ("sponsorPartnerProfileId") REFERENCES "SponsorPartnerProfile"("partnerProfileId") ON DELETE CASCADE ON UPDATE CASCADE;
