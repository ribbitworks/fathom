-- SPDX-License-Identifier: Apache-2.0

-- Drops products, which Fathom doesn't have, from the Product Manager's starting description, only
-- where the role still has the description Fathom gave it.

UPDATE "fathom"."roles"
SET "description" = 'Edits projects, proposals, features, milestones, releases, customers, and estimates across the whole plan, approves or rejects drafts of the plan and releases, and sees people''s General details and configuration.'
WHERE "key" = 'product-manager'
  AND "description" = 'Edits projects, proposals, features, milestones, releases, products, customers, and estimates across the whole plan, approves or rejects drafts of the plan and releases, and sees people''s General details and configuration.';
