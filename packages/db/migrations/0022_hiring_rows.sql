-- SPDX-License-Identifier: Apache-2.0

-- Builds in the Positions list and a hiring states list whose choices carry a meaning, gives people
-- and planned hires a required position, and makes a planned hire known by its requisition or a
-- temporary number instead of a title, in a state chosen from the hiring states list. Fathom holds
-- no real data yet, so the data is carried over simply: the list the Position column on people
-- draws on, or else a list named Positions, becomes the built-in one, and the Position column's
-- values become people's and hires' positions, the first in the list's order where it holds
-- several, with anyone left without one given a choice named Position not set. The column itself is
-- removed, its place in the column order and in saved views taken by the built-in Position column;
-- other columns drawing on the list are kept. Drafts that would retire, remove, or change the
-- visibility of the list that becomes Positions are dropped, since a built-in list allows none of
-- those. Each hire's state becomes the choice meaning Proposed or Open that it maps to, with a
-- temporary number of its own, and cancelled and filled hires are removed, with every planned hire's
-- draft, since drafts hold the old details. Employee IDs that look like temporary IDs gain a prefix.

CREATE SEQUENCE "fathom"."planned_hire_temporary_numbers" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1;--> statement-breakpoint
ALTER TABLE "fathom"."list_items" ADD COLUMN "meaning" text;--> statement-breakpoint
ALTER TABLE "fathom"."lists" ADD COLUMN "built_in" text;--> statement-breakpoint
ALTER TABLE "fathom"."list_items" ADD CONSTRAINT "list_items_meaning_known" CHECK ("fathom"."list_items"."meaning" IS NULL OR "fathom"."list_items"."meaning" IN ('proposed', 'open'));--> statement-breakpoint
CREATE UNIQUE INDEX "lists_built_in_index" ON "fathom"."lists" USING btree ("built_in");--> statement-breakpoint
-- The Position column on people, if there is one, is the first column on people named Position.
-- The built-in Positions list, always General and never retired.
UPDATE "fathom"."lists" SET "built_in" = 'positions', "visibility" = 'general', "retired" = false
WHERE "id" = coalesce(
  (SELECT "list_id" FROM "fathom"."fields" WHERE "table_name" = 'people' AND "type" = 'choice' AND lower("name") = 'position' ORDER BY "id" LIMIT 1),
  (SELECT "id" FROM "fathom"."lists" WHERE lower("name") = 'positions' ORDER BY "id" LIMIT 1)
);--> statement-breakpoint
INSERT INTO "fathom"."lists" ("name", "description", "built_in")
SELECT 'Positions', '', 'positions'
WHERE NOT EXISTS (SELECT 1 FROM "fathom"."lists" WHERE "built_in" = 'positions');--> statement-breakpoint
-- An empty Positions list, as in a fresh Fathom, starts with positions any organization has.
INSERT INTO "fathom"."list_items" ("list_id", "label", "position")
SELECT "id", "label", "position"
FROM "fathom"."lists",
  (VALUES ('Employee', 1), ('Manager', 2)) AS "choice"("label", "position")
WHERE "built_in" = 'positions'
  AND NOT EXISTS (
    SELECT 1 FROM "fathom"."list_items" WHERE "list_id" = "fathom"."lists"."id"
  );--> statement-breakpoint
DELETE FROM "fathom"."drafts" WHERE "record_type" = 'list' AND "action" = 'deleted'
  AND "record_id" = (SELECT "id"::text FROM "fathom"."lists" WHERE "built_in" = 'positions');--> statement-breakpoint
DELETE FROM "fathom"."unpublished_drafts" WHERE "record_type" = 'list' AND "action" = 'deleted'
  AND "record_id" = (SELECT "id"::text FROM "fathom"."lists" WHERE "built_in" = 'positions');--> statement-breakpoint
UPDATE "fathom"."drafts" SET "fields" = "fields" - 'visibility' - 'retired'
WHERE "record_type" = 'list'
  AND "record_id" = (SELECT "id"::text FROM "fathom"."lists" WHERE "built_in" = 'positions');--> statement-breakpoint
