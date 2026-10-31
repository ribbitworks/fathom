-- SPDX-License-Identifier: Apache-2.0

-- Makes lists user-defined: each list becomes a record of its own, its choices belong to it by
-- reference, and choices gain an order and can be retired. Choices already made move into lists
-- named after the fixed lists they were in, in alphabetical order.

CREATE TABLE "fathom"."lists" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"visibility" text DEFAULT 'general' NOT NULL,
	"retired" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "lists_name_index" ON "fathom"."lists" USING btree (lower("name"));
--> statement-breakpoint
CREATE FUNCTION "fathom"."list_title"("key" text) RETURNS text
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE "key"
    WHEN 'sites' THEN 'Sites'
    WHEN 'positions' THEN 'Positions'
    WHEN 'levels' THEN 'Levels'
    WHEN 'team-roles' THEN 'Roles on the team'
    ELSE "key"
  END
$$;
--> statement-breakpoint
INSERT INTO "fathom"."lists" ("name")
SELECT DISTINCT "fathom"."list_title"("list") FROM "fathom"."list_items";
--> statement-breakpoint
ALTER TABLE "fathom"."list_items" ADD COLUMN "list_id" uuid;
--> statement-breakpoint
UPDATE "fathom"."list_items" AS "item"
SET "list_id" = "list"."id"
FROM "fathom"."lists" AS "list"
WHERE "list"."name" = "fathom"."list_title"("item"."list");
--> statement-breakpoint
DROP FUNCTION "fathom"."list_title"(text);
--> statement-breakpoint
ALTER TABLE "fathom"."list_items" ALTER COLUMN "list_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "fathom"."list_items" ADD CONSTRAINT "list_items_list_id_lists_id_fk" FOREIGN KEY ("list_id") REFERENCES "fathom"."lists"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
DROP INDEX "fathom"."list_items_list_label_index";
--> statement-breakpoint
ALTER TABLE "fathom"."list_items" DROP COLUMN "list";
--> statement-breakpoint
CREATE UNIQUE INDEX "list_items_list_label_index" ON "fathom"."list_items" USING btree ("list_id",lower("label"));
--> statement-breakpoint
ALTER TABLE "fathom"."list_items" ADD COLUMN "position" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "fathom"."list_items" ADD COLUMN "retired" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
UPDATE "fathom"."list_items" AS "item"
SET "position" = "ordered"."place"
FROM (
  SELECT "id", row_number() OVER (PARTITION BY "list_id" ORDER BY lower("label"), "id") AS "place"
  FROM "fathom"."list_items"
) AS "ordered"
WHERE "item"."id" = "ordered"."id";
