CREATE TYPE "SchedulePublicFeedInterval" AS ENUM ('WEEKLY', 'MONTHLY');

ALTER TABLE "SchedulePublicFeed"
ADD COLUMN "interval" "SchedulePublicFeedInterval" NOT NULL DEFAULT 'WEEKLY',
ADD COLUMN "weekEnding" "ScheduleWeekday" NOT NULL DEFAULT 'FRIDAY';

UPDATE "SchedulePublicFeed"
SET "weekEnding" = COALESCE(
  CASE WHEN 'SUNDAY' = ANY("weekdays") THEN 'SUNDAY'::"ScheduleWeekday" END,
  CASE WHEN 'SATURDAY' = ANY("weekdays") THEN 'SATURDAY'::"ScheduleWeekday" END,
  CASE WHEN 'FRIDAY' = ANY("weekdays") THEN 'FRIDAY'::"ScheduleWeekday" END,
  CASE WHEN 'THURSDAY' = ANY("weekdays") THEN 'THURSDAY'::"ScheduleWeekday" END,
  CASE WHEN 'WEDNESDAY' = ANY("weekdays") THEN 'WEDNESDAY'::"ScheduleWeekday" END,
  CASE WHEN 'TUESDAY' = ANY("weekdays") THEN 'TUESDAY'::"ScheduleWeekday" END,
  CASE WHEN 'MONDAY' = ANY("weekdays") THEN 'MONDAY'::"ScheduleWeekday" END,
  'FRIDAY'::"ScheduleWeekday"
);
