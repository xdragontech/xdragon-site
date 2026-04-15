-- Mirror command migration history for shared database state.

ALTER TYPE "SchedulePublicFeedSource"
ADD VALUE IF NOT EXISTS 'PARTNER_PROFILES';

CREATE TABLE "SchedulePublicFeedParticipant" (
    "id" TEXT NOT NULL,
    "schedulePublicFeedId" TEXT NOT NULL,
    "participantPartnerProfileId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SchedulePublicFeedParticipant_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SchedulePublicFeedParticipant_schedulePublicFeedId_participantPa_key"
ON "SchedulePublicFeedParticipant"("schedulePublicFeedId", "participantPartnerProfileId");

CREATE INDEX "SchedulePublicFeedParticipant_schedulePublicFeedId_idx"
ON "SchedulePublicFeedParticipant"("schedulePublicFeedId");

CREATE INDEX "SchedulePublicFeedParticipant_participantPartnerProfileId_idx"
ON "SchedulePublicFeedParticipant"("participantPartnerProfileId");

ALTER TABLE "SchedulePublicFeedParticipant"
ADD CONSTRAINT "SchedulePublicFeedParticipant_schedulePublicFeedId_fkey"
FOREIGN KEY ("schedulePublicFeedId") REFERENCES "SchedulePublicFeed"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SchedulePublicFeedParticipant"
ADD CONSTRAINT "SchedulePublicFeedParticipant_participantPartnerProfileId_fkey"
FOREIGN KEY ("participantPartnerProfileId") REFERENCES "ParticipantPartnerProfile"("partnerProfileId")
ON DELETE CASCADE ON UPDATE CASCADE;
