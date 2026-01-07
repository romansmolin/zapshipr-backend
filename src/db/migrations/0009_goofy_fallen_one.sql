ALTER TABLE "inspirations_extractions" ADD COLUMN "youtube_data" jsonb;--> statement-breakpoint
ALTER TABLE "inspirations_extractions" ADD COLUMN "extraction_type" varchar(20) DEFAULT 'generic';