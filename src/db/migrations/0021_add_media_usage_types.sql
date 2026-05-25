ALTER TABLE "user_plan_usage" DROP CONSTRAINT "user_plan_usage_usage_type_check";
--> statement-breakpoint
ALTER TABLE "user_plan_usage" ADD CONSTRAINT "user_plan_usage_usage_type_check" CHECK (usage_type = ANY (ARRAY['sent'::text, 'scheduled'::text, 'accounts'::text, 'ai'::text, 'files'::text, 'storage_bytes'::text]));
