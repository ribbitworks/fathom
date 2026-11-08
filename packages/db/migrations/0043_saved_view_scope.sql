-- SPDX-License-Identifier: Apache-2.0

-- Makes each saved view personal or shared, keeping the views already saved shared, and keeps names
-- unique among a table's shared views and among each maker's personal views.

DROP INDEX "fathom"."saved_views_table_name_index";--> statement-breakpoint
ALTER TABLE "fathom"."saved_views" ADD COLUMN "scope" text DEFAULT 'shared' NOT NULL;--> statement-breakpoint
ALTER TABLE "fathom"."saved_views" ALTER COLUMN "scope" DROP DEFAULT;--> statement-breakpoint
CREATE UNIQUE INDEX "saved_views_shared_name_index" ON "fathom"."saved_views" USING btree ("table_name",lower("name")) WHERE "fathom"."saved_views"."scope" = 'shared';--> statement-breakpoint
CREATE UNIQUE INDEX "saved_views_personal_name_index" ON "fathom"."saved_views" USING btree ("table_name","created_by",lower("name")) WHERE "fathom"."saved_views"."scope" = 'personal';