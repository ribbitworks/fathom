-- SPDX-License-Identifier: Apache-2.0

-- Splits changing roles from managing accounts, as the Decisions Log sets out: every role that can
-- manage accounts also gets the new permission to edit roles, so nobody's access changes. Also
-- rewords one starting role's description.

INSERT INTO "fathom"."role_permissions" ("role_id", "permission")
SELECT "role_id", 'roles:edit' FROM "fathom"."role_permissions" WHERE "permission" = 'accounts:manage'
ON CONFLICT DO NOTHING;
--> statement-breakpoint
-- Words the People Manager role's description more plainly, unless it has been changed since.
UPDATE "fathom"."roles"
SET "description" = 'Sees people, including everyone''s Restricted details, and proposes feature teams.'
WHERE "key" = 'people-manager'
  AND "description" = 'Proposes feature teams, and sees people, with Restricted details for everyone.';
