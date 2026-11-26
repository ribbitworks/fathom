-- SPDX-License-Identifier: Apache-2.0

-- Feature team memberships and leads that take a planned hire as well as a person: a membership
-- names exactly one, and a lead one or none.

ALTER TABLE "fathom"."feature_team_memberships" ALTER COLUMN "person_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "fathom"."feature_team_leads" ADD COLUMN "lead_planned_hire_id" uuid;--> statement-breakpoint
ALTER TABLE "fathom"."feature_team_memberships" ADD COLUMN "planned_hire_id" uuid;--> statement-breakpoint
ALTER TABLE "fathom"."feature_team_leads" ADD CONSTRAINT "feature_team_leads_lead_planned_hire_id_planned_hires_id_fk" FOREIGN KEY ("lead_planned_hire_id") REFERENCES "fathom"."planned_hires"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fathom"."feature_team_memberships" ADD CONSTRAINT "feature_team_memberships_planned_hire_id_planned_hires_id_fk" FOREIGN KEY ("planned_hire_id") REFERENCES "fathom"."planned_hires"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "feature_team_leads_planned_hire_index" ON "fathom"."feature_team_leads" USING btree ("lead_planned_hire_id");--> statement-breakpoint
CREATE UNIQUE INDEX "feature_team_memberships_planned_hire_from_index" ON "fathom"."feature_team_memberships" USING btree ("team_id","planned_hire_id","from_date");--> statement-breakpoint
CREATE INDEX "feature_team_memberships_planned_hire_index" ON "fathom"."feature_team_memberships" USING btree ("planned_hire_id");--> statement-breakpoint
ALTER TABLE "fathom"."feature_team_leads" ADD CONSTRAINT "feature_team_leads_one_lead" CHECK (num_nonnulls("fathom"."feature_team_leads"."lead_id", "fathom"."feature_team_leads"."lead_planned_hire_id") <= 1);--> statement-breakpoint
ALTER TABLE "fathom"."feature_team_memberships" ADD CONSTRAINT "feature_team_memberships_one_member" CHECK (("fathom"."feature_team_memberships"."person_id" IS NULL) <> ("fathom"."feature_team_memberships"."planned_hire_id" IS NULL));