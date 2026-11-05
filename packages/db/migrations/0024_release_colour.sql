-- SPDX-License-Identifier: Apache-2.0

-- Lets each release name a colour from the palette. Existing releases have none and keep the default
-- colour.

ALTER TABLE "fathom"."releases" ADD COLUMN "colour" text;
