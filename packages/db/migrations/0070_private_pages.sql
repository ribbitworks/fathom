-- SPDX-License-Identifier: Apache-2.0

-- A person's own pages, each a table of free rows private to its maker: the pages and their rows,
-- the page a private column is on, the row that owns a value, and the random keys that name pages
-- and rows. Make private pages is given to the starting roles that make them.

CREATE TABLE "fathom"."private_pages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"position" integer NOT NULL,
	"first_field_id" uuid NOT NULL,
	"made_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fathom"."private_rows" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"page_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"made_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fathom"."random_keys" (
	"kind" text NOT NULL,
	"code" text NOT NULL,
	"record_id" uuid NOT NULL,
	CONSTRAINT "random_keys_kind_code_pk" PRIMARY KEY("kind","code"),
	CONSTRAINT "random_keys_kind" CHECK ("fathom"."random_keys"."kind" IN ('page', 'row')),
	CONSTRAINT "random_keys_code" CHECK ("fathom"."random_keys"."code" ~ '^[2-9ABCDEFGHJKMNPQRSTVWXYZ]{4,5}$')
);
--> statement-breakpoint
ALTER TABLE "fathom"."field_values" DROP CONSTRAINT "field_values_one_owner";--> statement-breakpoint
DROP INDEX "fathom"."fields_table_name_index";--> statement-breakpoint
ALTER TABLE "fathom"."field_values" ADD COLUMN "private_row_id" uuid;--> statement-breakpoint
ALTER TABLE "fathom"."fields" ADD COLUMN "page_id" uuid;--> statement-breakpoint
ALTER TABLE "fathom"."private_pages" ADD CONSTRAINT "private_pages_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "fathom"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fathom"."private_pages" ADD CONSTRAINT "private_pages_first_field_id_fields_id_fk" FOREIGN KEY ("first_field_id") REFERENCES "fathom"."fields"("id") ON DELETE no action ON UPDATE no action DEFERRABLE INITIALLY DEFERRED;--> statement-breakpoint
ALTER TABLE "fathom"."private_rows" ADD CONSTRAINT "private_rows_page_id_private_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "fathom"."private_pages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "private_pages_name_index" ON "fathom"."private_pages" USING btree ("user_id",lower("name"));--> statement-breakpoint
CREATE INDEX "private_rows_page_index" ON "fathom"."private_rows" USING btree ("page_id");--> statement-breakpoint
CREATE UNIQUE INDEX "random_keys_record_index" ON "fathom"."random_keys" USING btree ("kind","record_id");--> statement-breakpoint
ALTER TABLE "fathom"."field_values" ADD CONSTRAINT "field_values_private_row_id_private_rows_id_fk" FOREIGN KEY ("private_row_id") REFERENCES "fathom"."private_rows"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fathom"."fields" ADD CONSTRAINT "fields_page_id_private_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "fathom"."private_pages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "field_values_private_row_choice_index" ON "fathom"."field_values" USING btree ("field_id","private_row_id","choice_id") WHERE "fathom"."field_values"."private_row_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "field_values_private_row_linked_person_index" ON "fathom"."field_values" USING btree ("field_id","private_row_id","linked_person_id") WHERE "fathom"."field_values"."private_row_id" IS NOT NULL AND "fathom"."field_values"."linked_person_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "field_values_private_row_linked_planned_hire_index" ON "fathom"."field_values" USING btree ("field_id","private_row_id","linked_planned_hire_id") WHERE "fathom"."field_values"."private_row_id" IS NOT NULL AND "fathom"."field_values"."linked_planned_hire_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "field_values_private_row_linked_feature_index" ON "fathom"."field_values" USING btree ("field_id","private_row_id","linked_feature_id") WHERE "fathom"."field_values"."private_row_id" IS NOT NULL AND "fathom"."field_values"."linked_feature_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "field_values_private_row_linked_project_index" ON "fathom"."field_values" USING btree ("field_id","private_row_id","linked_project_id") WHERE "fathom"."field_values"."private_row_id" IS NOT NULL AND "fathom"."field_values"."linked_project_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "field_values_private_row_linked_proposal_index" ON "fathom"."field_values" USING btree ("field_id","private_row_id","linked_proposal_id") WHERE "fathom"."field_values"."private_row_id" IS NOT NULL AND "fathom"."field_values"."linked_proposal_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "field_values_private_row_linked_customer_index" ON "fathom"."field_values" USING btree ("field_id","private_row_id","linked_customer_id") WHERE "fathom"."field_values"."private_row_id" IS NOT NULL AND "fathom"."field_values"."linked_customer_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "field_values_private_row_linked_release_index" ON "fathom"."field_values" USING btree ("field_id","private_row_id","linked_release_id") WHERE "fathom"."field_values"."private_row_id" IS NOT NULL AND "fathom"."field_values"."linked_release_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "field_values_private_row_linked_feature_team_index" ON "fathom"."field_values" USING btree ("field_id","private_row_id","linked_feature_team_id") WHERE "fathom"."field_values"."private_row_id" IS NOT NULL AND "fathom"."field_values"."linked_feature_team_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "field_values_private_row_linked_activity_index" ON "fathom"."field_values" USING btree ("field_id","private_row_id","linked_activity_id") WHERE "fathom"."field_values"."private_row_id" IS NOT NULL AND "fathom"."field_values"."linked_activity_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "field_values_private_row_link_index" ON "fathom"."field_values" USING btree ("field_id","private_row_id") WHERE "fathom"."field_values"."private_row_id" IS NOT NULL AND "fathom"."field_values"."link_address" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "field_values_private_row_note_index" ON "fathom"."field_values" USING btree ("field_id","private_row_id") WHERE "fathom"."field_values"."private_row_id" IS NOT NULL AND "fathom"."field_values"."note" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "field_values_private_row_number_index" ON "fathom"."field_values" USING btree ("field_id","private_row_id") WHERE "fathom"."field_values"."private_row_id" IS NOT NULL AND "fathom"."field_values"."number" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "field_values_private_row_flag_index" ON "fathom"."field_values" USING btree ("field_id","private_row_id") WHERE "fathom"."field_values"."private_row_id" IS NOT NULL AND "fathom"."field_values"."flag" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "field_values_private_row_text_index" ON "fathom"."field_values" USING btree ("field_id","private_row_id") WHERE "fathom"."field_values"."private_row_id" IS NOT NULL AND "fathom"."field_values"."text" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "field_values_private_row_date_index" ON "fathom"."field_values" USING btree ("field_id","private_row_id") WHERE "fathom"."field_values"."private_row_id" IS NOT NULL AND "fathom"."field_values"."date" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "field_values_private_row_index" ON "fathom"."field_values" USING btree ("private_row_id") WHERE "fathom"."field_values"."private_row_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "fields_page_name_index" ON "fathom"."fields" USING btree ("page_id",lower("name")) WHERE "fathom"."fields"."page_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "fields_table_name_index" ON "fathom"."fields" USING btree ("table_name",lower("name")) WHERE "fathom"."fields"."page_id" IS NULL;--> statement-breakpoint
ALTER TABLE "fathom"."field_values" ADD CONSTRAINT "field_values_one_owner" CHECK (num_nonnulls("fathom"."field_values"."person_id", "fathom"."field_values"."planned_hire_id", "fathom"."field_values"."feature_id", "fathom"."field_values"."activity_id", "fathom"."field_values"."private_row_id") = 1);--> statement-breakpoint
ALTER TABLE "fathom"."fields" ADD CONSTRAINT "fields_page_private" CHECK (("fathom"."fields"."page_id" IS NOT NULL) = ("fathom"."fields"."table_name" = 'private'));
--> statement-breakpoint
-- A private column has no COLUMN key: nobody but its page's maker may find it, and a number would
-- tell others how many columns there are.
DROP TRIGGER "fields_number" ON "fathom"."fields";
--> statement-breakpoint
CREATE TRIGGER "fields_number" AFTER INSERT ON "fathom"."fields"
FOR EACH ROW WHEN (NEW."table_name" <> 'private')
EXECUTE FUNCTION "fathom"."number_added_record"('column');
--> statement-breakpoint
-- Only the function below writes random keys, so the application's role can't change one.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON "fathom"."random_keys" FROM fathom_app;
--> statement-breakpoint
-- The random key of a page or a row, made once and kept: four characters from the thirty that
-- can't be taken for one another, or five once a tenth of a kind's four-character keys are used,
-- so a guess rarely finds one. It tries again on a code already given, and answers a second call
-- for the same record, made at the same moment, with the key the first made.
CREATE FUNCTION "fathom"."random_key"("key_kind" text, "keyed_record" uuid) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, pg_temp AS $$
DECLARE
  "alphabet" constant text := '23456789ABCDEFGHJKMNPQRSTVWXYZ';
  "letters" constant integer := length("alphabet");
  "places" integer;
  "random" bytea;
  "made" text;
