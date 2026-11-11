-- SPDX-License-Identifier: Apache-2.0

-- The classes built-in details are kept in once moved from their defaults, and Classify data for
-- the starting roles that move them, with their descriptions saying so.

CREATE TABLE "fathom"."data_classes" (
	"field" text PRIMARY KEY NOT NULL,
	"data_class" text NOT NULL
);
--> statement-breakpoint
INSERT INTO "fathom"."role_permissions" ("role_id", "permission")
SELECT "id", 'data:classify' FROM "fathom"."roles"
WHERE "key" IN ('engineering-director', 'workforce-administrator')
ON CONFLICT DO NOTHING;
--> statement-breakpoint
UPDATE "fathom"."roles" SET "description" = 'Edits and approves the plan, features, allocations, people, feature teams, the hiring plan, and configuration, sees all Personal and Confidential data and moves data between classes, and sees accounts, roles, settings, and the access history without changing them.'
WHERE "key" = 'engineering-director';
--> statement-breakpoint
UPDATE "fathom"."roles" SET "description" = 'Sees the plan, maintains people, teams, reporting lines, feature teams, the hiring plan, and planning configuration, and sees all Personal and Confidential data and moves data between classes.'
WHERE "key" = 'workforce-administrator';
