ALTER TABLE "posts" ALTER COLUMN "workspace_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "social_accounts" ALTER COLUMN "workspace_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "workspaces" ADD COLUMN "is_default" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX "workspaces_user_default_idx" ON "workspaces" USING btree ("user_id","is_default");