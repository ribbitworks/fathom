-- SPDX-License-Identifier: Apache-2.0

-- Nobody approves drafts they changed, unless their role grants Approve their own drafts, as the
-- Decisions Log sets out. The Engineering Director is given it, and nobody else.

INSERT INTO "fathom"."role_permissions" ("role_id", "permission")
SELECT "id", 'drafts:approve-own' FROM "fathom"."roles" WHERE "key" = 'engineering-director'
ON CONFLICT DO NOTHING;
