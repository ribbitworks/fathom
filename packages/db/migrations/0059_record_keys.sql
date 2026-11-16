-- SPDX-License-Identifier: Apache-2.0

-- Record keys, such as FEATURE-123: a number for each record of each kind, given when the record is
-- added or drafted to be added, and never reused or changed. Triggers number records however they
-- are added, running as the tables' owner, so the application's role reads keys and counters but
-- cannot write them. Records already kept are numbered by when the change history first names them,
-- then by when they were made, oldest first.

CREATE TABLE "fathom"."record_key_counters" (
	"kind" text PRIMARY KEY NOT NULL,
	"last_number" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fathom"."record_keys" (
	"kind" text NOT NULL,
	"key_number" integer NOT NULL,
	"record_id" text NOT NULL,
	CONSTRAINT "record_keys_kind_key_number_pk" PRIMARY KEY("kind","key_number"),
	CONSTRAINT "record_keys_number_positive" CHECK ("fathom"."record_keys"."key_number" > 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX "record_keys_record_index" ON "fathom"."record_keys" USING btree ("kind","record_id");
--> statement-breakpoint
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON "fathom"."record_keys", "fathom"."record_key_counters" FROM fathom_app;
--> statement-breakpoint
-- The kind a draft's record type numbers, or null for record types without keys, such as choices.
CREATE FUNCTION "fathom"."record_key_kind"("record_type" text) RETURNS text
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
  END
$$;
--> statement-breakpoint
-- Numbers a record unless it has its number already, as a record added once drafted, or put back by
-- undoing its removal, does. The counter's row lock makes records added at once wait for each other.
CREATE FUNCTION "fathom"."number_record"("record_kind" text, "id" text) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "fathom"."record_keys" WHERE "kind" = "record_kind" AND "record_id" = "id"
  ) THEN
    RETURN;
  END IF;
  WITH "counted" AS (
    INSERT INTO "fathom"."record_key_counters" AS "counter" ("kind", "last_number")
    VALUES ("record_kind", 1)
    ON CONFLICT ("kind") DO UPDATE SET "last_number" = "counter"."last_number" + 1
    RETURNING "last_number"
  )
  INSERT INTO "fathom"."record_keys" ("kind", "key_number", "record_id")
  SELECT "record_kind", "last_number", "id" FROM "counted"
  ON CONFLICT ("kind", "record_id") DO NOTHING;
END
$$;
--> statement-breakpoint
CREATE FUNCTION "fathom"."number_added_record"() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, pg_temp AS $$
BEGIN
  PERFORM "fathom"."number_record"(TG_ARGV[0], NEW."id"::text);
  RETURN NULL;
END
$$;
--> statement-breakpoint
CREATE FUNCTION "fathom"."number_drafted_record"() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, pg_temp AS $$
DECLARE
  "record_kind" text := "fathom"."record_key_kind"(NEW."record_type");
BEGIN
  IF NEW."action" = 'created' AND "record_kind" IS NOT NULL THEN
    PERFORM "fathom"."number_record"("record_kind", NEW."record_id");
  END IF;
  RETURN NULL;
END
$$;
--> statement-breakpoint
WITH "added" AS (
  SELECT 'feature' AS "kind", "id"::text AS "record_id", NULL::timestamptz AS "made_at" FROM "fathom"."features"
  UNION ALL SELECT 'project', "id"::text, NULL FROM "fathom"."projects"
  UNION ALL SELECT 'proposal', "id"::text, NULL FROM "fathom"."proposals"
  UNION ALL SELECT 'customer', "id"::text, NULL FROM "fathom"."customers"
  UNION ALL SELECT 'milestone', "id"::text, NULL FROM "fathom"."milestones"
  UNION ALL SELECT 'release', "id"::text, NULL FROM "fathom"."releases"
  UNION ALL SELECT 'schedule', "id"::text, NULL FROM "fathom"."release_streams"
  UNION ALL SELECT 'person', "id"::text, NULL FROM "fathom"."people"
  UNION ALL SELECT 'hire', "id"::text, NULL FROM "fathom"."planned_hires"
  UNION ALL SELECT 'team', "id"::text, NULL FROM "fathom"."feature_teams"
  UNION ALL SELECT 'list', "id"::text, NULL FROM "fathom"."lists"
  UNION ALL SELECT 'column', "id"::text, NULL FROM "fathom"."fields"
  UNION ALL SELECT 'account', "id", "created_at" FROM "fathom"."users"
  UNION ALL SELECT 'role', "id"::text, "created_at" FROM "fathom"."roles"
  UNION ALL
  SELECT "fathom"."record_key_kind"("record_type"), "record_id", NULL
  FROM "fathom"."drafts" WHERE "action" = 'created'
  UNION ALL
  SELECT "fathom"."record_key_kind"("record_type"), "record_id", NULL
  FROM "fathom"."unpublished_drafts" WHERE "action" = 'created'
),
"dated" AS (
  SELECT DISTINCT ON ("kind", "record_id")
    "kind",
    "record_id",
    "made_at",
    (SELECT min("changes"."id") FROM "fathom"."changes" WHERE "changes"."record_id" = "added"."record_id") AS "first_change"
  FROM "added"
  WHERE "kind" IS NOT NULL
)
INSERT INTO "fathom"."record_keys" ("kind", "key_number", "record_id")
SELECT
  "kind",
  row_number() OVER (
    PARTITION BY "kind"
    ORDER BY "first_change" NULLS FIRST, "made_at" NULLS FIRST, "record_id"
  ),
  "record_id"
FROM "dated";
--> statement-breakpoint
INSERT INTO "fathom"."record_key_counters" ("kind", "last_number")
SELECT "kind", max("key_number") FROM "fathom"."record_keys" GROUP BY "kind";
--> statement-breakpoint
CREATE TRIGGER "features_number" AFTER INSERT ON "fathom"."features"
FOR EACH ROW EXECUTE FUNCTION "fathom"."number_added_record"('feature');
--> statement-breakpoint
CREATE TRIGGER "projects_number" AFTER INSERT ON "fathom"."projects"
FOR EACH ROW EXECUTE FUNCTION "fathom"."number_added_record"('project');
--> statement-breakpoint
CREATE TRIGGER "proposals_number" AFTER INSERT ON "fathom"."proposals"
FOR EACH ROW EXECUTE FUNCTION "fathom"."number_added_record"('proposal');
--> statement-breakpoint
CREATE TRIGGER "customers_number" AFTER INSERT ON "fathom"."customers"
FOR EACH ROW EXECUTE FUNCTION "fathom"."number_added_record"('customer');
--> statement-breakpoint
CREATE TRIGGER "milestones_number" AFTER INSERT ON "fathom"."milestones"
FOR EACH ROW EXECUTE FUNCTION "fathom"."number_added_record"('milestone');
--> statement-breakpoint
CREATE TRIGGER "releases_number" AFTER INSERT ON "fathom"."releases"
FOR EACH ROW EXECUTE FUNCTION "fathom"."number_added_record"('release');
--> statement-breakpoint
CREATE TRIGGER "release_streams_number" AFTER INSERT ON "fathom"."release_streams"
FOR EACH ROW EXECUTE FUNCTION "fathom"."number_added_record"('schedule');
--> statement-breakpoint
CREATE TRIGGER "people_number" AFTER INSERT ON "fathom"."people"
FOR EACH ROW EXECUTE FUNCTION "fathom"."number_added_record"('person');
--> statement-breakpoint
CREATE TRIGGER "planned_hires_number" AFTER INSERT ON "fathom"."planned_hires"
FOR EACH ROW EXECUTE FUNCTION "fathom"."number_added_record"('hire');
--> statement-breakpoint
CREATE TRIGGER "feature_teams_number" AFTER INSERT ON "fathom"."feature_teams"
FOR EACH ROW EXECUTE FUNCTION "fathom"."number_added_record"('team');
--> statement-breakpoint
CREATE TRIGGER "lists_number" AFTER INSERT ON "fathom"."lists"
FOR EACH ROW EXECUTE FUNCTION "fathom"."number_added_record"('list');
--> statement-breakpoint
CREATE TRIGGER "fields_number" AFTER INSERT ON "fathom"."fields"
FOR EACH ROW EXECUTE FUNCTION "fathom"."number_added_record"('column');
--> statement-breakpoint
CREATE TRIGGER "users_number" AFTER INSERT ON "fathom"."users"
FOR EACH ROW EXECUTE FUNCTION "fathom"."number_added_record"('account');
--> statement-breakpoint
CREATE TRIGGER "roles_number" AFTER INSERT ON "fathom"."roles"
FOR EACH ROW EXECUTE FUNCTION "fathom"."number_added_record"('role');
--> statement-breakpoint
CREATE TRIGGER "drafts_number" AFTER INSERT OR UPDATE OF "action" ON "fathom"."drafts"
FOR EACH ROW EXECUTE FUNCTION "fathom"."number_drafted_record"();
--> statement-breakpoint
CREATE TRIGGER "unpublished_drafts_number" AFTER INSERT OR UPDATE OF "action" ON "fathom"."unpublished_drafts"
FOR EACH ROW EXECUTE FUNCTION "fathom"."number_drafted_record"();
