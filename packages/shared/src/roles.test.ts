// SPDX-License-Identifier: Apache-2.0

// Tests for roles as those who may edit them send them: names and descriptions as plain text, and
// permissions stored once each, in order.

import { describe, expect, it } from "vitest";
import { roleEffectsRequestSchema, roleRequestSchema } from "./roles.ts";

describe("roleRequestSchema", () => {
  it("keeps names and descriptions plain, and permissions once each in the shared list's order", () => {
    expect(
      roleRequestSchema.parse({
        name: "  Fictional   Role ",
        description: " For a test. ",
        permissions: ["changes:view", "plan:view", "plan:view"],
      }),
    ).toEqual({
      name: "Fictional Role",
      description: "For a test.",
      permissions: ["plan:view", "changes:view"],
    });
  });

  it.each([
    { name: "", description: "", permissions: [] },
    { name: "Fictional", description: "x".repeat(501), permissions: [] },
    { name: "Fictional", description: "a\u0007b", permissions: [] },
    { name: "Fictional", description: "", permissions: ["retired:permission"] },
  ])("refuses a role the rules do not allow: %j", (role) => {
    expect(roleRequestSchema.safeParse(role).success).toBe(false);
  });
});

describe("roleEffectsRequestSchema", () => {
  it("takes permissions once each, in order", () => {
    expect(
      roleEffectsRequestSchema.parse({
        permissions: ["people:view", "plan:view", "people:view"],
      }),
    ).toEqual({ permissions: ["plan:view", "people:view"] });
  });
});
