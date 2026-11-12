-- SPDX-License-Identifier: Apache-2.0

-- The planning settings for the whole of Fathom, in place of the conversions between units of effort
-- they take in: 8 hours a day, 5 working days a week and 20 a month, as before, with a default focus
-- of 80%, no default buffer, and new starters ramping up through 50% and 75% to full output.

CREATE TABLE "fathom"."planning_settings" (
	"id" text PRIMARY KEY DEFAULT 'planning-settings' NOT NULL,
	"hours_per_day" numeric(3, 1) NOT NULL,
	"days_per_week" integer NOT NULL,
	"days_per_month" integer NOT NULL,
	"focus_percent" integer NOT NULL,
	"buffer_percent" integer NOT NULL,
	"ramp_up_percents" integer[] NOT NULL,
	CONSTRAINT "planning_settings_one_row" CHECK ("fathom"."planning_settings"."id" = 'planning-settings'),
	CONSTRAINT "planning_settings_hours_per_day" CHECK ("fathom"."planning_settings"."hours_per_day" BETWEEN 0.5 AND 24 AND "fathom"."planning_settings"."hours_per_day" * 2 = trunc("fathom"."planning_settings"."hours_per_day" * 2)),
	CONSTRAINT "planning_settings_days_per_week" CHECK ("fathom"."planning_settings"."days_per_week" BETWEEN 1 AND 7),
	CONSTRAINT "planning_settings_days_per_month" CHECK ("fathom"."planning_settings"."days_per_month" BETWEEN 1 AND 31),
	CONSTRAINT "planning_settings_focus_percent" CHECK ("fathom"."planning_settings"."focus_percent" BETWEEN 1 AND 100),
	CONSTRAINT "planning_settings_buffer_percent" CHECK ("fathom"."planning_settings"."buffer_percent" BETWEEN 0 AND 100),
	CONSTRAINT "planning_settings_ramp_up_percents" CHECK (array_ndims("fathom"."planning_settings"."ramp_up_percents") = 1 AND array_position("fathom"."planning_settings"."ramp_up_percents", NULL) IS NULL AND cardinality("fathom"."planning_settings"."ramp_up_percents") <= 12 AND 1 <= ALL("fathom"."planning_settings"."ramp_up_percents") AND 100 >= ALL("fathom"."planning_settings"."ramp_up_percents"))
);
--> statement-breakpoint
DROP TABLE "fathom"."effort_conversions" CASCADE;
--> statement-breakpoint
INSERT INTO "fathom"."planning_settings" ("hours_per_day", "days_per_week", "days_per_month", "focus_percent", "buffer_percent", "ramp_up_percents") VALUES (8, 5, 20, 80, 0, '{50,75}');
