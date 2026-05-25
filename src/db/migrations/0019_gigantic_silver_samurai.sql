CREATE TABLE IF NOT EXISTS "user_plan_usage" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"plan_id" uuid NOT NULL,
	"usage_type" text NOT NULL,
	"period_start" timestamp with time zone NOT NULL,
	"period_end" timestamp with time zone NOT NULL,
	"used_count" integer DEFAULT 0 NOT NULL,
	"limit_count" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"plan_name" text NOT NULL,
	"plan_type" text DEFAULT 'monthly' NOT NULL,
	"start_date" timestamp with time zone DEFAULT now() NOT NULL,
	"end_date" timestamp with time zone,
	"is_active" boolean DEFAULT true NOT NULL,
	"stripe_subscription_id" text,
	"stripe_price_id" text,
	"stripe_lookup_key" text,
	"billing_status" text DEFAULT 'active' NOT NULL,
	"current_period_end" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "media_assets" ADD COLUMN IF NOT EXISTS "size_bytes" bigint;
--> statement-breakpoint
ALTER TABLE "post_targets" ADD COLUMN IF NOT EXISTS "media_indices" integer[];
--> statement-breakpoint
DO $$ BEGIN
    ALTER TABLE "user_plan_usage" ADD CONSTRAINT "user_plan_usage_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
    ALTER TABLE "user_plan_usage" ADD CONSTRAINT "user_plan_usage_plan_id_user_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."user_plans"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
    ALTER TABLE "user_plans" ADD CONSTRAINT "user_plans_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_plan_usage_user_id_idx" ON "user_plan_usage" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_plan_usage_period_idx" ON "user_plan_usage" USING btree ("user_id","usage_type","period_start","period_end");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "user_plan_usage_unique_period" ON "user_plan_usage" USING btree ("user_id","plan_id","usage_type","period_start","period_end");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_plans_user_id_idx" ON "user_plans" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_plans_user_active_idx" ON "user_plans" USING btree ("user_id","is_active");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "user_plans_stripe_subscription_id_key" ON "user_plans" USING btree ("stripe_subscription_id");
