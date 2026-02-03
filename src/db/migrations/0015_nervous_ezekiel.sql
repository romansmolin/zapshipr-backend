CREATE TABLE "user_media" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"key" varchar(1024) NOT NULL,
	"url" text NOT NULL,
	"size" integer NOT NULL,
	"content_type" varchar(128),
	"last_modified" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_media_key_unique" UNIQUE("key")
);
--> statement-breakpoint
ALTER TABLE "user_media" ADD CONSTRAINT "user_media_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "user_media_user_id_idx" ON "user_media" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_media_key_idx" ON "user_media" USING btree ("key");