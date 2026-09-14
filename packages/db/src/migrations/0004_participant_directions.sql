ALTER TABLE "journey_participant" ADD COLUMN "direction" "journey_direction";--> statement-breakpoint
UPDATE "journey_participant" AS jp
SET "direction" = j."direction"
FROM "journey" AS j
WHERE j."id" = jp."journey_id";--> statement-breakpoint
ALTER TABLE "journey_participant" ALTER COLUMN "direction" SET NOT NULL;
