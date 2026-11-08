-- SPDX-License-Identifier: Apache-2.0

-- A feature team's lead kept from a date, as its members are, so past and planned leads are kept and
-- the org chart can show who led a team on a given day. Leads already recorded are not converted,
-- since development databases are reset instead.

CREATE TABLE "fathom"."feature_team_leads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" uuid NOT NULL,
	"lead_id" uuid,
	"from_date" date NOT NULL
);
--> statement-breakpoint
ALTER TABLE "fathom"."feature_teams" DROP CONSTRAINT "feature_teams_lead_id_people_id_fk";
--> statement-breakpoint
DROP INDEX "fathom"."feature_teams_lead_index";--> statement-breakpoint
ALTER TABLE "fathom"."feature_team_leads" ADD CONSTRAINT "feature_team_leads_team_id_feature_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "fathom"."feature_teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fathom"."feature_team_leads" ADD CONSTRAINT "feature_team_leads_lead_id_people_id_fk" FOREIGN KEY ("lead_id") REFERENCES "fathom"."people"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "feature_team_leads_from_index" ON "fathom"."feature_team_leads" USING btree ("team_id","from_date");--> statement-breakpoint
CREATE INDEX "feature_team_leads_lead_index" ON "fathom"."feature_team_leads" USING btree ("lead_id");--> statement-breakpoint
ALTER TABLE "fathom"."feature_teams" DROP COLUMN "lead_id";