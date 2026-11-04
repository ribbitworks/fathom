-- SPDX-License-Identifier: Apache-2.0

-- Adds release streams, the cycle patterns their cycles are worked out from, and their releases,
-- each including the cycles of its stream from its first to its last, named by the days they start.

CREATE TABLE "fathom"."cycle_patterns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"stream_id" uuid NOT NULL,
	"starts_on" date NOT NULL,
	"length" integer NOT NULL,
	"unit" text NOT NULL,
	"naming" text NOT NULL,
	CONSTRAINT "cycle_patterns_length_positive" CHECK ("fathom"."cycle_patterns"."length" > 0),
	CONSTRAINT "cycle_patterns_unit_known" CHECK ("fathom"."cycle_patterns"."unit" IN ('weeks', 'months'))
);
--> statement-breakpoint
CREATE TABLE "fathom"."release_streams" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"retired" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fathom"."releases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"stream_id" uuid NOT NULL,
	"name" text NOT NULL,
	"first_cycle" date NOT NULL,
	"last_cycle" date NOT NULL,
	CONSTRAINT "releases_cycles_in_order" CHECK ("fathom"."releases"."last_cycle" >= "fathom"."releases"."first_cycle")
);
--> statement-breakpoint
ALTER TABLE "fathom"."cycle_patterns" ADD CONSTRAINT "cycle_patterns_stream_id_release_streams_id_fk" FOREIGN KEY ("stream_id") REFERENCES "fathom"."release_streams"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fathom"."releases" ADD CONSTRAINT "releases_stream_id_release_streams_id_fk" FOREIGN KEY ("stream_id") REFERENCES "fathom"."release_streams"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "cycle_patterns_stream_start_index" ON "fathom"."cycle_patterns" USING btree ("stream_id","starts_on");--> statement-breakpoint
CREATE UNIQUE INDEX "release_streams_name_index" ON "fathom"."release_streams" USING btree (lower("name"));--> statement-breakpoint
CREATE UNIQUE INDEX "releases_stream_name_index" ON "fathom"."releases" USING btree ("stream_id",lower("name"));