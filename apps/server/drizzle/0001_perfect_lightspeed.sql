CREATE TYPE "public"."project_status" AS ENUM('provisioning', 'ready', 'failed');--> statement-breakpoint
CREATE TYPE "public"."job_status" AS ENUM('queued', 'running', 'done', 'failed');--> statement-breakpoint
CREATE TYPE "public"."message_role" AS ENUM('user', 'assistant', 'system');--> statement-breakpoint
CREATE TABLE "projects" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"github_owner" text,
	"github_repo" text,
	"default_branch" text DEFAULT 'main' NOT NULL,
	"workspace_path" text NOT NULL,
	"preview_port" integer,
	"project_status" "project_status" DEFAULT 'provisioning' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jobs" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"title" text,
	"status" "job_status" DEFAULT 'queued' NOT NULL,
	"error" text,
	"branch_name" text,
	"pr_url" text,
	"commit_sha" text,
	"started_at" timestamp,
	"finished_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"job_id" text,
	"message_role" "message_role" NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "job_events" (
	"id" text PRIMARY KEY NOT NULL,
	"job_id" text NOT NULL,
	"type" text NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_events" ADD CONSTRAINT "job_events_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "projects_user_id_created_at_idx" ON "projects" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "jobs_project_id_created_at_idx" ON "jobs" USING btree ("project_id","created_at");--> statement-breakpoint
CREATE INDEX "messages_project_id_created_at_idx" ON "messages" USING btree ("project_id","created_at");--> statement-breakpoint
CREATE INDEX "messages_job_id_idx" ON "messages" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "job_events_job_id_created_at_idx" ON "job_events" USING btree ("job_id","created_at");