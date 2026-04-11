-- CreateEnum
CREATE TYPE "BrandNotificationDeliveryChannel" AS ENUM ('EMAIL');

-- CreateEnum
CREATE TYPE "BrandNotificationDeliveryStatus" AS ENUM ('CLAIMED', 'SENT', 'FAILED');

-- CreateEnum
CREATE TYPE "BrandNotificationReminderRunStatus" AS ENUM ('STARTED', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "BrandNotificationReminderPolicy" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "noticeType" "BrandNotificationNoticeType" NOT NULL,
    "timezone" TEXT NOT NULL,
    "sendHourLocal" INTEGER NOT NULL DEFAULT 9,
    "sendMinuteLocal" INTEGER NOT NULL DEFAULT 0,
    "settings" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BrandNotificationReminderPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrandNotificationDelivery" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "noticeType" "BrandNotificationNoticeType" NOT NULL,
    "channel" "BrandNotificationDeliveryChannel" NOT NULL DEFAULT 'EMAIL',
    "recipientEmail" TEXT NOT NULL,
    "partnerProfileId" TEXT,
    "partnerUserId" TEXT,
    "partnerApplicationId" TEXT,
    "scheduleEventSeriesId" TEXT,
    "scheduleEventOccurrenceId" TEXT,
    "dedupeKey" TEXT,
    "status" "BrandNotificationDeliveryStatus" NOT NULL DEFAULT 'CLAIMED',
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "providerMessageId" TEXT,
    "metadata" JSONB,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastAttemptedAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BrandNotificationDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrandNotificationReminderRun" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "noticeType" "BrandNotificationNoticeType" NOT NULL,
    "status" "BrandNotificationReminderRunStatus" NOT NULL DEFAULT 'STARTED',
    "windowStartsAt" TIMESTAMP(3) NOT NULL,
    "windowEndsAt" TIMESTAMP(3) NOT NULL,
    "summary" JSONB,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BrandNotificationReminderRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BrandNotificationReminderPolicy_brandId_noticeType_key" ON "BrandNotificationReminderPolicy"("brandId", "noticeType");

-- CreateIndex
CREATE INDEX "BrandNotificationReminderPolicy_brandId_idx" ON "BrandNotificationReminderPolicy"("brandId");

-- CreateIndex
CREATE INDEX "BrandNotificationReminderPolicy_noticeType_idx" ON "BrandNotificationReminderPolicy"("noticeType");

-- CreateIndex
CREATE UNIQUE INDEX "BrandNotificationDelivery_dedupeKey_key" ON "BrandNotificationDelivery"("dedupeKey");

-- CreateIndex
CREATE INDEX "BrandNotificationDelivery_brandId_idx" ON "BrandNotificationDelivery"("brandId");

-- CreateIndex
CREATE INDEX "BrandNotificationDelivery_brandId_noticeType_idx" ON "BrandNotificationDelivery"("brandId", "noticeType");

-- CreateIndex
CREATE INDEX "BrandNotificationDelivery_recipientEmail_idx" ON "BrandNotificationDelivery"("recipientEmail");

-- CreateIndex
CREATE INDEX "BrandNotificationDelivery_status_idx" ON "BrandNotificationDelivery"("status");

-- CreateIndex
CREATE INDEX "BrandNotificationDelivery_partnerProfileId_idx" ON "BrandNotificationDelivery"("partnerProfileId");

-- CreateIndex
CREATE INDEX "BrandNotificationDelivery_partnerUserId_idx" ON "BrandNotificationDelivery"("partnerUserId");

-- CreateIndex
CREATE INDEX "BrandNotificationDelivery_partnerApplicationId_idx" ON "BrandNotificationDelivery"("partnerApplicationId");

-- CreateIndex
CREATE INDEX "BrandNotificationDelivery_scheduleEventSeriesId_idx" ON "BrandNotificationDelivery"("scheduleEventSeriesId");

-- CreateIndex
CREATE INDEX "BrandNotificationDelivery_scheduleEventOccurrenceId_idx" ON "BrandNotificationDelivery"("scheduleEventOccurrenceId");

-- CreateIndex
CREATE INDEX "BrandNotificationDelivery_requestedAt_idx" ON "BrandNotificationDelivery"("requestedAt");

-- CreateIndex
CREATE INDEX "BrandNotificationReminderRun_brandId_idx" ON "BrandNotificationReminderRun"("brandId");

-- CreateIndex
CREATE INDEX "BrandNotificationReminderRun_noticeType_idx" ON "BrandNotificationReminderRun"("noticeType");

-- CreateIndex
CREATE INDEX "BrandNotificationReminderRun_status_idx" ON "BrandNotificationReminderRun"("status");

-- CreateIndex
CREATE INDEX "BrandNotificationReminderRun_windowStartsAt_windowEndsAt_idx" ON "BrandNotificationReminderRun"("windowStartsAt", "windowEndsAt");

-- AddForeignKey
ALTER TABLE "BrandNotificationReminderPolicy" ADD CONSTRAINT "BrandNotificationReminderPolicy_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrandNotificationDelivery" ADD CONSTRAINT "BrandNotificationDelivery_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrandNotificationDelivery" ADD CONSTRAINT "BrandNotificationDelivery_partnerProfileId_fkey" FOREIGN KEY ("partnerProfileId") REFERENCES "PartnerProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrandNotificationDelivery" ADD CONSTRAINT "BrandNotificationDelivery_partnerUserId_fkey" FOREIGN KEY ("partnerUserId") REFERENCES "PartnerUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrandNotificationDelivery" ADD CONSTRAINT "BrandNotificationDelivery_partnerApplicationId_fkey" FOREIGN KEY ("partnerApplicationId") REFERENCES "PartnerApplication"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrandNotificationDelivery" ADD CONSTRAINT "BrandNotificationDelivery_scheduleEventSeriesId_fkey" FOREIGN KEY ("scheduleEventSeriesId") REFERENCES "ScheduleEventSeries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrandNotificationDelivery" ADD CONSTRAINT "BrandNotificationDelivery_scheduleEventOccurrenceId_fkey" FOREIGN KEY ("scheduleEventOccurrenceId") REFERENCES "ScheduleEventOccurrence"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrandNotificationReminderRun" ADD CONSTRAINT "BrandNotificationReminderRun_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill reminder template defaults for uncustomized templates only.
UPDATE "BrandNotificationTemplate"
SET
  "subjectTemplate" = 'Outstanding compliance documents for {{BrandName}}',
  "bodyHtmlTemplate" = '<p>Hello {{FirstName}},</p><p>You still have <strong>{{DiscrepancyCount}}</strong> outstanding compliance item(s) for {{BrandName}}.</p><p>{{DiscrepancySummary}}</p><p>Related events: {{EventNames}}</p><p><a href="{{PortalUrl}}">Review discrepancies</a></p>',
  "bodyTextTemplate" = E'Hello {{FirstName}},\n\nYou still have {{DiscrepancyCount}} outstanding compliance item(s) for {{BrandName}}.\n{{DiscrepancySummary}}\nRelated events: {{EventNames}}\nReview them here:\n{{PortalUrl}}',
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "noticeType" = 'COMPLIANCE_DOCS_REMINDER'
  AND "isCustomized" = false;

UPDATE "BrandNotificationTemplate"
SET
  "subjectTemplate" = '{{NextEventName}} is coming up',
  "bodyHtmlTemplate" = '<p>Hello {{FirstName}},</p><p>This is a reminder about your upcoming event: <strong>{{NextEventName}}</strong>.</p><p>Date: {{NextEventDate}}</p><p>Days until event: {{DaysUntilEvent}}</p><p><a href="{{PortalUrl}}">Open portal</a></p>',
  "bodyTextTemplate" = E'Hello {{FirstName}},\n\nThis is a reminder about your upcoming event: {{NextEventName}}.\nDate: {{NextEventDate}}\nDays until event: {{DaysUntilEvent}}\nOpen the portal here:\n{{PortalUrl}}',
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "noticeType" = 'UPCOMING_EVENT_REMINDER'
  AND "isCustomized" = false;
