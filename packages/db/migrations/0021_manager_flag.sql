-- SPDX-License-Identifier: Apache-2.0

-- Flags the people who can be named as a manager. Everyone named as a manager by a reporting line
-- that is in force or yet to start, or by an open planned hire, is flagged, so the data already meets
-- the server's rule that nobody reports to someone not flagged. Today is the UTC date, as the server
-- takes it.

ALTER TABLE "fathom"."people" ADD COLUMN "is_manager" boolean DEFAULT false NOT NULL;--> statement-breakpoint
UPDATE "fathom"."people" SET "is_manager" = true WHERE "id" IN (
  SELECT "line"."manager_id" FROM "fathom"."reporting_lines" AS "line"
  WHERE NOT EXISTS (
    SELECT 1 FROM "fathom"."reporting_lines" AS "later"
    WHERE "later"."person_id" = "line"."person_id"
      AND "later"."from_date" > "line"."from_date"
      AND "later"."from_date" <= (now() AT TIME ZONE 'UTC')::date
  )
  UNION
  SELECT "manager_id" FROM "fathom"."planned_hires"
  WHERE "state" IN ('proposed', 'approved', 'recruiting', 'offer-accepted')
);
