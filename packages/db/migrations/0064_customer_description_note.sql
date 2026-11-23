-- SPDX-License-Identifier: Apache-2.0

-- Gives customers a plain description and a rich note, each optional and null rather than empty.

ALTER TABLE "fathom"."customers" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "fathom"."customers" ADD COLUMN "note" text;--> statement-breakpoint
ALTER TABLE "fathom"."customers" ADD CONSTRAINT "customers_description_not_empty" CHECK ("fathom"."customers"."description" <> '');--> statement-breakpoint
ALTER TABLE "fathom"."customers" ADD CONSTRAINT "customers_note_not_empty" CHECK ("fathom"."customers"."note" <> '');
