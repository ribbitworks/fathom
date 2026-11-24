-- SPDX-License-Identifier: Apache-2.0

-- Words two starting roles' descriptions to say they edit feature teams, which they do, only where a
-- role still has the description Fathom gave it.

UPDATE "fathom"."roles"
SET "description" = 'Sees the plan and people''s General details, edits features and estimates, and edits feature teams.'
WHERE "key" = 'feature-lead'
  AND "description" = 'Sees the plan and people''s General details, edits features and estimates, and proposes feature teams.';
--> statement-breakpoint
UPDATE "fathom"."roles"
SET "description" = 'Edits the plan and allocations, sees people, with everyone''s Personal and Confidential data, the hiring plan, and configuration, and edits feature teams.'
WHERE "key" = 'engineering-manager'
  AND "description" = 'Edits the plan and allocations, sees people, with everyone''s Personal and Confidential data, the hiring plan, and configuration, and proposes feature teams.';
