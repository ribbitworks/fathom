// SPDX-License-Identifier: Apache-2.0

// Tests for who may change which customers a feature is for.

import type { Permission } from "@fathom/shared";
import { defaultClasses } from "@fathom/shared";
import { describe, expect, it } from "vitest";
import type { Actor } from "../access.ts";
import {
  changesCustomers,
  customersNeedPlan,
  refuseCustomersChange,
} from "./feature-customers.ts";

const actor = (permissions: Permission[]): Actor => ({
  user: { id: "fictional-user", name: "Fictional User", email: "" },
  roleId: null,
  dataClasses: defaultClasses,
  permissions,
});

const planEditor = actor(["plan:view", "plan:edit"]);
const featureEditor = actor(["features:view", "features:edit"]);
const forCustomers = (...customerIds: string[]) => ({ customerIds });

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

describe("refuseCustomersChange", () => {
  it("lets a role that edits the plan change a feature's customers", () => {
    expect(() => {
      refuseCustomersChange(planEditor, forCustomers("a"), forCustomers("b"));
    }).not.toThrow();
  });

  it("refuses it to a role that edits features alone, saying why", () => {
    expect(() => {
      refuseCustomersChange(
        featureEditor,
        forCustomers("a"),
        forCustomers("b"),
      );
    }).toThrow(customersNeedPlan);
  });

  it("lets a role that edits features alone keep a feature's customers", () => {
    expect(() => {
      refuseCustomersChange(
        featureEditor,
        forCustomers("a", "b"),
        forCustomers("a", "b"),
      );
    }).not.toThrow();
  });
});