UPDATE "fathom"."unpublished_drafts" SET "fields" = "fields" - 'visibility' - 'retired'
WHERE "record_type" = 'list'
  AND "record_id" = (SELECT "id"::text FROM "fathom"."lists" WHERE "built_in" = 'positions');--> statement-breakpoint
DELETE FROM "fathom"."drafts" WHERE "record_type" = 'list' AND "fields" = '{}'::jsonb
  AND "record_id" = (SELECT "id"::text FROM "fathom"."lists" WHERE "built_in" = 'positions');--> statement-breakpoint
-- The hiring states list, as sensitive as the State column, starting with one choice for each
-- meaning, named apart from any list already called Hiring states.
INSERT INTO "fathom"."lists" ("name", "description", "visibility", "built_in")
SELECT CASE WHEN EXISTS (SELECT 1 FROM "fathom"."lists" WHERE lower("name") = 'hiring states')
    THEN 'Hiring states (built in)' ELSE 'Hiring states' END,
  '', 'confidential', 'hiring-states';--> statement-breakpoint
INSERT INTO "fathom"."list_items" ("list_id", "label", "position", "meaning")
SELECT "id", "label", "position", "meaning"
FROM "fathom"."lists",
  (VALUES ('Request to hire', 1, 'proposed'), ('Approved to hire', 2, 'open')) AS "choice"("label", "position", "meaning")
WHERE "built_in" = 'hiring-states';--> statement-breakpoint
ALTER TABLE "fathom"."lists" ADD CONSTRAINT "lists_built_in_known" CHECK ("fathom"."lists"."built_in" IS NULL OR "fathom"."lists"."built_in" IN ('positions', 'hiring-states'));--> statement-breakpoint
ALTER TABLE "fathom"."lists" ADD CONSTRAINT "lists_positions_general" CHECK ("fathom"."lists"."built_in" IS DISTINCT FROM 'positions' OR "fathom"."lists"."visibility" = 'general');--> statement-breakpoint
ALTER TABLE "fathom"."lists" ADD CONSTRAINT "lists_built_in_kept" CHECK ("fathom"."lists"."built_in" IS NULL OR NOT "fathom"."lists"."retired");--> statement-breakpoint
-- Planned hires keep only the open ones, in the state each maps to, with no drafts.
DELETE FROM "fathom"."drafts" WHERE "record_type" = 'planned-hire';--> statement-breakpoint
DELETE FROM "fathom"."unpublished_drafts" WHERE "record_type" = 'planned-hire';--> statement-breakpoint
DROP TABLE "fathom"."hiring_state_names" CASCADE;--> statement-breakpoint
ALTER TABLE "fathom"."planned_hires" DROP CONSTRAINT "planned_hires_state_known";--> statement-breakpoint
ALTER TABLE "fathom"."planned_hires" DROP CONSTRAINT "planned_hires_cancelled_from_open";--> statement-breakpoint
ALTER TABLE "fathom"."planned_hires" DROP CONSTRAINT "planned_hires_filled_by_person";--> statement-breakpoint
ALTER TABLE "fathom"."planned_hires" DROP CONSTRAINT "planned_hires_cancelled_from_state";--> statement-breakpoint
DELETE FROM "fathom"."planned_hires" WHERE "state" IN ('cancelled', 'filled') OR "filled_by" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "fathom"."planned_hires" ALTER COLUMN "target_date" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "fathom"."planned_hires" ADD COLUMN "requisition" text;--> statement-breakpoint
ALTER TABLE "fathom"."planned_hires" ADD COLUMN "temporary_number" integer;--> statement-breakpoint
ALTER TABLE "fathom"."planned_hires" ADD COLUMN "position_id" uuid;--> statement-breakpoint
ALTER TABLE "fathom"."planned_hires" ADD COLUMN "state_id" uuid;--> statement-breakpoint
UPDATE "fathom"."planned_hires" SET
  "temporary_number" = nextval('"fathom"."planned_hire_temporary_numbers"'),
  "state_id" = (
    SELECT "item"."id" FROM "fathom"."list_items" AS "item"
    JOIN "fathom"."lists" AS "list" ON "list"."id" = "item"."list_id"
    WHERE "list"."built_in" = 'hiring-states'
      AND "item"."meaning" = CASE WHEN "planned_hires"."state" = 'proposed' THEN 'proposed' ELSE 'open' END
  );--> statement-breakpoint
