-- SPDX-License-Identifier: Apache-2.0

-- Features, the planned work on the roadmap, each with a fixed status, an optional target cycle,
-- estimate, feature team, and description, as the Decisions Log sets out, and a project's general
-- feature, which takes its project's name. Projects and proposals gain the features they link to,
-- and a milestone may belong to a feature instead of a project.

CREATE TABLE "fathom"."features" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text,
	"status" text DEFAULT 'possible' NOT NULL,
	"target_stream_id" uuid,
	"target_cycle" date,
	"estimate_hours" numeric(12, 2),
	"feature_team_id" uuid,
	"description" text,
	"general_for_project_id" uuid,
	CONSTRAINT "features_status_known" CHECK ("fathom"."features"."status" IN ('possible', 'planned', 'in-progress', 'done', 'cancelled')),
	CONSTRAINT "features_named_or_general" CHECK (("fathom"."features"."name" IS NULL) = ("fathom"."features"."general_for_project_id" IS NOT NULL)),
	CONSTRAINT "features_target_whole" CHECK (("fathom"."features"."target_stream_id" IS NULL) = ("fathom"."features"."target_cycle" IS NULL)),
	CONSTRAINT "features_estimate_not_negative" CHECK ("fathom"."features"."estimate_hours" >= 0 AND "fathom"."features"."estimate_hours" <> 'NaN'),
	CONSTRAINT "features_description_not_empty" CHECK ("fathom"."features"."description" <> '')
);
--> statement-breakpoint
ALTER TABLE "fathom"."milestones" ALTER COLUMN "project_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "fathom"."milestones" ADD COLUMN "feature_id" uuid;--> statement-breakpoint
ALTER TABLE "fathom"."projects" ADD COLUMN "feature_ids" uuid[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "fathom"."proposals" ADD COLUMN "feature_ids" uuid[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "fathom"."features" ADD CONSTRAINT "features_target_stream_id_release_streams_id_fk" FOREIGN KEY ("target_stream_id") REFERENCES "fathom"."release_streams"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fathom"."features" ADD CONSTRAINT "features_feature_team_id_feature_teams_id_fk" FOREIGN KEY ("feature_team_id") REFERENCES "fathom"."feature_teams"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fathom"."features" ADD CONSTRAINT "features_general_for_project_id_projects_id_fk" FOREIGN KEY ("general_for_project_id") REFERENCES "fathom"."projects"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "features_name_index" ON "fathom"."features" USING btree (lower("name"));--> statement-breakpoint
CREATE UNIQUE INDEX "features_general_for_project_index" ON "fathom"."features" USING btree ("general_for_project_id");--> statement-breakpoint
CREATE INDEX "features_target_index" ON "fathom"."features" USING btree ("target_stream_id","target_cycle");--> statement-breakpoint
CREATE INDEX "features_feature_team_index" ON "fathom"."features" USING btree ("feature_team_id");--> statement-breakpoint
ALTER TABLE "fathom"."milestones" ADD CONSTRAINT "milestones_feature_id_features_id_fk" FOREIGN KEY ("feature_id") REFERENCES "fathom"."features"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "milestones_feature_index" ON "fathom"."milestones" USING btree ("feature_id");--> statement-breakpoint
ALTER TABLE "fathom"."milestones" ADD CONSTRAINT "milestones_one_owner" CHECK (num_nonnulls("fathom"."milestones"."project_id", "fathom"."milestones"."feature_id") = 1);
