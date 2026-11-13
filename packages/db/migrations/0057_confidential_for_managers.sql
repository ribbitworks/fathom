-- SPDX-License-Identifier: Apache-2.0

-- Project Managers and Engineering Managers see Confidential data, so they keep the hiring plan once
-- its class is in force. Their descriptions follow, where nobody has changed them.

INSERT INTO "fathom"."role_permissions" ("role_id", "permission")
SELECT "id", 'confidential:view' FROM "fathom"."roles"
WHERE "key" IN ('project-manager', 'engineering-manager')
ON CONFLICT DO NOTHING;
--> statement-breakpoint
UPDATE "fathom"."roles"
SET "description" = 'Edits the plan, sees people with their Personal and Confidential data and the hiring plan, and approves or rejects drafts of the data the role sees, including allocations and feature teams.'
WHERE "key" = 'project-manager'
  AND "description" = 'Edits the plan, sees people with their Personal details and the hiring plan, and approves or rejects drafts of the data the role sees, including allocations and feature teams.';
--> statement-breakpoint
UPDATE "fathom"."roles"
SET "description" = 'Edits the plan and allocations, sees people, with everyone''s Personal and Confidential data, the hiring plan, and configuration, and proposes feature teams.'
WHERE "key" = 'engineering-manager'
  AND "description" = 'Edits the plan and allocations, sees people, with everyone''s Personal details, the hiring plan, and configuration, and proposes feature teams.';
