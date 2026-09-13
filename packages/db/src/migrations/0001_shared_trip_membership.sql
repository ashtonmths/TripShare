CREATE TYPE "public"."fuel_type" AS ENUM('petrol', 'diesel');--> statement-breakpoint
CREATE TYPE "public"."correction_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
ALTER TYPE "public"."price_source" ADD VALUE IF NOT EXISTS 'mypetrolprice';--> statement-breakpoint
ALTER TABLE "carpool_group" ADD COLUMN "fuel_type" "fuel_type" DEFAULT 'petrol' NOT NULL;--> statement-breakpoint
ALTER TABLE "carpool_group" ADD COLUMN "fuel_state" text DEFAULT 'Karnataka' NOT NULL;--> statement-breakpoint
ALTER TABLE "carpool_group" ADD COLUMN "fuel_district" text DEFAULT 'Udupi' NOT NULL;--> statement-breakpoint
ALTER TABLE "carpool_group" ADD COLUMN "fuel_location_id" integer DEFAULT 383 NOT NULL;--> statement-breakpoint
ALTER TABLE "person" ADD COLUMN "email" text;--> statement-breakpoint
CREATE UNIQUE INDEX "person_group_email_uidx" ON "person" USING btree ("group_id","email");--> statement-breakpoint
CREATE TABLE "correction_request" (
	"id" text PRIMARY KEY NOT NULL,
	"journey_id" text NOT NULL,
	"person_id" text NOT NULL,
	"requester_user_id" text NOT NULL,
	"note" text,
	"status" "correction_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone,
	CONSTRAINT "correction_request_journey_id_journey_id_fk" FOREIGN KEY ("journey_id") REFERENCES "public"."journey"("id") ON DELETE cascade,
	CONSTRAINT "correction_request_person_id_person_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."person"("id") ON DELETE cascade,
	CONSTRAINT "correction_request_requester_user_id_user_id_fk" FOREIGN KEY ("requester_user_id") REFERENCES "public"."user"("id") ON DELETE cascade
);--> statement-breakpoint
CREATE UNIQUE INDEX "correction_journey_person_uidx" ON "correction_request" USING btree ("journey_id","person_id");--> statement-breakpoint
CREATE INDEX "correction_person_idx" ON "correction_request" USING btree ("person_id");
