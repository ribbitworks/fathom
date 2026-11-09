-- SPDX-License-Identifier: Apache-2.0

-- Workstreams are projects of their own kind, and a feature can belong to one.

ALTER TABLE "fathom"."features" ADD COLUMN "workstream_id" uuid;--> statement-breakpoint
ALTER TABLE "fathom"."projects" ADD COLUMN "kind" text DEFAULT 'project' NOT NULL;--> statement-breakpoint
ALTER TABLE "fathom"."features" ADD CONSTRAINT "features_workstream_id_projects_id_fk" FOREIGN KEY ("workstream_id") REFERENCES "fathom"."projects"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "features_workstream_index" ON "fathom"."features" USING btree ("workstream_id");--> statement-breakpoint
ALTER TABLE "fathom"."projects" ADD CONSTRAINT "projects_kind" CHECK ("fathom"."projects"."kind" IN ('project', 'workstream'));--> statement-breakpoint
ALTER TABLE "fathom"."projects" ADD CONSTRAINT "projects_workstream_unlinked" CHECK ("fathom"."projects"."kind" = 'project' OR ("fathom"."projects"."external_id" IS NULL AND "fathom"."projects"."customer_ids" = '{}' AND "fathom"."projects"."proposal_ids" = '{}'));