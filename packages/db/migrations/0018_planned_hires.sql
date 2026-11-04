-- SPDX-License-Identifier: Apache-2.0

-- Adds planned hires, kept apart from people, with the names the organization gives the hiring
-- states it renames, values for the columns planned hires share with People, and which of
-- People's columns they have. Each owner's values are indexed apart.

CREATE TABLE "fathom"."hiring_state_names" (
	"state" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	CONSTRAINT "hiring_state_names_state_known" CHECK ("fathom"."hiring_state_names"."state" IN ('proposed', 'approved', 'recruiting', 'offer-accepted', 'filled', 'cancelled'))
);
--> statement-breakpoint
CREATE TABLE "fathom"."planned_hires" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"target_date" date NOT NULL,
	"state" text NOT NULL,
	"cancelled_from" text,
	"manager_id" uuid,
	"filled_by" uuid,
	CONSTRAINT "planned_hires_state_known" CHECK ("fathom"."planned_hires"."state" IN ('proposed', 'approved', 'recruiting', 'offer-accepted', 'filled', 'cancelled')),
	CONSTRAINT "planned_hires_cancelled_from_open" CHECK ("fathom"."planned_hires"."cancelled_from" IS NULL OR "fathom"."planned_hires"."cancelled_from" IN ('proposed', 'approved', 'recruiting', 'offer-accepted')),
	CONSTRAINT "planned_hires_filled_by_person" CHECK (("fathom"."planned_hires"."state" = 'filled') = ("fathom"."planned_hires"."filled_by" IS NOT NULL)),
	CONSTRAINT "planned_hires_cancelled_from_state" CHECK (("fathom"."planned_hires"."state" = 'cancelled') = ("fathom"."planned_hires"."cancelled_from" IS NOT NULL))
);
--> statement-breakpoint
ALTER TABLE "fathom"."field_values" DROP CONSTRAINT "field_values_one_owner";--> statement-breakpoint
DROP INDEX "fathom"."field_values_person_choice_index";--> statement-breakpoint
DROP INDEX "fathom"."field_values_person_link_index";--> statement-breakpoint
DROP INDEX "fathom"."field_values_person_index";--> statement-breakpoint
ALTER TABLE "fathom"."field_values" ADD COLUMN "planned_hire_id" uuid;--> statement-breakpoint
ALTER TABLE "fathom"."fields" ADD COLUMN "on_planned_hires" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "fathom"."planned_hires" ADD CONSTRAINT "planned_hires_manager_id_people_id_fk" FOREIGN KEY ("manager_id") REFERENCES "fathom"."people"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fathom"."planned_hires" ADD CONSTRAINT "planned_hires_filled_by_people_id_fk" FOREIGN KEY ("filled_by") REFERENCES "fathom"."people"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "hiring_state_names_name_index" ON "fathom"."hiring_state_names" USING btree (lower("name"));--> statement-breakpoint
CREATE INDEX "planned_hires_filled_by_index" ON "fathom"."planned_hires" USING btree ("filled_by");--> statement-breakpoint
CREATE INDEX "planned_hires_manager_index" ON "fathom"."planned_hires" USING btree ("manager_id");--> statement-breakpoint
ALTER TABLE "fathom"."field_values" ADD CONSTRAINT "field_values_planned_hire_id_planned_hires_id_fk" FOREIGN KEY ("planned_hire_id") REFERENCES "fathom"."planned_hires"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "field_values_planned_hire_choice_index" ON "fathom"."field_values" USING btree ("field_id","planned_hire_id","choice_id") WHERE "fathom"."field_values"."planned_hire_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "field_values_planned_hire_link_index" ON "fathom"."field_values" USING btree ("field_id","planned_hire_id") WHERE "fathom"."field_values"."planned_hire_id" IS NOT NULL AND "fathom"."field_values"."link_address" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "field_values_planned_hire_index" ON "fathom"."field_values" USING btree ("planned_hire_id") WHERE "fathom"."field_values"."planned_hire_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "field_values_person_choice_index" ON "fathom"."field_values" USING btree ("field_id","person_id","choice_id") WHERE "fathom"."field_values"."person_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "field_values_person_link_index" ON "fathom"."field_values" USING btree ("field_id","person_id") WHERE "fathom"."field_values"."person_id" IS NOT NULL AND "fathom"."field_values"."link_address" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "field_values_person_index" ON "fathom"."field_values" USING btree ("person_id") WHERE "fathom"."field_values"."person_id" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "fathom"."field_values" ADD CONSTRAINT "field_values_one_owner" CHECK (num_nonnulls("fathom"."field_values"."person_id", "fathom"."field_values"."planned_hire_id") = 1);--> statement-breakpoint
ALTER TABLE "fathom"."fields" ADD CONSTRAINT "fields_planned_hires_from_people" CHECK (NOT "fathom"."fields"."on_planned_hires" OR "fathom"."fields"."table_name" = 'people');