-- SPDX-License-Identifier: Apache-2.0

-- Adds draft rows, the changes waiting for approval, and marks in the change history for changes to
-- drafts and for what each change set did, such as approving drafts.

CREATE TABLE "fathom"."drafts" (
	"record_type" text NOT NULL,
	"record_id" text NOT NULL,
	"action" text NOT NULL,
	"fields" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"state" text DEFAULT 'waiting' NOT NULL,
	"reason" text,
	CONSTRAINT "drafts_record_type_record_id_pk" PRIMARY KEY("record_type","record_id")
);
--> statement-breakpoint
ALTER TABLE "fathom"."change_sets" ADD COLUMN "kind" text DEFAULT 'edit' NOT NULL;--> statement-breakpoint
ALTER TABLE "fathom"."changes" ADD COLUMN "draft" boolean DEFAULT false NOT NULL;