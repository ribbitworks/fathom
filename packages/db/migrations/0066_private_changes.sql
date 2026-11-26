-- SPDX-License-Identifier: Apache-2.0

-- Makes unpublished drafts private changes: renamed, keyed by record and user so several people can
-- each have one, in a set of their user's, with room for the values each change started from,
-- empty for now. Rows already kept go into a set made for each user who has any.

ALTER TABLE "fathom"."unpublished_drafts" RENAME TO "private_changes";--> statement-breakpoint
ALTER SEQUENCE "fathom"."unpublished_drafts_sequence_seq" RENAME TO "private_changes_sequence_seq";--> statement-breakpoint
ALTER TABLE "fathom"."private_changes" RENAME CONSTRAINT "unpublished_drafts_user_id_users_id_fk" TO "private_changes_user_id_users_id_fk";--> statement-breakpoint
ALTER INDEX "fathom"."unpublished_drafts_user_index" RENAME TO "private_changes_user_index";--> statement-breakpoint
ALTER TRIGGER "unpublished_drafts_number" ON "fathom"."private_changes" RENAME TO "private_changes_number";--> statement-breakpoint
ALTER TABLE "fathom"."private_changes" DROP CONSTRAINT "unpublished_drafts_record_type_record_id_pk";--> statement-breakpoint
ALTER TABLE "fathom"."private_changes" ADD CONSTRAINT "private_changes_record_type_record_id_user_id_pk" PRIMARY KEY("record_type","record_id","user_id");--> statement-breakpoint
CREATE TABLE "fathom"."private_sets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"made_at" timestamp with time zone DEFAULT clock_timestamp() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "fathom"."private_sets" ADD CONSTRAINT "private_sets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "fathom"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "private_sets_user_index" ON "fathom"."private_sets" USING btree ("user_id");--> statement-breakpoint
INSERT INTO "fathom"."private_sets" ("user_id") SELECT DISTINCT "user_id" FROM "fathom"."private_changes";--> statement-breakpoint
ALTER TABLE "fathom"."private_changes" ADD COLUMN "set_id" uuid;--> statement-breakpoint
UPDATE "fathom"."private_changes" SET "set_id" = "set"."id" FROM "fathom"."private_sets" AS "set" WHERE "set"."user_id" = "private_changes"."user_id";--> statement-breakpoint
ALTER TABLE "fathom"."private_changes" ALTER COLUMN "set_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "fathom"."private_changes" ADD CONSTRAINT "private_changes_set_id_private_sets_id_fk" FOREIGN KEY ("set_id") REFERENCES "fathom"."private_sets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "private_changes_set_index" ON "fathom"."private_changes" USING btree ("set_id");--> statement-breakpoint
ALTER TABLE "fathom"."private_changes" ADD COLUMN "started_from" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "fathom"."change_sets" RENAME COLUMN "unpublished" TO "private";
--> statement-breakpoint
-- Publishing marks a change set no longer private, the one change the change history allows. The
-- column's grant follows the rename; the check that only it changes names it, so is made again.
CREATE OR REPLACE FUNCTION "fathom"."refuse_change_set_change"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF OLD.private AND NOT NEW.private
      AND (to_jsonb(NEW) - 'private') = (to_jsonb(OLD) - 'private') THEN
      RETURN NEW;
    END IF;
  END IF;
  RAISE EXCEPTION 'The change history can only be added to';
END;
$$;
