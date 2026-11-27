-- SPDX-License-Identifier: Apache-2.0

-- The planning settings name the working days, Monday being 0, and the day a week starts on, in
-- place of a count of working days a week.

ALTER TABLE "fathom"."planning_settings" DROP CONSTRAINT "planning_settings_days_per_week";--> statement-breakpoint
ALTER TABLE "fathom"."planning_settings" ADD COLUMN "working_days" integer[] DEFAULT '{0,1,2,3,4}' NOT NULL;--> statement-breakpoint
ALTER TABLE "fathom"."planning_settings" ADD COLUMN "week_starts_on" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "fathom"."planning_settings" DROP COLUMN "days_per_week";--> statement-breakpoint
ALTER TABLE "fathom"."planning_settings" ADD CONSTRAINT "planning_settings_working_days" CHECK (array_ndims("fathom"."planning_settings"."working_days") = 1 AND array_position("fathom"."planning_settings"."working_days", NULL) IS NULL AND cardinality("fathom"."planning_settings"."working_days") BETWEEN 1 AND 7 AND 0 <= ALL("fathom"."planning_settings"."working_days") AND 6 >= ALL("fathom"."planning_settings"."working_days"));--> statement-breakpoint
ALTER TABLE "fathom"."planning_settings" ADD CONSTRAINT "planning_settings_week_starts_on" CHECK ("fathom"."planning_settings"."week_starts_on" BETWEEN 0 AND 6);
