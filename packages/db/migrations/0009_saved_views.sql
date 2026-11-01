-- SPDX-License-Identifier: Apache-2.0

-- Adds saved views: a table's search, filters, and sort, saved under a name and shared with everyone
-- who sees the table.

CREATE TABLE "fathom"."saved_views" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"table_name" text NOT NULL,
	"name" text NOT NULL,
	"definition" jsonb NOT NULL,
	"created_by" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "fathom"."saved_views" ADD CONSTRAINT "saved_views_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "fathom"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "saved_views_table_name_index" ON "fathom"."saved_views" USING btree ("table_name",lower("name"));
