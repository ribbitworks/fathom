-- SPDX-License-Identifier: Apache-2.0

-- Gives planned hires an optional name, and the hiring states list a third meaning, Hired, which is
-- every person's state, with a choice for it at the end of the list, named apart from any choice
-- already called Hired.

ALTER TABLE "fathom"."list_items" DROP CONSTRAINT "list_items_meaning_known";--> statement-breakpoint
ALTER TABLE "fathom"."planned_hires" ADD COLUMN "name" text;--> statement-breakpoint
ALTER TABLE "fathom"."list_items" ADD CONSTRAINT "list_items_meaning_known" CHECK ("fathom"."list_items"."meaning" IS NULL OR "fathom"."list_items"."meaning" IN ('proposed', 'open', 'hired'));--> statement-breakpoint
INSERT INTO "fathom"."list_items" ("list_id", "label", "position", "meaning")
SELECT "list"."id",
  CASE WHEN EXISTS (
      SELECT 1 FROM "fathom"."list_items" "item"
      WHERE "item"."list_id" = "list"."id" AND lower("item"."label") = 'hired'
    ) THEN 'Hired (built in)' ELSE 'Hired' END,
  coalesce((SELECT max("position") FROM "fathom"."list_items" WHERE "list_id" = "list"."id"), 0) + 1,
  'hired'
FROM "fathom"."lists" "list"
WHERE "list"."built_in" = 'hiring-states';
