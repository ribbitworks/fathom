-- SPDX-License-Identifier: Apache-2.0

-- Records when each change set could first be seen by others, so who changed a draft counts a
-- private change from when it was published, not when it was saved, as ADR 0008 sets out. A change
-- set saved as others see it is published when saved; a private one when its maker publishes it.

ALTER TABLE "fathom"."change_sets" ADD COLUMN "published_at" timestamp with time zone;--> statement-breakpoint
-- Every change set not saved privately is published when saved, whoever writes it.
CREATE FUNCTION "fathom"."publish_change_set_when_saved"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NOT NEW.private THEN
    NEW.published_at := NEW.made_at;
  ELSE
    NEW.published_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER "change_sets_published_when_saved"
BEFORE INSERT ON "fathom"."change_sets"
FOR EACH ROW EXECUTE FUNCTION "fathom"."publish_change_set_when_saved"();
--> statement-breakpoint
-- Publishing marks a change set no longer private, with when, the one change the change history
-- allows: the application's role may change only those columns, and only once, from private.
GRANT UPDATE ("published_at") ON "fathom"."change_sets" TO fathom_app;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION "fathom"."refuse_change_set_change"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF OLD.private AND NOT NEW.private
      AND OLD.published_at IS NULL AND NEW.published_at >= OLD.made_at
      AND (to_jsonb(NEW) - 'private' - 'published_at')
        = (to_jsonb(OLD) - 'private' - 'published_at') THEN
      RETURN NEW;
    END IF;
  END IF;
  RAISE EXCEPTION 'The change history can only be added to';
END;
$$;
