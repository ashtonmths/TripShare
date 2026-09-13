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
	"resolved_at" timestamp with time zone,
	CONSTRAINT "payment_claim_group_id_carpool_group_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."carpool_group"("id") ON DELETE cascade,
	CONSTRAINT "payment_claim_person_id_person_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."person"("id") ON DELETE cascade,
	CONSTRAINT "payment_claim_requester_user_id_user_id_fk" FOREIGN KEY ("requester_user_id") REFERENCES "public"."user"("id") ON DELETE cascade
);--> statement-breakpoint
CREATE INDEX "payment_claim_group_status_idx" ON "payment_claim" USING btree ("group_id","status");
