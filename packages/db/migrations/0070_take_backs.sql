-- SPDX-License-Identifier: Apache-2.0

-- Records on a change taking back one of its maker's private changes, as giving it up on publishing
-- does, the change it takes back, at most once each; on an undo, the change set it undid; and on
-- each private change when its user began the changes a give-up may take back, as ADR 0008 sets out.

ALTER TABLE "fathom"."change_sets" ADD COLUMN "undoes" uuid;--> statement-breakpoint
ALTER TABLE "fathom"."changes" ADD COLUMN "takes_back" bigint;--> statement-breakpoint
ALTER TABLE "fathom"."private_changes" ADD COLUMN "since" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "fathom"."change_sets" ADD CONSTRAINT "change_sets_undoes_change_sets_id_fk" FOREIGN KEY ("undoes") REFERENCES "fathom"."change_sets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fathom"."changes" ADD CONSTRAINT "changes_takes_back_changes_id_fk" FOREIGN KEY ("takes_back") REFERENCES "fathom"."changes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "changes_takes_back_index" ON "fathom"."changes" USING btree ("takes_back");