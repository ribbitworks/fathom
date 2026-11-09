-- SPDX-License-Identifier: Apache-2.0

-- Feature statuses become a built-in list with meanings, with one choice for each meaning, and a
-- feature's status a choice of it. Features gain the month they are needed by, customers, and a
-- note. Databases are reset rather than converted before the first deployment, so a database
-- holding features must be reset: this fails on one, as a feature's status has no default.

ALTER TABLE "fathom"."features" DROP CONSTRAINT "features_status_known";--> statement-breakpoint
ALTER TABLE "fathom"."list_items" DROP CONSTRAINT "list_items_meaning_known";--> statement-breakpoint
ALTER TABLE "fathom"."lists" DROP CONSTRAINT "lists_built_in_known";--> statement-breakpoint
ALTER TABLE "fathom"."features" ADD COLUMN "status_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "fathom"."features" ADD COLUMN "needed_by" text;--> statement-breakpoint
ALTER TABLE "fathom"."features" ADD COLUMN "customer_ids" uuid[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "fathom"."features" ADD COLUMN "note" text;--> statement-breakpoint
ALTER TABLE "fathom"."features" ADD CONSTRAINT "features_status_id_list_items_id_fk" FOREIGN KEY ("status_id") REFERENCES "fathom"."list_items"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "features_status_index" ON "fathom"."features" USING btree ("status_id");--> statement-breakpoint
ALTER TABLE "fathom"."features" DROP COLUMN "status";--> statement-breakpoint
ALTER TABLE "fathom"."features" ADD CONSTRAINT "features_needed_by_month" CHECK ("fathom"."features"."needed_by" ~ '^[0-9]{4}-(0[1-9]|1[0-2])$');--> statement-breakpoint
ALTER TABLE "fathom"."features" ADD CONSTRAINT "features_note_not_empty" CHECK ("fathom"."features"."note" <> '');--> statement-breakpoint
ALTER TABLE "fathom"."list_items" ADD CONSTRAINT "list_items_meaning_known" CHECK ("fathom"."list_items"."meaning" IS NULL OR "fathom"."list_items"."meaning" IN ('proposed', 'open', 'hired', 'left', 'possible', 'planned', 'in-progress', 'done', 'cancelled'));--> statement-breakpoint
ALTER TABLE "fathom"."lists" ADD CONSTRAINT "lists_built_in_known" CHECK ("fathom"."lists"."built_in" IS NULL OR "fathom"."lists"."built_in" IN ('positions', 'hiring-states', 'proposal-statuses', 'feature-statuses'));--> statement-breakpoint
INSERT INTO "fathom"."lists" ("name", "description", "visibility", "built_in")
SELECT CASE WHEN EXISTS (SELECT 1 FROM "fathom"."lists" WHERE lower("name") = 'feature statuses')
    THEN 'Feature statuses (built in)' ELSE 'Feature statuses' END,
  '', 'general', 'feature-statuses';--> statement-breakpoint
INSERT INTO "fathom"."list_items" ("list_id", "label", "position", "meaning")
SELECT "id", "label", "position", "meaning"
FROM "fathom"."lists",
  (VALUES ('Possible', 1, 'possible'), ('Planned', 2, 'planned'), ('In progress', 3, 'in-progress'), ('Done', 4, 'done'), ('Cancelled', 5, 'cancelled')) AS "choice"("label", "position", "meaning")
WHERE "built_in" = 'feature-statuses';
