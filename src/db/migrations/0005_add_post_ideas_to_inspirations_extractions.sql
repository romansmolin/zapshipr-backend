ALTER TABLE "inspirations_extractions"
ADD COLUMN "post_ideas" text[] NOT NULL DEFAULT ARRAY[]::text[];
