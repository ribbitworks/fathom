-- SPDX-License-Identifier: Apache-2.0

-- Adds number columns, whose values are a number kept in a typed column of its own in the values
-- table, as ADR 0005 sets out, with a visibility of their own as web link and note columns have. A
-- number removed has no row. No existing data is converted.

ALTER TABLE "fathom"."field_values" DROP CONSTRAINT "field_values_one_kind";--> statement-breakpoint
ALTER TABLE "fathom"."fields" DROP CONSTRAINT "fields_type_settings";--> statement-breakpoint
ALTER TABLE "fathom"."field_values" ADD COLUMN "number" numeric;--> statement-breakpoint
CREATE UNIQUE INDEX "field_values_person_number_index" ON "fathom"."field_values" USING btree ("field_id","person_id") WHERE "fathom"."field_values"."person_id" IS NOT NULL AND "fathom"."field_values"."number" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "field_values_planned_hire_number_index" ON "fathom"."field_values" USING btree ("field_id","planned_hire_id") WHERE "fathom"."field_values"."planned_hire_id" IS NOT NULL AND "fathom"."field_values"."number" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "fathom"."field_values" ADD CONSTRAINT "field_values_one_kind" CHECK (num_nonnulls("fathom"."field_values"."choice_id", "fathom"."field_values"."link_address", "fathom"."field_values"."note", "fathom"."field_values"."number") = 1 AND ("fathom"."field_values"."link_address" IS NULL) = ("fathom"."field_values"."link_text" IS NULL));--> statement-breakpoint
ALTER TABLE "fathom"."fields" ADD CONSTRAINT "fields_type_settings" CHECK (("fathom"."fields"."type" = 'choice' AND "fathom"."fields"."list_id" IS NOT NULL AND "fathom"."fields"."visibility" IS NULL) OR ("fathom"."fields"."type" IN ('link', 'note', 'number') AND "fathom"."fields"."list_id" IS NULL AND "fathom"."fields"."visibility" IS NOT NULL AND NOT "fathom"."fields"."multiple"));