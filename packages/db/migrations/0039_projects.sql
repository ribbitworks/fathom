-- SPDX-License-Identifier: Apache-2.0

-- Customers, proposals, projects, and their milestones, as the plan's records, each changed through
-- drafts, and a built-in proposal statuses list, starting with Open, Won, Lost, and Withdrawn, named
-- apart from any list already called Proposal statuses.

CREATE TABLE "fathom"."customers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fathom"."milestones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"name" text NOT NULL,
	"date" date NOT NULL,
	"customer_delivery" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fathom"."projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"external_id" text,
	"owner_id" uuid,
	"customer_ids" uuid[] DEFAULT '{}' NOT NULL,
	"proposal_ids" uuid[] DEFAULT '{}' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fathom"."proposals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"external_id" text,
	"link" text,
	"owner_id" uuid,
	"customer_ids" uuid[] DEFAULT '{}' NOT NULL,
	"status_id" uuid NOT NULL
);
--> statement-breakpoint
ALTER TABLE "fathom"."lists" DROP CONSTRAINT "lists_built_in_known";--> statement-breakpoint
ALTER TABLE "fathom"."milestones" ADD CONSTRAINT "milestones_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "fathom"."projects"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fathom"."projects" ADD CONSTRAINT "projects_owner_id_people_id_fk" FOREIGN KEY ("owner_id") REFERENCES "fathom"."people"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fathom"."proposals" ADD CONSTRAINT "proposals_owner_id_people_id_fk" FOREIGN KEY ("owner_id") REFERENCES "fathom"."people"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fathom"."proposals" ADD CONSTRAINT "proposals_status_id_list_items_id_fk" FOREIGN KEY ("status_id") REFERENCES "fathom"."list_items"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "customers_name_index" ON "fathom"."customers" USING btree (lower("name"));--> statement-breakpoint
CREATE INDEX "milestones_project_index" ON "fathom"."milestones" USING btree ("project_id");--> statement-breakpoint
CREATE UNIQUE INDEX "projects_name_index" ON "fathom"."projects" USING btree (lower("name"));--> statement-breakpoint
CREATE UNIQUE INDEX "projects_external_id_index" ON "fathom"."projects" USING btree (lower("external_id"));--> statement-breakpoint
CREATE INDEX "projects_owner_index" ON "fathom"."projects" USING btree ("owner_id");--> statement-breakpoint
CREATE UNIQUE INDEX "proposals_name_index" ON "fathom"."proposals" USING btree (lower("name"));--> statement-breakpoint
CREATE UNIQUE INDEX "proposals_external_id_index" ON "fathom"."proposals" USING btree (lower("external_id"));--> statement-breakpoint
CREATE INDEX "proposals_owner_index" ON "fathom"."proposals" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "proposals_status_index" ON "fathom"."proposals" USING btree ("status_id");--> statement-breakpoint
ALTER TABLE "fathom"."lists" ADD CONSTRAINT "lists_built_in_known" CHECK ("fathom"."lists"."built_in" IS NULL OR "fathom"."lists"."built_in" IN ('positions', 'hiring-states', 'proposal-statuses'));--> statement-breakpoint
INSERT INTO "fathom"."lists" ("name", "description", "visibility", "built_in")
SELECT CASE WHEN EXISTS (SELECT 1 FROM "fathom"."lists" WHERE lower("name") = 'proposal statuses')
    THEN 'Proposal statuses (built in)' ELSE 'Proposal statuses' END,
  '', 'general', 'proposal-statuses';--> statement-breakpoint
INSERT INTO "fathom"."list_items" ("list_id", "label", "position")
SELECT "id", "label", "position"
FROM "fathom"."lists",
  (VALUES ('Open', 1), ('Won', 2), ('Lost', 3), ('Withdrawn', 4)) AS "choice"("label", "position")
WHERE "built_in" = 'proposal-statuses';