BEGIN
  LOOP
    SELECT "code" INTO "made" FROM "fathom"."random_keys"
    WHERE "kind" = "key_kind" AND "record_id" = "keyed_record";
    IF "made" IS NOT NULL THEN
      RETURN "made";
    END IF;
    -- Once a kind has widened it stays wide, so its four-character keys need counting no more.
    IF EXISTS (
      SELECT FROM "fathom"."random_keys" WHERE "kind" = "key_kind" AND length("code") = 5
    ) OR (
      SELECT count(*) FROM "fathom"."random_keys" WHERE "kind" = "key_kind" AND length("code") = 4
    ) >= power("letters", 4) / 10 THEN
      "places" := 5;
    ELSE
      "places" := 4;
    END IF;
    "random" := uuid_send(gen_random_uuid());
    "made" := '';
    FOR "place" IN 0 .. "places" - 1 LOOP
      "made" := "made" || substr("alphabet", get_byte("random", "place") % "letters" + 1, 1);
    END LOOP;
    INSERT INTO "fathom"."random_keys" ("kind", "code", "record_id")
    VALUES ("key_kind", "made", "keyed_record")
    ON CONFLICT DO NOTHING;
    IF FOUND THEN
      RETURN "made";
    END IF;
  END LOOP;
END
$$;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION "fathom"."random_key"(text, uuid) TO fathom_app;
--> statement-breakpoint
INSERT INTO "fathom"."role_permissions" ("role_id", "permission")
SELECT "id", 'private-pages:make' FROM "fathom"."roles"
WHERE "key" IN (
  'product-manager',
  'feature-lead',
  'project-manager',
  'engineering-manager',
  'engineering-director',
  'workforce-administrator'
)
ON CONFLICT DO NOTHING;
