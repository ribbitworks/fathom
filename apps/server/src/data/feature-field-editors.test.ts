// SPDX-License-Identifier: Apache-2.0

// Tests for who may change the fields of a feature that another kind's editors decide: which
// customers it is for, and its feature team.

import type { Permission, Role } from "@fathom/shared";
import { defaultClasses, startingRoles, withImplied } from "@fathom/shared";
import { describe, expect, it } from "vitest";
import type { Actor } from "../access.ts";
import {
  changesCustomers,
  customersNeedPlan,
  featureTeamNeedsTeamEditors,
  refuseFeatureFieldChanges,
} from "./feature-field-editors.ts";

const actor = (permissions: readonly Permission[]): Actor => ({
  user: { id: "fictional-user", name: "Fictional User", email: "" },
  roleId: null,
  dataClasses: defaultClasses,
  permissions: [...permissions],
});

const planEditor = actor(["plan:view", "plan:edit"]);
const featureEditor = actor(["features:view", "features:edit"]);
const forCustomers = (...customerIds: string[]) => ({ customerIds });
const forTeam = (featureTeamId: string | null) => ({ featureTeamId });
const productManager = actor(
  withImplied(startingRoles["product-manager"].permissions),
);

describe("changesCustomers", () => {
  it.each([
    ["no customers before or after", undefined, forCustomers(), false],
    ["a record without customers", {}, {}, false],
    [
      "the same customers",
      forCustomers("a", "b"),
      forCustomers("a", "b"),
      false,
    ],
    ["a customer added", forCustomers("a"), forCustomers("a", "b"), true],
    ["a customer taken off", forCustomers("a", "b"), forCustomers("a"), true],
    ["a new feature with customers", undefined, forCustomers("a"), true],
    ["a feature removed", forCustomers("a"), undefined, false],
  ] as const)("is %s: %s", (_case, before, after, changed) => {
    expect(changesCustomers(before, after)).toBe(changed);
  });
});

describe("a feature's customers", () => {
  it("may be changed by a role that edits the plan", () => {
    expect(() => {
      refuseFeatureFieldChanges(
        planEditor,
        forCustomers("a"),
        forCustomers("b"),
      );
    }).not.toThrow();
  });

  it("are refused to a role that edits features alone, saying why", () => {
    expect(() => {
      refuseFeatureFieldChanges(
        featureEditor,
        forCustomers("a"),
        forCustomers("b"),
      );
    }).toThrow(customersNeedPlan);
  });

  it("may be kept by a role that edits features alone", () => {
    expect(() => {
      refuseFeatureFieldChanges(
        featureEditor,
        forCustomers("a", "b"),
        forCustomers("a", "b"),
      );
    }).not.toThrow();
  });
});

describe("a feature's feature team", () => {
  // Whether each starting role may change it: those who edit feature teams. A role without Edit
  // Features and releases is refused the feature itself elsewhere.
  const changesTeam: Record<Role, boolean> = {
    "team-member": false,
    "product-manager": false,
    "feature-lead": true,
    "project-manager": false,
    "engineering-manager": true,
    "engineering-director": true,
    "workforce-administrator": true,
    executive: false,
    administrator: false,
  };
  const changesTeamOf = new Map(Object.entries(changesTeam));
  const roles = Object.entries(startingRoles).map(
    ([role, { permissions }]) =>
      [role, actor(withImplied(permissions)), changesTeamOf.get(role)] as const,
  );

  it.each(roles.filter(([, , allowed]) => allowed === true))(
    "may be changed by the starting %s, who edits feature teams",
    (_role, editor) => {
      expect(() => {
        refuseFeatureFieldChanges(editor, forTeam("a"), forTeam("b"));
      }).not.toThrow();
    },
  );

  it.each(roles.filter(([, , allowed]) => allowed === false))(
    "is refused to the starting %s, who doesn't edit feature teams, saying why",
    (_role, editor) => {
      expect(() => {
        refuseFeatureFieldChanges(editor, forTeam("a"), forTeam("b"));
      }).toThrow(featureTeamNeedsTeamEditors);
    },
  );

  it.each([
    ["chosen for a new feature", undefined, forTeam("a")],
    ["cleared", forTeam("a"), forTeam(null)],
  ] as const)(
    "is refused to a role that edits features alone when %s",
    (_case, before, after) => {
      expect(() => {
        refuseFeatureFieldChanges(productManager, before, after);
      }).toThrow(featureTeamNeedsTeamEditors);
    },
  );

  it.each([
    ["kept", forTeam("a"), forTeam("a")],
    ["left empty on a new feature", undefined, forTeam(null)],
    ["left out of a removed feature", forTeam("a"), undefined],
  ] as const)(
    "may be %s by a role that edits features alone",
    (_case, before, after) => {
      expect(() => {
        refuseFeatureFieldChanges(productManager, before, after);
      }).not.toThrow();
    },
  );
});
