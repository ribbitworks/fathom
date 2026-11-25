-- SPDX-License-Identifier: Apache-2.0

-- Words two starting roles' descriptions to say they set a feature's feature team, now only those
-- who edit feature teams, only where a role still has the description Fathom gave it.

UPDATE "fathom"."roles"
SET "description" = 'Sees the plan and people''s General details, edits features and estimates, and edits feature teams and which team each feature has.'
WHERE "key" = 'feature-lead'
  AND "description" = 'Sees the plan and people''s General details, edits features and estimates, and edits feature teams.';
--> statement-breakpoint
UPDATE "fathom"."roles"
SET "description" = 'Edits the plan and allocations, sees people, with everyone''s Personal and Confidential data, the hiring plan, and configuration, and edits feature teams and which team each feature has.'
WHERE "key" = 'engineering-manager'
  AND "description" = 'Edits the plan and allocations, sees people, with everyone''s Personal and Confidential data, the hiring plan, and configuration, and edits feature teams.';
