-- SPDX-License-Identifier: Apache-2.0

-- Feature teams, as the Decisions Log sets out: each with a name unique ignoring letter case, an
-- optional feature lead, and an optional colour for the feature team chart, and people joining and
-- leaving them from a date, kept as reporting lines are, so past memberships are kept. Engineering
-- Managers propose feature teams, as Roles sets out, so the starting role no longer edits them.

CREATE TABLE "fathom"."feature_team_memberships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" uuid NOT NULL,
	"person_id" uuid NOT NULL,
	"member" boolean NOT NULL,
	"from_date" date NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fathom"."feature_teams" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"lead_id" uuid,
	"colour" text
);
--> statement-breakpoint
ALTER TABLE "fathom"."feature_team_memberships" ADD CONSTRAINT "feature_team_memberships_team_id_feature_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "fathom"."feature_teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fathom"."feature_team_memberships" ADD CONSTRAINT "feature_team_memberships_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "fathom"."people"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fathom"."feature_teams" ADD CONSTRAINT "feature_teams_lead_id_people_id_fk" FOREIGN KEY ("lead_id") REFERENCES "fathom"."people"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "feature_team_memberships_from_index" ON "fathom"."feature_team_memberships" USING btree ("team_id","person_id","from_date");--> statement-breakpoint
CREATE INDEX "feature_team_memberships_person_index" ON "fathom"."feature_team_memberships" USING btree ("person_id");--> statement-breakpoint
CREATE UNIQUE INDEX "feature_teams_name_index" ON "fathom"."feature_teams" USING btree (lower("name"));--> statement-breakpoint
CREATE INDEX "feature_teams_lead_index" ON "fathom"."feature_teams" USING btree ("lead_id");
--> statement-breakpoint
DELETE FROM "fathom"."role_permissions"
WHERE "permission" = 'feature-teams:edit'
  AND "role_id" IN (SELECT "id" FROM "fathom"."roles" WHERE "key" = 'engineering-manager');
