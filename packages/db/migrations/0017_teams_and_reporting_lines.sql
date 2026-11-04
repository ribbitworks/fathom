-- SPDX-License-Identifier: Apache-2.0

-- Adds reporting lines, each in force from its date until the person's next, so past managers are
-- kept, and team names, kept with each named team's manager.

CREATE TABLE "fathom"."reporting_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"person_id" uuid NOT NULL,
	"manager_id" uuid,
	"from_date" date NOT NULL,
	CONSTRAINT "reporting_lines_not_self" CHECK ("fathom"."reporting_lines"."manager_id" IS NULL OR "fathom"."reporting_lines"."manager_id" <> "fathom"."reporting_lines"."person_id")
);
--> statement-breakpoint
CREATE TABLE "fathom"."teams" (
	"manager_id" uuid PRIMARY KEY NOT NULL,
	"name" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "fathom"."reporting_lines" ADD CONSTRAINT "reporting_lines_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "fathom"."people"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fathom"."reporting_lines" ADD CONSTRAINT "reporting_lines_manager_id_people_id_fk" FOREIGN KEY ("manager_id") REFERENCES "fathom"."people"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fathom"."teams" ADD CONSTRAINT "teams_manager_id_people_id_fk" FOREIGN KEY ("manager_id") REFERENCES "fathom"."people"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "reporting_lines_person_from_index" ON "fathom"."reporting_lines" USING btree ("person_id","from_date");--> statement-breakpoint
CREATE INDEX "reporting_lines_manager_index" ON "fathom"."reporting_lines" USING btree ("manager_id");--> statement-breakpoint
CREATE UNIQUE INDEX "teams_name_index" ON "fathom"."teams" USING btree (lower("name"));