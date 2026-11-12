-- SPDX-License-Identifier: Apache-2.0

-- Gives the starting roles their permissions under the 29 permissions: Feature Leads no longer edit
-- allocations; Project Managers see Personal data; Product Managers and Engineering Managers see
-- configuration; and the Resource Planner is no longer a starting role. A Resource Planner role that
-- an account holds, that the change history names, or that a session is acting as, is kept as a role
-- the organization made; otherwise it goes. The starting roles' descriptions follow, where nobody
-- has changed them.

DELETE FROM "fathom"."role_permissions"
WHERE "permission" = 'allocations:edit'
  AND "role_id" = (SELECT "id" FROM "fathom"."roles" WHERE "key" = 'feature-lead');
--> statement-breakpoint
INSERT INTO "fathom"."role_permissions" ("role_id", "permission")
SELECT "id", 'configuration:view' FROM "fathom"."roles"
WHERE "key" IN ('product-manager', 'engineering-manager')
ON CONFLICT DO NOTHING;
--> statement-breakpoint
INSERT INTO "fathom"."role_permissions" ("role_id", "permission")
SELECT "id", 'personal:view' FROM "fathom"."roles"
WHERE "key" = 'project-manager'
ON CONFLICT DO NOTHING;
--> statement-breakpoint
UPDATE "fathom"."roles" AS planner SET "key" = NULL
WHERE planner."key" = 'resource-planner'
  AND (
    EXISTS (SELECT 1 FROM "fathom"."user_roles" WHERE "role_id" = planner."id")
    OR EXISTS (SELECT 1 FROM "fathom"."change_sets" WHERE "made_as_role_id" = planner."id")
    OR EXISTS (SELECT 1 FROM "fathom"."sessions" WHERE "active_role_id" = planner."id")
  );
--> statement-breakpoint
DELETE FROM "fathom"."roles" WHERE "key" = 'resource-planner';
--> statement-breakpoint
UPDATE "fathom"."roles"
SET "description" = 'Sees the plan and people''s General details.'
WHERE "key" = 'team-member'
  AND "description" = 'Sees the plan, including everyone''s work assignments, and people''s General details.';
--> statement-breakpoint
UPDATE "fathom"."roles"
SET "description" = 'Edits projects, proposals, features, milestones, releases, products, customers, and estimates across the whole plan, approves or rejects drafts of the plan and releases, and sees people''s General details and configuration.'
WHERE "key" = 'product-manager'
  AND "description" = 'Edits projects, proposals, features, milestones, releases, products, customers, and estimates across the whole plan, approves or rejects drafts of the plan and releases, and sees people''s General details.';
--> statement-breakpoint
UPDATE "fathom"."roles"
SET "description" = 'Sees the plan and people''s General details, edits features and estimates, and proposes feature teams.'
WHERE "key" = 'feature-lead'
  AND "description" = 'Sees the plan and people''s General details, edits features, estimates, and allocations, and proposes feature teams.';
--> statement-breakpoint
UPDATE "fathom"."roles"
SET "description" = 'Edits the plan, sees people with their Personal details and the hiring plan, and approves or rejects drafts of the data the role sees, including allocations and feature teams.'
WHERE "key" = 'project-manager'
  AND "description" = 'Edits the plan, sees people and the hiring plan, and approves or rejects drafts of the data the role sees, including feature teams.';
--> statement-breakpoint
UPDATE "fathom"."roles"
SET "description" = 'Edits the plan and allocations, sees people, with everyone''s Personal details, the hiring plan, and configuration, and proposes feature teams.'
WHERE "key" = 'engineering-manager'
  AND "description" = 'Edits the plan and allocations, sees people, with everyone''s Personal details and the hiring plan, and proposes feature teams.';
