-- SPDX-License-Identifier: Apache-2.0

-- Lets each named team name a colour from the palette. Existing teams have none. Choosing it is a
-- permission of its own, given to every role that changes people, which could before, and to the
-- People Manager role, whose description says so unless it has been changed.

ALTER TABLE "fathom"."teams" ADD COLUMN "colour" text;
--> statement-breakpoint
INSERT INTO "fathom"."role_permissions" ("role_id", "permission")
SELECT "role_id", 'team-colours:edit' FROM "fathom"."role_permissions" WHERE "permission" = 'people:edit'
ON CONFLICT DO NOTHING;
--> statement-breakpoint
INSERT INTO "fathom"."role_permissions" ("role_id", "permission")
SELECT "id", 'team-colours:edit' FROM "fathom"."roles" WHERE "key" = 'people-manager'
ON CONFLICT DO NOTHING;
--> statement-breakpoint
UPDATE "fathom"."roles"
SET "description" = 'Sees people, including everyone''s Restricted details, colours teams on the org chart, and proposes feature teams.'
WHERE "key" = 'people-manager'
  AND "description" = 'Sees people, including everyone''s Restricted details, and proposes feature teams.';
