-- SPDX-License-Identifier: Apache-2.0

-- Twenty-nine permissions in place of thirty-six, for every role, the starting roles and those made
-- in Fathom alike. The Org chart becomes part of People, so seeing it is seeing people and their
-- feature teams; team colours become part of editing people; proposing feature teams becomes
-- editing them; features and releases become an area of their own, seen with the plan and approved
-- by those who approved the plan or releases; accounts, roles, settings and the access history
-- become one Administration area; Draft on Drafts, never built, goes, and the change history is
-- seen with each area. Editing features no longer brings the plan, so a role that only edited
-- features is given View Plan; a role that edited the plan but not features no longer edits
-- releases. A permission an edit grants with it is not stored. The starting roles'
-- descriptions follow, where nobody has changed them.

INSERT INTO "fathom"."role_permissions" ("role_id", "permission")
SELECT "role_id", 'feature-teams:edit' FROM "fathom"."role_permissions"
WHERE "permission" = 'feature-teams:propose'
ON CONFLICT DO NOTHING;
--> statement-breakpoint
INSERT INTO "fathom"."role_permissions" ("role_id", "permission")
SELECT DISTINCT "role_id", 'features:approve' FROM "fathom"."role_permissions"
WHERE "permission" IN ('plan:approve', 'releases:approve')
ON CONFLICT DO NOTHING;
--> statement-breakpoint
INSERT INTO "fathom"."role_permissions" ("role_id", "permission")
SELECT DISTINCT "role_id", 'features:view' FROM "fathom"."role_permissions" AS granted
WHERE "permission" IN ('plan:view', 'plan:edit', 'plan:approve')
  AND NOT EXISTS (
    SELECT 1 FROM "fathom"."role_permissions" AS edits
    WHERE edits."role_id" = granted."role_id" AND edits."permission" = 'features:edit'
  )
ON CONFLICT DO NOTHING;
--> statement-breakpoint
INSERT INTO "fathom"."role_permissions" ("role_id", "permission")
SELECT "role_id", 'plan:view' FROM "fathom"."role_permissions" AS granted
WHERE "permission" = 'features:edit'
  AND NOT EXISTS (
    SELECT 1 FROM "fathom"."role_permissions" AS plans
    WHERE plans."role_id" = granted."role_id"
      AND plans."permission" IN ('plan:view', 'plan:edit')
  )
ON CONFLICT DO NOTHING;
--> statement-breakpoint
INSERT INTO "fathom"."role_permissions" ("role_id", "permission")
SELECT "role_id", 'people:view' FROM "fathom"."role_permissions" AS granted
WHERE "permission" = 'org-chart:view'
  AND NOT EXISTS (
    SELECT 1 FROM "fathom"."role_permissions" AS edits
    WHERE edits."role_id" = granted."role_id" AND edits."permission" = 'people:edit'
  )
ON CONFLICT DO NOTHING;
--> statement-breakpoint
INSERT INTO "fathom"."role_permissions" ("role_id", "permission")
SELECT DISTINCT "role_id", 'feature-teams:view' FROM "fathom"."role_permissions" AS granted
WHERE "permission" IN ('org-chart:view', 'feature-teams:approve')
  AND NOT EXISTS (
    SELECT 1 FROM "fathom"."role_permissions" AS edits
    WHERE edits."role_id" = granted."role_id" AND edits."permission" = 'feature-teams:edit'
  )
ON CONFLICT DO NOTHING;
--> statement-breakpoint
INSERT INTO "fathom"."role_permissions" ("role_id", "permission")
SELECT DISTINCT "role_id", 'administration:edit' FROM "fathom"."role_permissions"
WHERE "permission" IN ('accounts:manage', 'roles:edit', 'settings:edit')
ON CONFLICT DO NOTHING;
--> statement-breakpoint
INSERT INTO "fathom"."role_permissions" ("role_id", "permission")
SELECT DISTINCT "role_id", 'administration:view' FROM "fathom"."role_permissions" AS granted
WHERE "permission" IN ('accounts:view', 'roles:view', 'settings:view', 'history:view')
  AND NOT EXISTS (
    SELECT 1 FROM "fathom"."role_permissions" AS edits
    WHERE edits."role_id" = granted."role_id" AND edits."permission" = 'administration:edit'
  )
ON CONFLICT DO NOTHING;
--> statement-breakpoint
DELETE FROM "fathom"."role_permissions"
WHERE "permission" IN (
  'org-chart:view', 'team-colours:edit', 'feature-teams:propose', 'releases:approve',
  'drafts:submit', 'changes:view', 'accounts:view', 'accounts:manage', 'roles:view', 'roles:edit',
  'settings:view', 'settings:edit', 'history:view'
);
--> statement-breakpoint
UPDATE "fathom"."roles"
SET "description" = 'Sees the plan, including everyone''s work assignments, and people''s General details.'
WHERE "key" = 'team-member'
  AND "description" = 'Sees the plan, including everyone''s work assignments, and the org chart.';
--> statement-breakpoint
UPDATE "fathom"."roles"
SET "description" = 'Edits projects, proposals, features, milestones, releases, products, customers, and estimates across the whole plan, approves or rejects drafts of the plan and releases, and sees people''s General details.'
WHERE "key" = 'product-manager'
  AND "description" = 'Edits projects, proposals, features, milestones, releases, products, customers, and estimates across the whole plan, and approves or rejects drafts of the plan.';
--> statement-breakpoint
UPDATE "fathom"."roles"
SET "description" = 'Edits the plan and allocations, sees people, with everyone''s Personal details and the hiring plan, and proposes feature teams.'
WHERE "key" = 'engineering-manager'
  AND "description" = 'Edits the plan and allocations, sees people, with everyone''s Personal details and the hiring plan, colours teams on the org chart, and proposes feature teams.';
