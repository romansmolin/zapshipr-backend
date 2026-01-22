-- Convert scheduled_at_local from timestamp to text
-- First, alter the column to text (with data conversion)
ALTER TABLE "posts" ALTER COLUMN "scheduled_at_local" TYPE text USING "scheduled_at_local"::text;
