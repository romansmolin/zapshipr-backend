CREATE TABLE "workspace_profile_signals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"signal_type" varchar(50) NOT NULL,
	"signal_source" varchar(50) NOT NULL,
	"signal_data" jsonb NOT NULL,
	"weight" numeric(3, 2) DEFAULT '1.0',
	"is_processed" boolean DEFAULT false,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "workspace_profile_signals" ADD CONSTRAINT "workspace_profile_signals_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "workspace_signals_workspace_idx" ON "workspace_profile_signals" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "workspace_signals_type_idx" ON "workspace_profile_signals" USING btree ("signal_type");--> statement-breakpoint
CREATE INDEX "workspace_signals_processed_idx" ON "workspace_profile_signals" USING btree ("is_processed");--> statement-breakpoint
CREATE INDEX "workspace_signals_created_idx" ON "workspace_profile_signals" USING btree ("created_at" DESC NULLS LAST);