-- Positions, from the Position column's values, the first in the list's order where it holds
-- several.
ALTER TABLE "fathom"."people" ADD COLUMN "position_id" uuid;--> statement-breakpoint
UPDATE "fathom"."people" SET "position_id" = (
  SELECT "value"."choice_id" FROM "fathom"."field_values" AS "value"
  JOIN "fathom"."list_items" AS "item" ON "item"."id" = "value"."choice_id"
  WHERE "value"."person_id" = "people"."id"
    AND "value"."field_id" = (SELECT "id" FROM "fathom"."fields" WHERE "table_name" = 'people' AND "type" = 'choice' AND lower("name") = 'position' ORDER BY "id" LIMIT 1)
  ORDER BY "item"."position", "item"."id" LIMIT 1
);--> statement-breakpoint
UPDATE "fathom"."planned_hires" SET "position_id" = (
  SELECT "value"."choice_id" FROM "fathom"."field_values" AS "value"
  JOIN "fathom"."list_items" AS "item" ON "item"."id" = "value"."choice_id"
  WHERE "value"."planned_hire_id" = "planned_hires"."id"
    AND "value"."field_id" = (SELECT "id" FROM "fathom"."fields" WHERE "table_name" = 'people' AND "type" = 'choice' AND lower("name") = 'position' ORDER BY "id" LIMIT 1)
  ORDER BY "item"."position", "item"."id" LIMIT 1
);--> statement-breakpoint
-- Drafts of people hold the Position column's values as a position: the first live one in the
-- list's order, since only a live choice can be a position.
UPDATE "fathom"."drafts" SET "fields" = ("fields" - ('value:' || "column"."id"::text)) || coalesce(
    (SELECT jsonb_build_object('positionId', "item"."id")
      FROM "fathom"."list_items" AS "item"
      WHERE "item"."id"::text IN (
        SELECT jsonb_array_elements_text(
          CASE WHEN jsonb_typeof("fields" -> ('value:' || "column"."id"::text)) = 'array'
            THEN "fields" -> ('value:' || "column"."id"::text) ELSE '[]'::jsonb END)
      )
      ORDER BY "item"."position", "item"."id" LIMIT 1),
    '{}'::jsonb)
FROM "fathom"."fields" AS "column"
WHERE "column"."id" = (SELECT "id" FROM "fathom"."fields" WHERE "table_name" = 'people' AND "type" = 'choice' AND lower("name") = 'position' ORDER BY "id" LIMIT 1) AND "drafts"."record_type" = 'person' AND "drafts"."fields" ? ('value:' || "column"."id"::text);--> statement-breakpoint
UPDATE "fathom"."unpublished_drafts" SET "fields" = ("fields" - ('value:' || "column"."id"::text)) || coalesce(
    (SELECT jsonb_build_object('positionId', "item"."id")
      FROM "fathom"."list_items" AS "item"
      WHERE "item"."id"::text IN (
        SELECT jsonb_array_elements_text(
          CASE WHEN jsonb_typeof("fields" -> ('value:' || "column"."id"::text)) = 'array'
            THEN "fields" -> ('value:' || "column"."id"::text) ELSE '[]'::jsonb END)
      )
      ORDER BY "item"."position", "item"."id" LIMIT 1),
    '{}'::jsonb)
FROM "fathom"."fields" AS "column"
WHERE "column"."id" = (SELECT "id" FROM "fathom"."fields" WHERE "table_name" = 'people' AND "type" = 'choice' AND lower("name") = 'position' ORDER BY "id" LIMIT 1) AND "unpublished_drafts"."record_type" = 'person' AND "unpublished_drafts"."fields" ? ('value:' || "column"."id"::text);--> statement-breakpoint
INSERT INTO "fathom"."list_items" ("list_id", "label", "position")
SELECT "list"."id", 'Position not set',
  (SELECT coalesce(max("position"), 0) + 1 FROM "fathom"."list_items" WHERE "list_id" = "list"."id")
