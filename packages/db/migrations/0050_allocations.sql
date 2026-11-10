-- SPDX-License-Identifier: Apache-2.0

-- Allocations, as the Decisions Log sets out: one person or planned hire on one feature, holding the
-- percentage of a month that takes effect from each month it changes, until the next. Approving
-- them is an area of its own, given to the starting roles that approve drafts of other areas.

CREATE TABLE "fathom"."allocations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"person_id" uuid,
	"planned_hire_id" uuid,
	"feature_id" uuid NOT NULL,
	"months" jsonb NOT NULL,
	CONSTRAINT "allocations_one_assignee" CHECK (("fathom"."allocations"."person_id" IS NULL) <> ("fathom"."allocations"."planned_hire_id" IS NULL)),
	CONSTRAINT "allocations_months_object" CHECK (jsonb_typeof("fathom"."allocations"."months") = 'object')
);
--> statement-breakpoint
ALTER TABLE "fathom"."allocations" ADD CONSTRAINT "allocations_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "fathom"."people"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fathom"."allocations" ADD CONSTRAINT "allocations_planned_hire_id_planned_hires_id_fk" FOREIGN KEY ("planned_hire_id") REFERENCES "fathom"."planned_hires"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fathom"."allocations" ADD CONSTRAINT "allocations_feature_id_features_id_fk" FOREIGN KEY ("feature_id") REFERENCES "fathom"."features"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "allocations_person_feature_index" ON "fathom"."allocations" USING btree ("person_id","feature_id");--> statement-breakpoint
CREATE UNIQUE INDEX "allocations_planned_hire_feature_index" ON "fathom"."allocations" USING btree ("planned_hire_id","feature_id");--> statement-breakpoint
CREATE INDEX "allocations_feature_index" ON "fathom"."allocations" USING btree ("feature_id");
--> statement-breakpoint
INSERT INTO "fathom"."role_permissions" ("role_id", "permission")
SELECT "id", 'allocations:approve' FROM "fathom"."roles"
WHERE "key" IN ('project-manager', 'engineering-director')
ON CONFLICT DO NOTHING;
