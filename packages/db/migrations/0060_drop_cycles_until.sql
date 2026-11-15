-- SPDX-License-Identifier: Apache-2.0

-- A schedule no longer keeps a day its cycles are made until: Fathom lays them out two years from
-- today, or further where a release or feature reaches, and stops at the schedule's last day.

ALTER TABLE "fathom"."release_streams" DROP COLUMN "cycles_until";
