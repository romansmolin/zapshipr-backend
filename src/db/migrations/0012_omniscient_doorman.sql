ALTER TABLE "posts" RENAME COLUMN "scheduled_time" TO "scheduled_at_local";--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "scheduled_timezone" text;--> statement-breakpoint
