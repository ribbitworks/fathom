-- SPDX-License-Identifier: Apache-2.0

-- Activities, each of one project or one release, with a feature's planning fields, column values
-- and ACTIVITY keys; allocations to a feature or an activity, in place of a project's general
-- feature; and the built-in Feature statuses renamed Statuses, since activities share it.

CREATE TABLE "fathom"."activities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid,
	"release_id" uuid,
	"name" text NOT NULL,
	"status_id" uuid NOT NULL,
	"priority_id" uuid,
	"size_id" uuid,
	"risk_id" uuid,
	"needed_by" text,
	"estimate_hours" numeric(12, 2),
	"feature_team_id" uuid,
	"description" text,
	"note" text,
	"colour" text,
	CONSTRAINT "activities_one_owner" CHECK (num_nonnulls("fathom"."activities"."project_id", "fathom"."activities"."release_id") = 1),
	CONSTRAINT "activities_needed_by_month" CHECK ("fathom"."activities"."needed_by" ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
	CONSTRAINT "activities_note_not_empty" CHECK ("fathom"."activities"."note" <> ''),
	CONSTRAINT "activities_description_not_empty" CHECK ("fathom"."activities"."description" <> ''),
	CONSTRAINT "activities_estimate_not_negative" CHECK ("fathom"."activities"."estimate_hours" >= 0 AND "fathom"."activities"."estimate_hours" <> 'NaN')
);
--> statement-breakpoint
ALTER TABLE "fathom"."features" DROP CONSTRAINT "features_named_or_general";--> statement-breakpoint
ALTER TABLE "fathom"."field_values" DROP CONSTRAINT "field_values_one_owner";--> statement-breakpoint
ALTER TABLE "fathom"."features" DROP CONSTRAINT "features_general_for_project_id_projects_id_fk";
--> statement-breakpoint
DROP INDEX "fathom"."features_general_for_project_index";--> statement-breakpoint
ALTER TABLE "fathom"."allocations" ALTER COLUMN "feature_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "fathom"."features" ALTER COLUMN "name" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "fathom"."allocations" ADD COLUMN "activity_id" uuid;--> statement-breakpoint
ALTER TABLE "fathom"."field_values" ADD COLUMN "activity_id" uuid;--> statement-breakpoint
ALTER TABLE "fathom"."activities" ADD CONSTRAINT "activities_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "fathom"."projects"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fathom"."activities" ADD CONSTRAINT "activities_release_id_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "fathom"."releases"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fathom"."activities" ADD CONSTRAINT "activities_status_id_list_items_id_fk" FOREIGN KEY ("status_id") REFERENCES "fathom"."list_items"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fathom"."activities" ADD CONSTRAINT "activities_priority_id_list_items_id_fk" FOREIGN KEY ("priority_id") REFERENCES "fathom"."list_items"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fathom"."activities" ADD CONSTRAINT "activities_size_id_list_items_id_fk" FOREIGN KEY ("size_id") REFERENCES "fathom"."list_items"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fathom"."activities" ADD CONSTRAINT "activities_risk_id_list_items_id_fk" FOREIGN KEY ("risk_id") REFERENCES "fathom"."list_items"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fathom"."activities" ADD CONSTRAINT "activities_feature_team_id_feature_teams_id_fk" FOREIGN KEY ("feature_team_id") REFERENCES "fathom"."feature_teams"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "activities_project_name_index" ON "fathom"."activities" USING btree ("project_id",lower("name")) WHERE "fathom"."activities"."project_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "activities_release_name_index" ON "fathom"."activities" USING btree ("release_id",lower("name")) WHERE "fathom"."activities"."release_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "activities_feature_team_index" ON "fathom"."activities" USING btree ("feature_team_id");--> statement-breakpoint
CREATE INDEX "activities_status_index" ON "fathom"."activities" USING btree ("status_id");--> statement-breakpoint
ALTER TABLE "fathom"."allocations" ADD CONSTRAINT "allocations_activity_id_activities_id_fk" FOREIGN KEY ("activity_id") REFERENCES "fathom"."activities"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fathom"."field_values" ADD CONSTRAINT "field_values_activity_id_activities_id_fk" FOREIGN KEY ("activity_id") REFERENCES "fathom"."activities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "allocations_person_activity_index" ON "fathom"."allocations" USING btree ("person_id","activity_id");--> statement-breakpoint
CREATE UNIQUE INDEX "allocations_planned_hire_activity_index" ON "fathom"."allocations" USING btree ("planned_hire_id","activity_id");--> statement-breakpoint
CREATE INDEX "allocations_activity_index" ON "fathom"."allocations" USING btree ("activity_id");--> statement-breakpoint
CREATE UNIQUE INDEX "field_values_activity_choice_index" ON "fathom"."field_values" USING btree ("field_id","activity_id","choice_id") WHERE "fathom"."field_values"."activity_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "field_values_activity_link_index" ON "fathom"."field_values" USING btree ("field_id","activity_id") WHERE "fathom"."field_values"."activity_id" IS NOT NULL AND "fathom"."field_values"."link_address" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "field_values_activity_note_index" ON "fathom"."field_values" USING btree ("field_id","activity_id") WHERE "fathom"."field_values"."activity_id" IS NOT NULL AND "fathom"."field_values"."note" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "field_values_activity_number_index" ON "fathom"."field_values" USING btree ("field_id","activity_id") WHERE "fathom"."field_values"."activity_id" IS NOT NULL AND "fathom"."field_values"."number" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "field_values_activity_index" ON "fathom"."field_values" USING btree ("activity_id") WHERE "fathom"."field_values"."activity_id" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "fathom"."features" DROP COLUMN "general_for_project_id";--> statement-breakpoint
ALTER TABLE "fathom"."allocations" ADD CONSTRAINT "allocations_one_work" CHECK (num_nonnulls("fathom"."allocations"."feature_id", "fathom"."allocations"."activity_id") = 1);--> statement-breakpoint
ALTER TABLE "fathom"."field_values" ADD CONSTRAINT "field_values_one_owner" CHECK (num_nonnulls("fathom"."field_values"."person_id", "fathom"."field_values"."planned_hire_id", "fathom"."field_values"."feature_id", "fathom"."field_values"."activity_id") = 1);
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
    WHEN 'activity' THEN 'activity'
  END
$$;
--> statement-breakpoint
CREATE TRIGGER "activities_number" AFTER INSERT ON "fathom"."activities"
FOR EACH ROW EXECUTE FUNCTION "fathom"."number_added_record"('activity');
--> statement-breakpoint
UPDATE "fathom"."lists" SET "name" = 'Statuses'
WHERE "built_in" = 'feature-statuses'
  AND "name" IN ('Feature statuses', 'Feature statuses (built in)')
  AND NOT EXISTS (SELECT 1 FROM "fathom"."lists" WHERE lower("name") = 'statuses');
