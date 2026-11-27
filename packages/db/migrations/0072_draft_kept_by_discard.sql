-- SPDX-License-Identifier: Apache-2.0

-- Marks a change in a discard that leaves its record's draft in place, as taking a fill out of the
-- fill's other drafts does, so the change history counts it as a change to the draft, not its end.

ALTER TABLE "fathom"."changes" ADD COLUMN "keeps_draft" boolean DEFAULT false NOT NULL;