FROM "fathom"."lists" AS "list"
WHERE "list"."built_in" = 'positions'
  AND NOT EXISTS (SELECT 1 FROM "fathom"."list_items" WHERE "list_id" = "list"."id" AND lower("label") = 'position not set')
  AND (
    EXISTS (SELECT 1 FROM "fathom"."people" WHERE "position_id" IS NULL)
    OR EXISTS (SELECT 1 FROM "fathom"."planned_hires" WHERE "position_id" IS NULL)
    OR EXISTS (SELECT 1 FROM "fathom"."drafts" WHERE "record_type" = 'person' AND "action" = 'created' AND NOT "fields" ? 'positionId')
    OR EXISTS (SELECT 1 FROM "fathom"."unpublished_drafts" WHERE "record_type" = 'person' AND "action" = 'created' AND NOT "fields" ? 'positionId')
  );--> statement-breakpoint
UPDATE "fathom"."people" SET "position_id" = (SELECT "item"."id" FROM "fathom"."list_items" AS "item" JOIN "fathom"."lists" AS "list" ON "list"."id" = "item"."list_id" WHERE "list"."built_in" = 'positions' AND lower("item"."label") = 'position not set')
WHERE "position_id" IS NULL;--> statement-breakpoint
UPDATE "fathom"."planned_hires" SET "position_id" = (SELECT "item"."id" FROM "fathom"."list_items" AS "item" JOIN "fathom"."lists" AS "list" ON "list"."id" = "item"."list_id" WHERE "list"."built_in" = 'positions' AND lower("item"."label") = 'position not set')
WHERE "position_id" IS NULL;--> statement-breakpoint
UPDATE "fathom"."drafts" SET "fields" = "fields" || jsonb_build_object('positionId', (SELECT "item"."id" FROM "fathom"."list_items" AS "item" JOIN "fathom"."lists" AS "list" ON "list"."id" = "item"."list_id" WHERE "list"."built_in" = 'positions' AND lower("item"."label") = 'position not set'))
WHERE "record_type" = 'person' AND "action" = 'created' AND NOT "fields" ? 'positionId';--> statement-breakpoint
UPDATE "fathom"."unpublished_drafts" SET "fields" = "fields" || jsonb_build_object('positionId', (SELECT "item"."id" FROM "fathom"."list_items" AS "item" JOIN "fathom"."lists" AS "list" ON "list"."id" = "item"."list_id" WHERE "list"."built_in" = 'positions' AND lower("item"."label") = 'position not set'))
WHERE "record_type" = 'person' AND "action" = 'created' AND NOT "fields" ? 'positionId';--> statement-breakpoint
-- The Position column gives way to the built-in one, which takes its place in the column order, live
-- and drafted, and in saved views, sorted either way. The column's own drafts and its values go with
-- it.
UPDATE "fathom"."column_orders" SET "keys" = (
  SELECT jsonb_agg(CASE WHEN "key" = (SELECT "id"::text FROM "fathom"."fields" WHERE "table_name" = 'people' AND "type" = 'choice' AND lower("name") = 'position' ORDER BY "id" LIMIT 1)
    THEN 'positionId' ELSE "key" END ORDER BY "at")
  FROM jsonb_array_elements_text("keys") WITH ORDINALITY AS "held"("key", "at")
) WHERE "table_name" = 'people' AND jsonb_array_length("keys") > 0;--> statement-breakpoint
UPDATE "fathom"."drafts" SET "fields" = replace("fields"::text, '"' || "column"."id"::text || '"', '"positionId"')::jsonb
FROM "fathom"."fields" AS "column"
WHERE "column"."id" = (SELECT "id" FROM "fathom"."fields" WHERE "table_name" = 'people' AND "type" = 'choice' AND lower("name") = 'position' ORDER BY "id" LIMIT 1) AND "drafts"."record_type" = 'column-order';--> statement-breakpoint
UPDATE "fathom"."unpublished_drafts" SET "fields" = replace("fields"::text, '"' || "column"."id"::text || '"', '"positionId"')::jsonb
FROM "fathom"."fields" AS "column"
WHERE "column"."id" = (SELECT "id" FROM "fathom"."fields" WHERE "table_name" = 'people' AND "type" = 'choice' AND lower("name") = 'position' ORDER BY "id" LIMIT 1) AND "unpublished_drafts"."record_type" = 'column-order';--> statement-breakpoint
UPDATE "fathom"."saved_views" SET "definition" = replace(replace("definition"::text,
    '"' || "column"."id"::text || '"', '"positionId"'),
    '"-' || "column"."id"::text || '"', '"-positionId"')::jsonb
