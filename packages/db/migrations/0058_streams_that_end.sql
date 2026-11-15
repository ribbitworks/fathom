-- SPDX-License-Identifier: Apache-2.0

-- A release stream may end on a day, its last cycle cut short to end on it, or keep going while it's
-- empty.

ALTER TABLE "fathom"."release_streams" ADD COLUMN "ends_on" date;
