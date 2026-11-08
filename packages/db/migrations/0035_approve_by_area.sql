-- SPDX-License-Identifier: Apache-2.0

-- Approving drafts is granted by area, as the Decisions Log sets out: the plan, releases, people,
-- the hiring plan, and configuration each have an Approve permission of their own, in place of one
-- for drafts of every kind. Every role that approved drafts of every kind is given each of them,
-- so it approves what it did before.

INSERT INTO "fathom"."role_permissions" ("role_id", "permission")
SELECT r."role_id", a."permission" FROM "fathom"."role_permissions" r CROSS JOIN (VALUES
  ('plan:approve'),
  ('releases:approve'),
  ('people:approve'),
  ('hiring-plan:approve'),
  ('configuration:approve')
) AS a ("permission")
WHERE r."permission" = 'drafts:approve'
ON CONFLICT DO NOTHING;
--> statement-breakpoint
DELETE FROM "fathom"."role_permissions" WHERE "permission" = 'drafts:approve';
