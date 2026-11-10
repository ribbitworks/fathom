-- SPDX-License-Identifier: Apache-2.0

-- Workstreams are no more. Any kept become plain projects, and their features stay, unlinked.

ALTER TABLE "fathom"."projects" DROP CONSTRAINT "projects_kind";--> statement-breakpoint
ALTER TABLE "fathom"."projects" DROP CONSTRAINT "projects_workstream_unlinked";--> statement-breakpoint
ALTER TABLE "fathom"."features" DROP CONSTRAINT "features_workstream_id_projects_id_fk";
--> statement-breakpoint
DROP INDEX "fathom"."features_workstream_index";--> statement-breakpoint
ALTER TABLE "fathom"."features" DROP COLUMN "workstream_id";--> statement-breakpoint
ALTER TABLE "fathom"."projects" DROP COLUMN "kind";
