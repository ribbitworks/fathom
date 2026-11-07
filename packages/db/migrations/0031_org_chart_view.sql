-- SPDX-License-Identifier: Apache-2.0

-- Seeing the org chart becomes a permission of its own, apart from seeing people, as the Decisions
-- Log sets out. Every role that sees the plan or people is given it, so roles that saw the chart
-- still do, and those that see the plan now see it too. The Administrator, which sees neither, is
-- not. Team Member's description says so, unless it has been changed.

INSERT INTO "fathom"."role_permissions" ("role_id", "permission")
SELECT DISTINCT "role_id", 'org-chart:view' FROM "fathom"."role_permissions"
WHERE "permission" IN ('plan:view', 'plan:edit', 'people:view', 'people:edit')
ON CONFLICT DO NOTHING;
--> statement-breakpoint
UPDATE "fathom"."roles"
SET "description" = 'Sees the plan, including everyone''s work assignments, and the org chart.'
WHERE "key" = 'team-member'
  AND "description" = 'Sees the plan, including everyone''s work assignments.';
