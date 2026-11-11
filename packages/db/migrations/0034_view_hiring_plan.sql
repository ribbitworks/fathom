-- SPDX-License-Identifier: Apache-2.0

-- The hiring plan becomes a permission area of its own, apart from Confidential data, as the
-- Decisions Log sets out. Every role that sees Confidential data is given View Hiring plan, and every
-- role that changes it Edit Hiring plan, so nobody loses access. The Project Manager is also given
-- View People and View Hiring plan, and the Engineering Manager View Hiring plan. The descriptions
-- of the starting roles given more say so, unless they have been changed.

INSERT INTO "fathom"."role_permissions" ("role_id", "permission")
SELECT DISTINCT "role_id", 'hiring-plan:view' FROM "fathom"."role_permissions"
WHERE "permission" = 'confidential:view'
ON CONFLICT DO NOTHING;
--> statement-breakpoint
INSERT INTO "fathom"."role_permissions" ("role_id", "permission")
SELECT DISTINCT "role_id", 'hiring-plan:edit' FROM "fathom"."role_permissions"
WHERE "permission" = 'confidential:edit'
ON CONFLICT DO NOTHING;
--> statement-breakpoint
INSERT INTO "fathom"."role_permissions" ("role_id", "permission")
SELECT r."id", g."permission" FROM "fathom"."roles" r JOIN (VALUES
  ('project-manager', 'people:view'),
  ('project-manager', 'hiring-plan:view'),
  ('engineering-manager', 'hiring-plan:view')
) AS g ("key", "permission") ON g."key" = r."key"
ON CONFLICT DO NOTHING;
--> statement-breakpoint
UPDATE "fathom"."roles"
SET "description" = 'Edits the plan, sees people and the hiring plan, and approves or rejects drafts of the data the role sees, including feature teams.'
WHERE "key" = 'project-manager'
  AND "description" = 'Edits the plan, and approves or rejects drafts of the data the role sees, including feature teams.';
--> statement-breakpoint
UPDATE "fathom"."roles"
SET "description" = 'Edits the plan and allocations, sees people, with everyone''s Personal details and the hiring plan, colours teams on the org chart, and proposes feature teams.'
WHERE "key" = 'engineering-manager'
  AND "description" = 'Edits the plan and allocations, sees people, including everyone''s Personal details, colours teams on the org chart, and proposes feature teams.';
--> statement-breakpoint
UPDATE "fathom"."roles"
SET "description" = 'Edits the plan and allocations, sees people, with their Personal and Confidential data and the hiring plan, and approves or rejects drafts of the data the role sees.'
WHERE "key" = 'engineering-director'
  AND "description" = 'Edits the plan and allocations, sees people, with their Personal and Confidential data, and approves or rejects drafts of the data the role sees.';
--> statement-breakpoint
UPDATE "fathom"."roles"
SET "description" = 'Sees the plan, and people, with their Personal and Confidential data and the hiring plan, without editing them.'
WHERE "key" = 'executive'
  AND "description" = 'Sees the plan, and people, with their Personal and Confidential data, without editing them.';
