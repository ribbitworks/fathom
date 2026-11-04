-- SPDX-License-Identifier: Apache-2.0

-- Adds web link columns, whose values are an address and the text shown for it, kept in their own
-- typed columns of the values table as ADR 0005 sets out, with a visibility of their own since they
-- draw on no list.

ALTER TABLE "fathom"."field_values" ALTER COLUMN "choice_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "fathom"."fields" ALTER COLUMN "list_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "fathom"."field_values" ADD COLUMN "link_address" text;--> statement-breakpoint
ALTER TABLE "fathom"."field_values" ADD COLUMN "link_text" text;--> statement-breakpoint
ALTER TABLE "fathom"."fields" ADD COLUMN "type" text DEFAULT 'choice' NOT NULL;--> statement-breakpoint
ALTER TABLE "fathom"."fields" ADD COLUMN "visibility" text;--> statement-breakpoint
CREATE UNIQUE INDEX "field_values_person_link_index" ON "fathom"."field_values" USING btree ("field_id","person_id") WHERE "fathom"."field_values"."link_address" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "fathom"."field_values" ADD CONSTRAINT "field_values_one_kind" CHECK (num_nonnulls("fathom"."field_values"."choice_id", "fathom"."field_values"."link_address") = 1 AND ("fathom"."field_values"."link_address" IS NULL) = ("fathom"."field_values"."link_text" IS NULL));--> statement-breakpoint
ALTER TABLE "fathom"."fields" ADD CONSTRAINT "fields_type_settings" CHECK (("fathom"."fields"."type" = 'choice' AND "fathom"."fields"."list_id" IS NOT NULL AND "fathom"."fields"."visibility" IS NULL) OR ("fathom"."fields"."type" = 'link' AND "fathom"."fields"."list_id" IS NULL AND "fathom"."fields"."visibility" IS NOT NULL AND NOT "fathom"."fields"."multiple"));