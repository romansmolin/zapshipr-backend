DROP TABLE "book_extractions" CASCADE;--> statement-breakpoint
ALTER TABLE "raw_inspirations" DROP COLUMN "book_metadata";--> statement-breakpoint
ALTER TABLE "raw_inspirations" DROP COLUMN "detected_category";