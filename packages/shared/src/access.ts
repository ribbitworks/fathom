// SPDX-License-Identifier: Apache-2.0

// The roles Fathom's users can hold, and the permissions they grant, as proposed in
// docs/product/roles.md. The front end uses the permissions to show only what a user can do; the
// server decides what each role grants and enforces it.

import { z } from "zod";

export const roleSchema = z.enum([
  "viewer",
  "project-planner",
  "resource-planner",
  "people-manager",
  "workforce-administrator",
  "leadership",
  "approver",
  "administrator",
]);

export type Role = z.infer<typeof roleSchema>;

export const permissionSchema = z.enum([
  "plan:view",
  "plan:edit",
  "allocations:view",
  "allocations:edit",
  "people:view",
  "people:edit",
  // Feature teams are General data, so seeing them comes with people:view.
  "feature-teams:propose",
  "feature-teams:edit",
  "feature-teams:approve",
  "restricted:view",
  "restricted:edit",
  "confidential:view",
  "confidential:edit",
  "configuration:view",
  "configuration:edit",
  "drafts:submit",
  "drafts:approve",
  "accounts:manage",
]);

export type Permission = z.infer<typeof permissionSchema>;
