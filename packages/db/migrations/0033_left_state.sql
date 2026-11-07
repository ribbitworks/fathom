-- SPDX-License-Identifier: Apache-2.0

-- Gives the hiring states list a fourth meaning, Left, the state of people whose end date has
-- passed, with a choice for it at the end of the list, named apart from any choice already called
-- Left, and lets each person keep a state of their own.

ALTER TABLE "fathom"."list_items" DROP CONSTRAINT "list_items_meaning_known";--> statement-breakpoint
ALTER TABLE "fathom"."people" ADD COLUMN "state_id" uuid;--> statement-breakpoint
ALTER TABLE "fathom"."people" ADD CONSTRAINT "people_state_id_list_items_id_fk" FOREIGN KEY ("state_id") REFERENCES "fathom"."list_items"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "people_state_index" ON "fathom"."people" USING btree ("state_id");--> statement-breakpoint
ALTER TABLE "fathom"."list_items" ADD CONSTRAINT "list_items_meaning_known" CHECK ("fathom"."list_items"."meaning" IS NULL OR "fathom"."list_items"."meaning" IN ('proposed', 'open', 'hired', 'left'));--> statement-breakpoint
INSERT INTO "fathom"."list_items" ("list_id", "label", "position", "meaning")
SELECT "list"."id",
  CASE WHEN EXISTS (
      SELECT 1 FROM "fathom"."list_items" "item"
      WHERE "item"."list_id" = "list"."id" AND lower("item"."label") = 'left'
    ) THEN 'Left (built in)' ELSE 'Left' END,
  coalesce((SELECT max("position") FROM "fathom"."list_items" WHERE "list_id" = "list"."id"), 0) + 1,
  'left'
FROM "fathom"."lists" "list"
WHERE "list"."built_in" = 'hiring-states';
