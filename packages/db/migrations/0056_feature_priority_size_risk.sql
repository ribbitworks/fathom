-- SPDX-License-Identifier: Apache-2.0

-- Features gain an optional priority, size and risk, each a choice of a new built-in list:
-- priorities Critical, High, Medium and Low; sizes XS to XL, each weighed against S; and risks Low,
-- Medium and High. A list Fathom builds in is renamed with "(built in)" when one of that name exists.

ALTER TABLE "fathom"."lists" DROP CONSTRAINT "lists_built_in_known";--> statement-breakpoint
ALTER TABLE "fathom"."features" ADD COLUMN "priority_id" uuid;--> statement-breakpoint
ALTER TABLE "fathom"."features" ADD COLUMN "size_id" uuid;--> statement-breakpoint
ALTER TABLE "fathom"."features" ADD COLUMN "risk_id" uuid;--> statement-breakpoint
ALTER TABLE "fathom"."list_items" ADD COLUMN "weight" numeric(6, 2);--> statement-breakpoint
ALTER TABLE "fathom"."features" ADD CONSTRAINT "features_priority_id_list_items_id_fk" FOREIGN KEY ("priority_id") REFERENCES "fathom"."list_items"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fathom"."features" ADD CONSTRAINT "features_size_id_list_items_id_fk" FOREIGN KEY ("size_id") REFERENCES "fathom"."list_items"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fathom"."features" ADD CONSTRAINT "features_risk_id_list_items_id_fk" FOREIGN KEY ("risk_id") REFERENCES "fathom"."list_items"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fathom"."list_items" ADD CONSTRAINT "list_items_weight_positive" CHECK ("fathom"."list_items"."weight" > 0 AND "fathom"."list_items"."weight" <> 'NaN');--> statement-breakpoint
ALTER TABLE "fathom"."lists" ADD CONSTRAINT "lists_built_in_known" CHECK ("fathom"."lists"."built_in" IS NULL OR "fathom"."lists"."built_in" IN ('positions', 'hiring-states', 'proposal-statuses', 'feature-statuses', 'feature-priorities', 'feature-sizes', 'feature-risks'));--> statement-breakpoint
INSERT INTO "fathom"."lists" ("name", "description", "visibility", "built_in")
SELECT CASE WHEN EXISTS (SELECT 1 FROM "fathom"."lists" WHERE lower("name") = 'feature priorities')
    THEN 'Feature priorities (built in)' ELSE 'Feature priorities' END,
  '', 'general', 'feature-priorities';--> statement-breakpoint
INSERT INTO "fathom"."list_items" ("list_id", "label", "position", "weight")
SELECT "id", "label", "position", "weight"
FROM "fathom"."lists",
  (VALUES ('Critical', 1, NULL::numeric), ('High', 2, NULL), ('Medium', 3, NULL), ('Low', 4, NULL)) AS "choice"("label", "position", "weight")
WHERE "built_in" = 'feature-priorities';--> statement-breakpoint
INSERT INTO "fathom"."lists" ("name", "description", "visibility", "built_in")
SELECT CASE WHEN EXISTS (SELECT 1 FROM "fathom"."lists" WHERE lower("name") = 'feature sizes')
    THEN 'Feature sizes (built in)' ELSE 'Feature sizes' END,
  '', 'general', 'feature-sizes';--> statement-breakpoint
INSERT INTO "fathom"."list_items" ("list_id", "label", "position", "weight")
SELECT "id", "label", "position", "weight"
FROM "fathom"."lists",
  (VALUES ('XS', 1, 0.5::numeric), ('S', 2, 1), ('M', 3, 2), ('L', 4, 3), ('XL', 5, 4)) AS "choice"("label", "position", "weight")
WHERE "built_in" = 'feature-sizes';--> statement-breakpoint
INSERT INTO "fathom"."lists" ("name", "description", "visibility", "built_in")
SELECT CASE WHEN EXISTS (SELECT 1 FROM "fathom"."lists" WHERE lower("name") = 'feature risks')
    THEN 'Feature risks (built in)' ELSE 'Feature risks' END,
  '', 'general', 'feature-risks';--> statement-breakpoint
INSERT INTO "fathom"."list_items" ("list_id", "label", "position", "weight")
SELECT "id", "label", "position", "weight"
FROM "fathom"."lists",
  (VALUES ('Low', 1, NULL::numeric), ('Medium', 2, NULL), ('High', 3, NULL)) AS "choice"("label", "position", "weight")
WHERE "built_in" = 'feature-risks';
