CREATE TABLE "book_extractions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"raw_inspiration_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"title" varchar(500) NOT NULL,
	"authors" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"isbn" varchar(20),
	"isbn13" varchar(20),
	"publication_year" integer,
	"publisher" varchar(255),
	"genre" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"category" varchar(100),
	"language" varchar(10),
	"page_count" integer,
	"identification_confidence" real,
	"semantic_core" jsonb NOT NULL,
	"themes_and_patterns" jsonb NOT NULL,
	"knowledge_connections" jsonb NOT NULL,
	"content_generation_guidelines" jsonb NOT NULL,
	"llm_model" varchar(50),
	"tokens_used" integer,
	"vision_used" integer DEFAULT 0,
	"external_sources_used" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"processing_duration_ms" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "raw_inspirations" ADD COLUMN "book_metadata" jsonb;--> statement-breakpoint
ALTER TABLE "raw_inspirations" ADD COLUMN "detected_category" varchar(50);--> statement-breakpoint
ALTER TABLE "book_extractions" ADD CONSTRAINT "book_extractions_raw_inspiration_id_raw_inspirations_id_fk" FOREIGN KEY ("raw_inspiration_id") REFERENCES "public"."raw_inspirations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "book_extractions" ADD CONSTRAINT "book_extractions_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;