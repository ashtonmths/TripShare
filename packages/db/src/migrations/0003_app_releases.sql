CREATE TYPE "public"."correction_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."fuel_type" AS ENUM('petrol', 'diesel');--> statement-breakpoint
ALTER TYPE "public"."price_source" ADD VALUE 'mypetrolprice' BEFORE 'manual';--> statement-breakpoint
CREATE TABLE "app_release" (
	"id" text PRIMARY KEY NOT NULL,
	"platform" text NOT NULL,
	"version" text NOT NULL,
	"download_url" text NOT NULL,
	"notes" text,
	"published_by" text NOT NULL,
	"published_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "correction_request" (
	"id" text PRIMARY KEY NOT NULL,
	"journey_id" text NOT NULL,
	"person_id" text NOT NULL,
	"requester_user_id" text NOT NULL,
	"note" text,
	"status" "correction_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "payment_claim" (
	"id" text PRIMARY KEY NOT NULL,
	"group_id" text NOT NULL,
	"person_id" text NOT NULL,
	"requester_user_id" text NOT NULL,
	"amount_paise" integer NOT NULL,
	"method" "payment_method" NOT NULL,
	"paid_on" date NOT NULL,
	"note" text,
	"status" "correction_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "carpool_group" ADD COLUMN "fuel_type" "fuel_type" DEFAULT 'petrol' NOT NULL;--> statement-breakpoint
ALTER TABLE "carpool_group" ADD COLUMN "fuel_state" text DEFAULT 'Karnataka' NOT NULL;--> statement-breakpoint
ALTER TABLE "carpool_group" ADD COLUMN "fuel_district" text DEFAULT 'Udupi' NOT NULL;--> statement-breakpoint
ALTER TABLE "carpool_group" ADD COLUMN "fuel_location_id" integer DEFAULT 383 NOT NULL;--> statement-breakpoint
ALTER TABLE "person" ADD COLUMN "email" text;--> statement-breakpoint
ALTER TABLE "app_release" ADD CONSTRAINT "app_release_published_by_user_id_fk" FOREIGN KEY ("published_by") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "correction_request" ADD CONSTRAINT "correction_request_journey_id_journey_id_fk" FOREIGN KEY ("journey_id") REFERENCES "public"."journey"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "correction_request" ADD CONSTRAINT "correction_request_person_id_person_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."person"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "correction_request" ADD CONSTRAINT "correction_request_requester_user_id_user_id_fk" FOREIGN KEY ("requester_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_claim" ADD CONSTRAINT "payment_claim_group_id_carpool_group_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."carpool_group"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_claim" ADD CONSTRAINT "payment_claim_person_id_person_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."person"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_claim" ADD CONSTRAINT "payment_claim_requester_user_id_user_id_fk" FOREIGN KEY ("requester_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "app_release_platform_published_idx" ON "app_release" USING btree ("platform","published_at");--> statement-breakpoint
CREATE UNIQUE INDEX "correction_journey_person_uidx" ON "correction_request" USING btree ("journey_id","person_id");--> statement-breakpoint
CREATE INDEX "correction_person_idx" ON "correction_request" USING btree ("person_id");--> statement-breakpoint
CREATE INDEX "payment_claim_group_status_idx" ON "payment_claim" USING btree ("group_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "person_group_email_uidx" ON "person" USING btree ("group_id","email");