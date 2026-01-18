CREATE TYPE "public"."transcript_format" AS ENUM('vtt', 'srt', 'text', 'json_segments');--> statement-breakpoint
CREATE TYPE "public"."transcript_source" AS ENUM('human_captions', 'auto_captions', 'stt');--> statement-breakpoint
CREATE TABLE "transcripts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"inspiration_id" uuid NOT NULL,
	"video_id" varchar(20),
	"language" varchar(10),
	"source" "transcript_source" NOT NULL,
	"format" "transcript_format" NOT NULL,
	"raw" text NOT NULL,
	"normalized_text" text,
	"segments" jsonb,
	"duration_sec" varchar(20),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "transcripts" ADD CONSTRAINT "transcripts_inspiration_id_raw_inspirations_id_fk" FOREIGN KEY ("inspiration_id") REFERENCES "public"."raw_inspirations"("id") ON DELETE cascade ON UPDATE no action;