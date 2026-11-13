// SPDX-License-Identifier: Apache-2.0

// Tests for roles as those who may edit them send them: names and descriptions as plain text, and
// permissions stored once each, in order; and the permissions that keep Fathom manageable.

import { describe, expect, it } from "vitest";
import {
  lockedPermissions,
  roleEffectsRequestSchema,
  roleRequestSchema,
  staysManageable,
} from "./roles.ts";

describe("roleRequestSchema", () => {
  it("keeps names and descriptions plain, and permissions once each in the shared list's order", () => {
    expect(
      roleRequestSchema.parse({
        name: "  Fictional   Role ",
        description: " For a test. ",
        permissions: ["people:view", "plan:view", "plan:view"],
      }),
    ).toEqual({
      name: "Fictional Role",
      description: "For a test.",
      permissions: ["plan:view", "people:view"],
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

const administrators = {
  id: "administrators",
  permissions: ["administration:edit" as const],
};
const auditors = {
  id: "auditors",
  permissions: ["administration:edit" as const],
};
const holder = (roleIds: string[], active = true) => ({
  active,
  roles: roleIds.map((id) => ({ id, name: id })),
});

describe("staysManageable", () => {
  it("needs an active account holding a role that grants each kept permission", () => {
    expect(
      staysManageable([holder(["administrators"])], [administrators]),
    ).toBe(true);
    expect(
      staysManageable([holder(["administrators"], false)], [administrators]),
    ).toBe(false);
    expect(staysManageable([holder(["other"])], [administrators])).toBe(false);
  });
});

describe("lockedPermissions", () => {
  it("locks a kept permission no other role gives an active account", () => {
    expect(
      lockedPermissions(
        "administrators",
        ["administration:edit"],
        [holder(["administrators"])],
        [administrators, auditors],
      ),
    ).toEqual(["administration:edit"]);
  });

  it("ignores inactive accounts holding another role that grants it", () => {
    expect(
      lockedPermissions(
        "administrators",
        ["administration:edit"],
        [holder(["administrators"]), holder(["auditors"], false)],
        [administrators, auditors],
      ),
    ).toEqual(["administration:edit"]);
  });

  it("frees it while an active account keeps it through another role, even one also holding this", () => {
    expect(
      lockedPermissions(
        "administrators",
        ["administration:edit"],
        [holder(["administrators", "auditors"])],
        [administrators, auditors],
      ),
    ).toEqual([]);
  });

  it("locks nothing the role does not grant", () => {
    expect(
      lockedPermissions(
        "administrators",
        [],
        [holder(["administrators"])],
        [administrators],
      ),
    ).toEqual([]);
  });
});
