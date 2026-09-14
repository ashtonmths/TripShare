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
ALTER TABLE "app_release" ADD CONSTRAINT "app_release_published_by_user_id_fk" FOREIGN KEY ("published_by") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "app_release_platform_published_idx" ON "app_release" USING btree ("platform","published_at");
