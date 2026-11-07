-- SPDX-License-Identifier: Apache-2.0

-- Lets each release hold a note, kept as Markdown and checked by the server, as a note column's
-- is. A release without a note has none rather than an empty one.

ALTER TABLE "fathom"."releases" ADD COLUMN "note" text;--> statement-breakpoint
ALTER TABLE "fathom"."releases" ADD CONSTRAINT "releases_note_not_empty" CHECK ("fathom"."releases"."note" <> '');
