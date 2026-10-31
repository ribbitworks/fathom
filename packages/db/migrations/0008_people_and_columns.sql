-- SPDX-License-Identifier: Apache-2.0

-- Adds people, the columns people add to Fathom's tables, starting with columns on people that draw on
-- lists, the values of those columns, as ADR 0005 sets out, and the order of each table's columns.

CREATE TABLE "fathom"."column_orders" (
	"table_name" text PRIMARY KEY NOT NULL,
	"keys" jsonb DEFAULT '[]'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fathom"."field_values" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"field_id" uuid NOT NULL,
	"person_id" uuid,
	"choice_id" uuid NOT NULL,
	CONSTRAINT "field_values_one_owner" CHECK (num_nonnulls("fathom"."field_values"."person_id") = 1)
);
--> statement-breakpoint
CREATE TABLE "fathom"."fields" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"table_name" text NOT NULL,
	"name" text NOT NULL,
	"list_id" uuid NOT NULL,
	"multiple" boolean DEFAULT false NOT NULL,
	"required" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fathom"."people" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"preferred_name" text NOT NULL,
	"employee_id" text NOT NULL,
	"start_date" date,
	"end_date" date,
	CONSTRAINT "people_dates_in_order" CHECK ("fathom"."people"."end_date" IS NULL OR "fathom"."people"."start_date" IS NULL OR "fathom"."people"."end_date" >= "fathom"."people"."start_date")
);
--> statement-breakpoint
ALTER TABLE "fathom"."field_values" ADD CONSTRAINT "field_values_field_id_fields_id_fk" FOREIGN KEY ("field_id") REFERENCES "fathom"."fields"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fathom"."field_values" ADD CONSTRAINT "field_values_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "fathom"."people"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fathom"."field_values" ADD CONSTRAINT "field_values_choice_id_list_items_id_fk" FOREIGN KEY ("choice_id") REFERENCES "fathom"."list_items"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fathom"."fields" ADD CONSTRAINT "fields_list_id_lists_id_fk" FOREIGN KEY ("list_id") REFERENCES "fathom"."lists"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "field_values_person_choice_index" ON "fathom"."field_values" USING btree ("field_id","person_id","choice_id");--> statement-breakpoint
CREATE INDEX "field_values_person_index" ON "fathom"."field_values" USING btree ("person_id");--> statement-breakpoint
CREATE INDEX "field_values_choice_index" ON "fathom"."field_values" USING btree ("choice_id");--> statement-breakpoint
CREATE UNIQUE INDEX "fields_table_name_index" ON "fathom"."fields" USING btree ("table_name",lower("name"));--> statement-breakpoint
CREATE UNIQUE INDEX "people_employee_id_index" ON "fathom"."people" USING btree (lower("employee_id"));
