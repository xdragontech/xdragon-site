ALTER TABLE "SchedulePublicFeed"
ADD COLUMN "feedName" TEXT;

UPDATE "SchedulePublicFeed"
SET "feedName" = CASE
  WHEN "source" = 'SPONSORS' THEN 'Sponsor Feed ' || SUBSTRING("feedId", 1, 8)
  WHEN "participantType" = 'ENTERTAINMENT' THEN 'Entertainment Feed ' || SUBSTRING("feedId", 1, 8)
  WHEN "participantType" = 'FOOD_VENDOR' THEN 'Food Vendor Feed ' || SUBSTRING("feedId", 1, 8)
  WHEN "participantType" = 'MARKET_VENDOR' THEN 'Market Vendor Feed ' || SUBSTRING("feedId", 1, 8)
  ELSE 'Feed ' || SUBSTRING("feedId", 1, 8)
END
WHERE "feedName" IS NULL;

ALTER TABLE "SchedulePublicFeed"
ALTER COLUMN "feedName" SET NOT NULL;
