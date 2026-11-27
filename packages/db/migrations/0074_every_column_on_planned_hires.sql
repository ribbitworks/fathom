-- SPDX-License-Identifier: Apache-2.0

-- Offers every People column on planned hires, so a column no longer says whether it is, and drops
-- the unused setting for several lines of text.

ALTER TABLE "fathom"."fields" DROP CONSTRAINT "fields_planned_hires_from_people";--> statement-breakpoint
ALTER TABLE "fathom"."fields" DROP CONSTRAINT "fields_type_settings";--> statement-breakpoint
ALTER TABLE "fathom"."fields" DROP COLUMN "multiline";--> statement-breakpoint
ALTER TABLE "fathom"."fields" DROP COLUMN "on_planned_hires";--> statement-breakpoint
ALTER TABLE "fathom"."fields" ADD CONSTRAINT "fields_type_settings" CHECK ((("fathom"."fields"."linked_table" IS NOT NULL) = ("fathom"."fields"."type" = 'record')) AND ("fathom"."fields"."linked_table" IS NULL OR "fathom"."fields"."linked_table" IN ('people', 'features', 'projects', 'proposals', 'customers', 'releases', 'feature_teams', 'activities')) AND (("fathom"."fields"."type" = 'choice' AND "fathom"."fields"."list_id" IS NOT NULL AND "fathom"."fields"."visibility" IS NULL) OR ("fathom"."fields"."type" = 'record' AND "fathom"."fields"."list_id" IS NULL AND "fathom"."fields"."visibility" IS NOT NULL) OR ("fathom"."fields"."type" IN ('link', 'note', 'number', 'flag', 'text', 'date') AND "fathom"."fields"."list_id" IS NULL AND "fathom"."fields"."visibility" IS NOT NULL AND NOT "fathom"."fields"."multiple")));