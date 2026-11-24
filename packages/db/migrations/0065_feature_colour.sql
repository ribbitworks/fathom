-- SPDX-License-Identifier: Apache-2.0

-- A feature's own colour, a palette name, or null while it shows its feature team's.

ALTER TABLE "fathom"."features" ADD COLUMN "colour" text;