FROM "fathom"."fields" AS "column"
WHERE "column"."id" = (SELECT "id" FROM "fathom"."fields" WHERE "table_name" = 'people' AND "type" = 'choice' AND lower("name") = 'position' ORDER BY "id" LIMIT 1) AND "saved_views"."table_name" = 'people';--> statement-breakpoint
DELETE FROM "fathom"."drafts" WHERE "record_type" = 'field'
  AND "record_id" = (SELECT "id"::text FROM "fathom"."fields" WHERE "table_name" = 'people' AND "type" = 'choice' AND lower("name") = 'position' ORDER BY "id" LIMIT 1);--> statement-breakpoint
DELETE FROM "fathom"."unpublished_drafts" WHERE "record_type" = 'field'
  AND "record_id" = (SELECT "id"::text FROM "fathom"."fields" WHERE "table_name" = 'people' AND "type" = 'choice' AND lower("name") = 'position' ORDER BY "id" LIMIT 1);--> statement-breakpoint
DELETE FROM "fathom"."fields" WHERE "id" = (SELECT "id" FROM "fathom"."fields" WHERE "table_name" = 'people' AND "type" = 'choice' AND lower("name") = 'position' ORDER BY "id" LIMIT 1);--> statement-breakpoint
-- No Employee ID may look like a temporary ID.
UPDATE "fathom"."people" SET "employee_id" = 'ID-' || "employee_id"
WHERE lower("employee_id") LIKE 'tbd-%';--> statement-breakpoint
ALTER TABLE "fathom"."people" ALTER COLUMN "position_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "fathom"."planned_hires" ALTER COLUMN "position_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "fathom"."planned_hires" ALTER COLUMN "state_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "fathom"."people" ADD CONSTRAINT "people_position_id_list_items_id_fk" FOREIGN KEY ("position_id") REFERENCES "fathom"."list_items"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fathom"."planned_hires" ADD CONSTRAINT "planned_hires_position_id_list_items_id_fk" FOREIGN KEY ("position_id") REFERENCES "fathom"."list_items"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fathom"."planned_hires" ADD CONSTRAINT "planned_hires_state_id_list_items_id_fk" FOREIGN KEY ("state_id") REFERENCES "fathom"."list_items"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "people_position_index" ON "fathom"."people" USING btree ("position_id");--> statement-breakpoint
CREATE UNIQUE INDEX "planned_hires_requisition_index" ON "fathom"."planned_hires" USING btree (lower("requisition"));--> statement-breakpoint
CREATE UNIQUE INDEX "planned_hires_temporary_number_index" ON "fathom"."planned_hires" USING btree ("temporary_number");--> statement-breakpoint
CREATE INDEX "planned_hires_position_index" ON "fathom"."planned_hires" USING btree ("position_id");--> statement-breakpoint
CREATE INDEX "planned_hires_state_index" ON "fathom"."planned_hires" USING btree ("state_id");--> statement-breakpoint
ALTER TABLE "fathom"."planned_hires" DROP COLUMN "title";--> statement-breakpoint
ALTER TABLE "fathom"."planned_hires" DROP COLUMN "state";--> statement-breakpoint
ALTER TABLE "fathom"."planned_hires" DROP COLUMN "cancelled_from";--> statement-breakpoint
ALTER TABLE "fathom"."planned_hires" ADD CONSTRAINT "planned_hires_one_id" CHECK (num_nonnulls("fathom"."planned_hires"."requisition", "fathom"."planned_hires"."temporary_number") = 1);--> statement-breakpoint
ALTER TABLE "fathom"."planned_hires" ADD CONSTRAINT "planned_hires_requisition_not_temporary" CHECK ("fathom"."planned_hires"."requisition" IS NULL OR lower("fathom"."planned_hires"."requisition") NOT LIKE 'tbd-%');
