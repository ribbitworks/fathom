-- SPDX-License-Identifier: Apache-2.0

-- Gives each account exactly one role, as the Decisions Log sets out, and replaces the starting
-- roles with one for each persona, granting what that persona's roles granted together. Databases
-- are reset rather than converted, so this does not move accounts from the old roles: it fails on a
-- database whose accounts hold them. It also marks accounts whose password Fathom generated, which
-- must change it at first sign-in, and stores the password settings, with their defaults: the rules
-- for passwords people choose, and the recipe for those Fathom makes.

-- At most one role for each account: the user's ID becomes the key, which keeps roles held by
-- reference, so a role held by any account still cannot be deleted. A role column on users would
-- need Better Auth, which adds the user before Fathom gives it a role, to know of it. The server
-- makes sure every account has a role.
ALTER TABLE "fathom"."user_roles" DROP CONSTRAINT "user_roles_user_id_role_id_pk";--> statement-breakpoint
ALTER TABLE "fathom"."user_roles" ADD PRIMARY KEY ("user_id");--> statement-breakpoint
DELETE FROM "fathom"."roles" WHERE "key" IN ('viewer', 'project-planner', 'resource-planner', 'people-manager', 'workforce-administrator', 'leadership', 'approver', 'administrator');--> statement-breakpoint
INSERT INTO "fathom"."roles" ("key", "name", "description") VALUES
  ('team-member', 'Team Member', 'Sees the plan, including everyone''s work assignments.'),
  ('planner', 'Planner', 'Edits projects, proposals, features, milestones, releases, products, customers, and estimates across the whole plan.'),
  ('project-manager', 'Project Manager', 'Edits the plan, and approves or rejects drafts of the data the role sees, including feature teams.'),
  ('engineering-manager', 'Engineering Manager', 'Edits the plan and allocations, sees people, including everyone''s Restricted details, colours teams on the org chart, and proposes feature teams.'),
  ('engineering-director', 'Engineering Director', 'Edits the plan and allocations, sees people, with their Restricted and Confidential data, and approves or rejects drafts of the data the role sees.'),
  ('workforce-administrator', 'Workforce Administrator', 'Sees the plan, maintains people, teams, reporting lines, feature teams, the hiring plan, and planning configuration, and sees all Restricted and Confidential data.'),
  ('executive', 'Executive', 'Sees the plan, and people, with their Restricted and Confidential data, without editing them.'),
  ('resource-planner', 'Resource Planner', 'Sees the plan and people''s General details, and edits allocations across the whole plan.'),
  ('administrator', 'Administrator', 'Manages user accounts, roles, and system settings, without access to the plan or people''s data.');--> statement-breakpoint
INSERT INTO "fathom"."role_permissions" ("role_id", "permission")
SELECT r."id", g."permission" FROM "fathom"."roles" r JOIN (VALUES
  ('team-member', 'plan:view'),
  ('team-member', 'allocations:view'),
  ('team-member', 'changes:view'),
  ('planner', 'plan:edit'),
  ('planner', 'allocations:view'),
  ('planner', 'drafts:submit'),
  ('planner', 'changes:view'),
  ('project-manager', 'plan:edit'),
  ('project-manager', 'allocations:view'),
  ('project-manager', 'feature-teams:approve'),
  ('project-manager', 'configuration:view'),
  ('project-manager', 'drafts:submit'),
  ('project-manager', 'drafts:approve'),
  ('project-manager', 'changes:view'),
  ('engineering-manager', 'plan:edit'),
  ('engineering-manager', 'allocations:edit'),
  ('engineering-manager', 'people:view'),
  ('engineering-manager', 'team-colours:edit'),
  ('engineering-manager', 'feature-teams:propose'),
  ('engineering-manager', 'feature-teams:edit'),
  ('engineering-manager', 'restricted:view'),
  ('engineering-manager', 'drafts:submit'),
  ('engineering-manager', 'changes:view'),
  ('engineering-director', 'plan:edit'),
  ('engineering-director', 'allocations:edit'),
  ('engineering-director', 'people:view'),
  ('engineering-director', 'feature-teams:approve'),
  ('engineering-director', 'restricted:view'),
  ('engineering-director', 'confidential:view'),
  ('engineering-director', 'configuration:view'),
  ('engineering-director', 'drafts:submit'),
  ('engineering-director', 'drafts:approve'),
  ('engineering-director', 'changes:view'),
  ('workforce-administrator', 'plan:view'),
  ('workforce-administrator', 'allocations:view'),
  ('workforce-administrator', 'people:edit'),
  ('workforce-administrator', 'team-colours:edit'),
  ('workforce-administrator', 'feature-teams:edit'),
  ('workforce-administrator', 'restricted:edit'),
  ('workforce-administrator', 'confidential:edit'),
  ('workforce-administrator', 'configuration:edit'),
  ('workforce-administrator', 'changes:view'),
  ('executive', 'plan:view'),
  ('executive', 'allocations:view'),
  ('executive', 'people:view'),
  ('executive', 'restricted:view'),
  ('executive', 'confidential:view'),
  ('executive', 'changes:view'),
  ('resource-planner', 'plan:view'),
  ('resource-planner', 'allocations:edit'),
  ('resource-planner', 'people:view'),
  ('resource-planner', 'drafts:submit'),
  ('resource-planner', 'changes:view'),
  ('administrator', 'accounts:manage'),
  ('administrator', 'roles:edit'),
  ('administrator', 'settings:edit'),
  ('administrator', 'history:view')
) AS g ("key", "permission") ON g."key" = r."key";--> statement-breakpoint
ALTER TABLE "fathom"."users" ADD COLUMN "must_change_password" boolean DEFAULT false NOT NULL;--> statement-breakpoint
INSERT INTO "fathom"."app_info" ("key", "value") VALUES ('password-settings', '{"rules":{"uppercase":false,"lowercase":false,"digits":false,"symbols":false,"minimumLength":12},"recipe":{"uppercase":true,"lowercase":true,"digits":true,"symbols":false,"length":20,"avoidLookAlikes":true}}')
ON CONFLICT DO NOTHING;
