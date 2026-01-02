CREATE TABLE "media_assets" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"url" text NOT NULL,
	"type" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pinterest_boards" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"social_account_id" uuid NOT NULL,
	"pinterest_board_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"owner_username" text,
	"thumbnail_url" text,
	"privacy" "pinterest_board_privacy" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "post_media_assets" (
	"post_id" uuid NOT NULL,
	"media_asset_id" uuid NOT NULL,
	"order" integer NOT NULL,
	CONSTRAINT "post_media_assets_post_id_media_asset_id_pk" PRIMARY KEY("post_id","media_asset_id")
);
--> statement-breakpoint
CREATE TABLE "post_targets" (
	"post_id" uuid NOT NULL,
	"social_account_id" uuid NOT NULL,
	"platform" "social_platform" NOT NULL,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"error_message" text,
	"text" text,
	"title" text,
	"pinterest_board_id" text,
	"tags" text[],
	"links" text[],
	"is_auto_music_enabled" boolean,
	"instagram_location_id" text,
	"instagram_facebook_page_id" text,
	"threads_replies" jsonb,
	"tik_tok_post_privacy_level" text
);
--> statement-breakpoint
CREATE TABLE "posts" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"status" text NOT NULL,
	"type" text,
	"scheduled_time" timestamp with time zone,
	"main_caption" text,
	"cover_timestamp" integer,
	"cover_image_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "social_accounts" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"platform" "social_platform" NOT NULL,
	"username" text NOT NULL,
	"access_token" text NOT NULL,
	"refresh_token" text,
	"picture" text,
	"connected_date" timestamp,
	"page_id" text NOT NULL,
	"expires_in" timestamp,
	"refresh_expires_in" timestamp,
	"max_video_post_duration_sec" integer,
	"privacy_level_options" text[],
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"password_hash" text,
	"google_auth" boolean DEFAULT false NOT NULL,
	"avatar" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"refresh_token" text,
	"stripe_customer_id" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "waitlist_entries" (
	"id" uuid PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"email_normalized" text NOT NULL,
	"status" text NOT NULL,
	"referral_code" text NOT NULL,
	"referred_by_id" uuid,
	"referred_at" timestamp,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "waitlist_referral_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"referrer_id" uuid NOT NULL,
	"referred_entry_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "waitlist_referral_rewards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"waitlist_entry_id" uuid NOT NULL,
	"type" text NOT NULL,
	"status" text NOT NULL,
	"granted_at" timestamp with time zone,
	"meta" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pinterest_boards" ADD CONSTRAINT "pinterest_boards_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pinterest_boards" ADD CONSTRAINT "pinterest_boards_social_account_id_social_accounts_id_fk" FOREIGN KEY ("social_account_id") REFERENCES "public"."social_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_media_assets" ADD CONSTRAINT "post_media_assets_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_media_assets" ADD CONSTRAINT "post_media_assets_media_asset_id_media_assets_id_fk" FOREIGN KEY ("media_asset_id") REFERENCES "public"."media_assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_targets" ADD CONSTRAINT "post_targets_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_targets" ADD CONSTRAINT "post_targets_social_account_id_social_accounts_id_fk" FOREIGN KEY ("social_account_id") REFERENCES "public"."social_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_accounts" ADD CONSTRAINT "social_accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "waitlist_entries" ADD CONSTRAINT "waitlist_entries_referred_by_id_waitlist_entries_id_fk" FOREIGN KEY ("referred_by_id") REFERENCES "public"."waitlist_entries"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "waitlist_referral_events" ADD CONSTRAINT "waitlist_referral_events_referrer_id_waitlist_entries_id_fk" FOREIGN KEY ("referrer_id") REFERENCES "public"."waitlist_entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "waitlist_referral_events" ADD CONSTRAINT "waitlist_referral_events_referred_entry_id_waitlist_entries_id_fk" FOREIGN KEY ("referred_entry_id") REFERENCES "public"."waitlist_entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "waitlist_referral_rewards" ADD CONSTRAINT "waitlist_referral_rewards_waitlist_entry_id_waitlist_entries_id_fk" FOREIGN KEY ("waitlist_entry_id") REFERENCES "public"."waitlist_entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "pinterest_boards_user_board_unique" ON "pinterest_boards" USING btree ("user_id","pinterest_board_id");--> statement-breakpoint
CREATE UNIQUE INDEX "social_accounts_user_page_unique" ON "social_accounts" USING btree ("user_id","page_id");--> statement-breakpoint
CREATE UNIQUE INDEX "waitlist_entries_email_normalized_unique" ON "waitlist_entries" USING btree ("email_normalized");--> statement-breakpoint
CREATE UNIQUE INDEX "waitlist_entries_referral_code_unique" ON "waitlist_entries" USING btree ("referral_code");--> statement-breakpoint
CREATE UNIQUE INDEX "waitlist_referral_events_referred_entry_unique" ON "waitlist_referral_events" USING btree ("referred_entry_id");--> statement-breakpoint
CREATE UNIQUE INDEX "waitlist_referral_rewards_entry_type_unique" ON "waitlist_referral_rewards" USING btree ("waitlist_entry_id","type");