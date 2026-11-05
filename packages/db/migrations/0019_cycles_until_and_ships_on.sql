-- SPDX-License-Identifier: Apache-2.0

-- Gives each release stream the date its cycles are made until, and each release an optional date it
-- ships on, when that is not the end of its last cycle and not before its first cycle starts. The
-- server sets a new stream's date, so the default only fills in the streams already there, two years
-- ahead, and is dropped.

ALTER TABLE "fathom"."release_streams" ADD COLUMN "cycles_until" date DEFAULT (current_date + interval '2 years')::date NOT NULL;--> statement-breakpoint
ALTER TABLE "fathom"."release_streams" ALTER COLUMN "cycles_until" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "fathom"."releases" ADD COLUMN "ships_on" date;--> statement-breakpoint
ALTER TABLE "fathom"."releases" ADD CONSTRAINT "releases_ships_after_first_cycle" CHECK ("fathom"."releases"."ships_on" IS NULL OR "fathom"."releases"."ships_on" >= "fathom"."releases"."first_cycle");