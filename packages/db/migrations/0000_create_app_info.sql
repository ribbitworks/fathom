-- The schema is created when the database is first set up; this keeps the migration safe to rerun.
CREATE SCHEMA IF NOT EXISTS "fathom";
--> statement-breakpoint
CREATE TABLE "fathom"."app_info" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text NOT NULL
);
