CREATE TABLE "fathom"."change_sets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"made_by" text,
	"made_at" timestamp with time zone DEFAULT clock_timestamp() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fathom"."changes" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"change_set_id" uuid NOT NULL,
	"record_type" text NOT NULL,
	"record_id" text NOT NULL,
	"action" text NOT NULL,
	"field" text NOT NULL,
	"tier" text NOT NULL,
	"old_value" jsonb,
	"new_value" jsonb
);
--> statement-breakpoint
CREATE TABLE "fathom"."list_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"list" text NOT NULL,
	"label" text NOT NULL,
	"description" text DEFAULT '' NOT NULL
);
--> statement-breakpoint
ALTER TABLE "fathom"."change_sets" ADD CONSTRAINT "change_sets_made_by_users_id_fk" FOREIGN KEY ("made_by") REFERENCES "fathom"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fathom"."changes" ADD CONSTRAINT "changes_change_set_id_change_sets_id_fk" FOREIGN KEY ("change_set_id") REFERENCES "fathom"."change_sets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "change_sets_made_at_index" ON "fathom"."change_sets" USING btree ("made_at");--> statement-breakpoint
CREATE INDEX "changes_record_index" ON "fathom"."changes" USING btree ("record_type","record_id");--> statement-breakpoint
CREATE INDEX "changes_change_set_index" ON "fathom"."changes" USING btree ("change_set_id");--> statement-breakpoint
CREATE UNIQUE INDEX "list_items_list_label_index" ON "fathom"."list_items" USING btree ("list",lower("label"));
--> statement-breakpoint
-- The change history can only be added to. The application's role may read and add change sets and
-- changes, but not change or delete them.
REVOKE UPDATE, DELETE, TRUNCATE ON "fathom"."change_sets", "fathom"."changes" FROM fathom_app;
--> statement-breakpoint
-- Nor may anyone else, including the role that owns the tables, without first removing these
-- triggers in a reviewed migration.
CREATE FUNCTION "fathom"."refuse_change_history_change"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'The change history can only be added to';
END;
$$;
--> statement-breakpoint
CREATE TRIGGER "change_sets_refuse_change"
BEFORE UPDATE OR DELETE ON "fathom"."change_sets"
FOR EACH ROW EXECUTE FUNCTION "fathom"."refuse_change_history_change"();
--> statement-breakpoint
CREATE TRIGGER "change_sets_refuse_truncate"
BEFORE TRUNCATE ON "fathom"."change_sets"
FOR EACH STATEMENT EXECUTE FUNCTION "fathom"."refuse_change_history_change"();
--> statement-breakpoint
CREATE TRIGGER "changes_refuse_change"
BEFORE UPDATE OR DELETE ON "fathom"."changes"
FOR EACH ROW EXECUTE FUNCTION "fathom"."refuse_change_history_change"();
--> statement-breakpoint
CREATE TRIGGER "changes_refuse_truncate"
BEFORE TRUNCATE ON "fathom"."changes"
FOR EACH STATEMENT EXECUTE FUNCTION "fathom"."refuse_change_history_change"();
