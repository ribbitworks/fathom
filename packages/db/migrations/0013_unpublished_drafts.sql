-- SPDX-License-Identifier: Apache-2.0

-- Adds unpublished drafts, each user's changes to drafts that only they see until they publish
-- them, and marks change sets that hold such changes, which only their maker sees until published.

CREATE TABLE "fathom"."unpublished_drafts" (
	"record_type" text NOT NULL,
	"record_id" text NOT NULL,
	"user_id" text NOT NULL,
	"action" text NOT NULL,
	"fields" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"sequence" bigint GENERATED ALWAYS AS IDENTITY (sequence name "fathom"."unpublished_drafts_sequence_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	CONSTRAINT "unpublished_drafts_record_type_record_id_pk" PRIMARY KEY("record_type","record_id")
);
--> statement-breakpoint
ALTER TABLE "fathom"."change_sets" ADD COLUMN "unpublished" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "fathom"."unpublished_drafts" ADD CONSTRAINT "unpublished_drafts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "fathom"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "unpublished_drafts_user_index" ON "fathom"."unpublished_drafts" USING btree ("user_id");
--> statement-breakpoint
-- Publishing marks a change set published, the one change the change history allows: the
-- application's role may change only that column of a change set, and only from unpublished to
-- published, so the history can still only be added to.
GRANT UPDATE ("unpublished") ON "fathom"."change_sets" TO fathom_app;
--> statement-breakpoint
CREATE FUNCTION "fathom"."refuse_change_set_change"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF OLD.unpublished AND NOT NEW.unpublished
      AND (to_jsonb(NEW) - 'unpublished') = (to_jsonb(OLD) - 'unpublished') THEN
      RETURN NEW;
    END IF;
  END IF;
  RAISE EXCEPTION 'The change history can only be added to';
END;
$$;
--> statement-breakpoint
DROP TRIGGER "change_sets_refuse_change" ON "fathom"."change_sets";
--> statement-breakpoint
CREATE TRIGGER "change_sets_refuse_change"
BEFORE UPDATE OR DELETE ON "fathom"."change_sets"
FOR EACH ROW EXECUTE FUNCTION "fathom"."refuse_change_set_change"();
