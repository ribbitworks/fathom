-- SPDX-License-Identifier: Apache-2.0

-- Keeps anything but a web address out of a link value, whatever writes it; the server checks each
-- address in full.

ALTER TABLE "fathom"."field_values" ADD CONSTRAINT "field_values_web_address" CHECK ("fathom"."field_values"."link_address" IS NULL OR "fathom"."field_values"."link_address" ~ '^https?://');
