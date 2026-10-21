CREATE TABLE "run_diffs" (
	"run_id" uuid PRIMARY KEY NOT NULL,
	"patch" text NOT NULL,
	"files" jsonb NOT NULL,
	"truncated" boolean NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "run_diffs" ADD CONSTRAINT "run_diffs_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE cascade ON UPDATE no action;