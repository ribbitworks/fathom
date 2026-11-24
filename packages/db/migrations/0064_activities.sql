-- SPDX-License-Identifier: Apache-2.0

-- Activities: work a project or a release needs that isn't a feature, each of one project or one
-- release, numbered as ACTIVITY keys. Allocations name a feature or an activity. A project's general
-- feature goes, since allocating to a project now means allocating to one of its activities, and a
-- feature's name is then required. Databases are reset rather than converted before the first
-- release, so no general feature is left to remove.

CREATE TABLE "fathom"."activities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid,
	"release_id" uuid,
	"name" text NOT NULL,
	"description" text,
	"note" text,
	"estimate_hours" numeric(12, 2),
	"colour" text,
	CONSTRAINT "activities_one_owner" CHECK (num_nonnulls("fathom"."activities"."project_id", "fathom"."activities"."release_id") = 1),
	CONSTRAINT "activities_note_not_empty" CHECK ("fathom"."activities"."note" <> ''),
	CONSTRAINT "activities_description_not_empty" CHECK ("fathom"."activities"."description" <> ''),
	CONSTRAINT "activities_estimate_not_negative" CHECK ("fathom"."activities"."estimate_hours" >= 0 AND "fathom"."activities"."estimate_hours" <> 'NaN')
);
--> statement-breakpoint
ALTER TABLE "fathom"."features" DROP CONSTRAINT "features_named_or_general";--> statement-breakpoint
ALTER TABLE "fathom"."features" DROP CONSTRAINT "features_general_for_project_id_projects_id_fk";
--> statement-breakpoint
DROP INDEX "fathom"."features_general_for_project_index";--> statement-breakpoint
ALTER TABLE "fathom"."allocations" ALTER COLUMN "feature_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "fathom"."features" ALTER COLUMN "name" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "fathom"."allocations" ADD COLUMN "activity_id" uuid;--> statement-breakpoint
ALTER TABLE "fathom"."activities" ADD CONSTRAINT "activities_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "fathom"."projects"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fathom"."activities" ADD CONSTRAINT "activities_release_id_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "fathom"."releases"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "activities_project_name_index" ON "fathom"."activities" USING btree ("project_id",lower("name")) WHERE "fathom"."activities"."project_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "activities_release_name_index" ON "fathom"."activities" USING btree ("release_id",lower("name")) WHERE "fathom"."activities"."release_id" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "fathom"."allocations" ADD CONSTRAINT "allocations_activity_id_activities_id_fk" FOREIGN KEY ("activity_id") REFERENCES "fathom"."activities"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "allocations_person_activity_index" ON "fathom"."allocations" USING btree ("person_id","activity_id");--> statement-breakpoint
CREATE UNIQUE INDEX "allocations_planned_hire_activity_index" ON "fathom"."allocations" USING btree ("planned_hire_id","activity_id");--> statement-breakpoint
CREATE INDEX "allocations_activity_index" ON "fathom"."allocations" USING btree ("activity_id");--> statement-breakpoint
ALTER TABLE "fathom"."features" DROP COLUMN "general_for_project_id";--> statement-breakpoint
ALTER TABLE "fathom"."allocations" ADD CONSTRAINT "allocations_one_work" CHECK (num_nonnulls("fathom"."allocations"."feature_id", "fathom"."allocations"."activity_id") = 1);
--> statement-breakpoint
CREATE OR REPLACE FUNCTION "fathom"."record_key_kind"("record_type" text) RETURNS text
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE "record_type"
    WHEN 'feature' THEN 'feature'
    WHEN 'project' THEN 'project'
    WHEN 'proposal' THEN 'proposal'
    WHEN 'customer' THEN 'customer'
    WHEN 'milestone' THEN 'milestone'
    WHEN 'release' THEN 'release'
    WHEN 'release-stream' THEN 'schedule'
    WHEN 'person' THEN 'person'
    WHEN 'planned-hire' THEN 'hire'
    WHEN 'feature-team' THEN 'team'
    WHEN 'list' THEN 'list'
    WHEN 'field' THEN 'column'
    WHEN 'project-activity' THEN 'activity'
    WHEN 'release-activity' THEN 'activity'
  END
$$;
--> statement-breakpoint
CREATE TRIGGER "activities_number" AFTER INSERT ON "fathom"."activities"
FOR EACH ROW EXECUTE FUNCTION "fathom"."number_added_record"('activity');
