ALTER TYPE "public"."inspiration_status" ADD VALUE 'transcript_fetching' BEFORE 'completed';--> statement-breakpoint
ALTER TYPE "public"."inspiration_status" ADD VALUE 'transcript_ready' BEFORE 'completed';--> statement-breakpoint
ALTER TYPE "public"."inspiration_status" ADD VALUE 'extracting' BEFORE 'completed';