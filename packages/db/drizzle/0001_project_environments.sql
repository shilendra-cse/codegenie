CREATE TYPE "public"."environment_health" AS ENUM('ok', 'needs_attention');--> statement-breakpoint
CREATE TYPE "public"."environment_source" AS ENUM('detected', 'ai', 'user', 'mixed');--> statement-breakpoint
CREATE TYPE "public"."environment_status" AS ENUM('active', 'superseded');--> statement-breakpoint
CREATE TABLE "project_environments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"config" jsonb NOT NULL,
	"source" "environment_source" NOT NULL,
	"status" "environment_status" DEFAULT 'active' NOT NULL,
	"health" "environment_health" DEFAULT 'ok' NOT NULL,
	"health_reasons" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"health_updated_at" timestamp with time zone,
	"verified_commit" text,
	"created_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "environment_id" uuid;--> statement-breakpoint
ALTER TABLE "project_environments" ADD CONSTRAINT "project_environments_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_environments" ADD CONSTRAINT "project_environments_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "project_environments_project_id_version_idx" ON "project_environments" USING btree ("project_id","version");--> statement-breakpoint
CREATE UNIQUE INDEX "project_environments_one_active_idx" ON "project_environments" USING btree ("project_id") WHERE "project_environments"."status" = 'active';--> statement-breakpoint
CREATE INDEX "project_environments_project_id_created_at_idx" ON "project_environments" USING btree ("project_id","created_at");--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_environment_id_project_environments_id_fk" FOREIGN KEY ("environment_id") REFERENCES "public"."project_environments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" DROP COLUMN "setup_config";