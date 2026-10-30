CREATE TABLE "fathom"."access_history" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"actor_id" text,
	"action" text NOT NULL,
	"subject_id" text,
	"details" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE INDEX "access_history_occurred_at_index" ON "fathom"."access_history" USING btree ("occurred_at");--> statement-breakpoint
-- The access history can only be added to. The application's role may read and add entries, but
-- not change or delete them.
REVOKE UPDATE, DELETE, TRUNCATE ON "fathom"."access_history" FROM fathom_app;
--> statement-breakpoint
-- Nor may anyone else, including the role that owns the table, without first removing these
-- triggers in a reviewed migration.
CREATE FUNCTION "fathom"."refuse_access_history_change"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'The access history can only be added to';
END;
$$;
--> statement-breakpoint
CREATE TRIGGER "access_history_refuse_change"
BEFORE UPDATE OR DELETE ON "fathom"."access_history"
FOR EACH ROW EXECUTE FUNCTION "fathom"."refuse_access_history_change"();
--> statement-breakpoint
CREATE TRIGGER "access_history_refuse_truncate"
BEFORE TRUNCATE ON "fathom"."access_history"
FOR EACH STATEMENT EXECUTE FUNCTION "fathom"."refuse_access_history_change"();
