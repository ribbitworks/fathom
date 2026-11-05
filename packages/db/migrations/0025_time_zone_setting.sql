-- SPDX-License-Identifier: Apache-2.0

-- Fathom's time zone, which decides which day is today for everyone, as the Decisions Log sets out,
-- and a permission to change it, which every role that can change roles also gets.

INSERT INTO "fathom"."app_info" ("key", "value") VALUES ('time-zone', 'America/Vancouver')
ON CONFLICT DO NOTHING;
--> statement-breakpoint
INSERT INTO "fathom"."role_permissions" ("role_id", "permission")
SELECT "role_id", 'settings:edit' FROM "fathom"."role_permissions" WHERE "permission" = 'roles:edit'
ON CONFLICT DO NOTHING;
