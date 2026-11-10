-- SPDX-License-Identifier: Apache-2.0

-- The conversions between units of effort for the whole of Fathom, starting at 8 hours in a
-- person-day, 5 person-days in a person-week, and 20 in a person-month.

CREATE TABLE "fathom"."effort_conversions" (
	"id" text PRIMARY KEY DEFAULT 'effort-conversions' NOT NULL,
	"hours_per_day" numeric(3, 1) NOT NULL,
	"days_per_week" integer NOT NULL,
	"days_per_month" integer NOT NULL,
	CONSTRAINT "effort_conversions_one_row" CHECK ("fathom"."effort_conversions"."id" = 'effort-conversions'),
	CONSTRAINT "effort_conversions_hours_per_day" CHECK ("fathom"."effort_conversions"."hours_per_day" BETWEEN 0.5 AND 24 AND "fathom"."effort_conversions"."hours_per_day" * 2 = trunc("fathom"."effort_conversions"."hours_per_day" * 2)),
	CONSTRAINT "effort_conversions_days_per_week" CHECK ("fathom"."effort_conversions"."days_per_week" BETWEEN 1 AND 7),
	CONSTRAINT "effort_conversions_days_per_month" CHECK ("fathom"."effort_conversions"."days_per_month" BETWEEN 1 AND 31)
);
--> statement-breakpoint
INSERT INTO "fathom"."effort_conversions" ("hours_per_day", "days_per_week", "days_per_month") VALUES (8, 5, 20);
