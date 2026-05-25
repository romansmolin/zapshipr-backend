-- Drop legacy columns from user_plans that no longer exist in the schema
ALTER TABLE "user_plans" DROP COLUMN IF EXISTS "sent_posts_limit";
--> statement-breakpoint
ALTER TABLE "user_plans" DROP COLUMN IF EXISTS "scheduled_posts_limit";
--> statement-breakpoint
ALTER TABLE "user_plans" DROP COLUMN IF EXISTS "platforms_allowed";
--> statement-breakpoint
ALTER TABLE "user_plans" DROP COLUMN IF EXISTS "accounts_limit";
--> statement-breakpoint
ALTER TABLE "user_plans" DROP COLUMN IF EXISTS "ai_requests_limit";
