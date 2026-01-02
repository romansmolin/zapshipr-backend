CREATE TYPE "public"."inspiration_status" AS ENUM('processing', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."inspiration_type" AS ENUM('image', 'link', 'text', 'document');--> statement-breakpoint
CREATE TYPE "public"."tag_category" AS ENUM('topic', 'format', 'tone', 'style', 'other');--> statement-breakpoint
CREATE TABLE "inspirations_extractions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"raw_inspiration_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"summary" text NOT NULL,
	"key_topics" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"content_format" varchar(50),
	"tone" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"target_audience" text,
	"key_insights" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"content_structure" text,
	"visual_style" text,
	"suggested_tags" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"llm_model" varchar(50),
	"tokens_used" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "raw_inspirations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"type" "inspiration_type" NOT NULL,
	"content" text,
	"image_url" varchar(1024),
	"user_description" text,
	"metadata" jsonb,
	"parsed_content" text,
	"status" "inspiration_status" DEFAULT 'processing' NOT NULL,
	"error_message" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workspace_tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"category" "tag_category" NOT NULL,
	"usage_count" integer DEFAULT 0 NOT NULL,
	"is_user_created" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "workspaces" ADD COLUMN "main_prompt" jsonb;--> statement-breakpoint
ALTER TABLE "inspirations_extractions" ADD CONSTRAINT "inspirations_extractions_raw_inspiration_id_raw_inspirations_id_fk" FOREIGN KEY ("raw_inspiration_id") REFERENCES "public"."raw_inspirations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inspirations_extractions" ADD CONSTRAINT "inspirations_extractions_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "raw_inspirations" ADD CONSTRAINT "raw_inspirations_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "raw_inspirations" ADD CONSTRAINT "raw_inspirations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_tags" ADD CONSTRAINT "workspace_tags_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_raw_inspirations_workspace" ON "raw_inspirations" ("workspace_id", "created_at" DESC);--> statement-breakpoint
CREATE INDEX "idx_raw_inspirations_status" ON "raw_inspirations" ("workspace_id", "status");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_raw_inspirations_url" ON "raw_inspirations" ("workspace_id", "content") WHERE "type" = 'link';--> statement-breakpoint
CREATE INDEX "idx_inspirations_extractions_workspace" ON "inspirations_extractions" ("workspace_id", "created_at" DESC);--> statement-breakpoint
CREATE INDEX "idx_inspirations_extractions_raw" ON "inspirations_extractions" ("raw_inspiration_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_workspace_tags_unique" ON "workspace_tags" ("workspace_id", "name", "category");--> statement-breakpoint
CREATE INDEX "idx_workspace_tags_usage" ON "workspace_tags" ("workspace_id", "usage_count" DESC);