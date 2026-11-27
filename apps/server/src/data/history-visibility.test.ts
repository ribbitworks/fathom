// SPDX-License-Identifier: Apache-2.0

// Unit tests for which kinds and classes of change the change history shows each role, as applied to
// a change not read from the history, such as a value not yet saved.

import {
  type ColumnTable,
  type Permission,
  startingRoles,
} from "@fathom/shared";
import { describe, expect, it } from "vitest";
import { actorWith } from "../access.ts";
import { showsChange } from "./history-visibility.ts";

const user = {
  id: "user-1",
  name: "Fictional User",
  email: "user@example.test",
};

const shows = (
  permissions: readonly Permission[],
  recordType: string,
  tier = "general",
  field = "name",
  tables: ReadonlyMap<string, ColumnTable> = new Map(),
) =>
  showsChange(
    actorWith(user, permissions),
    tables,
  )({
    recordType,
    recordId: "record-1",
    field,
    tier,
  });

describe("the changes the history shows a role", () => {
  it("are configuration's for a role that sees configuration without people", () => {
    expect(shows(["configuration:view"], "list")).toBe(true);
    expect(shows(["configuration:view"], "person")).toBe(false);
  });

  it("are a column's to a role that sees its table's records, not configuration alone", () => {
    const features = new Map<string, ColumnTable>([["record-1", "features"]]);

    expect(shows(["configuration:view"], "field")).toBe(false);
    expect(shows(["people:view"], "field")).toBe(true);
    expect(shows(["people:view"], "field", "general", "name", features)).toBe(
      false,
    );
    expect(shows(["features:view"], "field", "general", "name", features)).toBe(
      true,
    );
  });

  it("are no configuration's for a role that sees people alone", () => {
    expect(shows(["people:view"], "list-item")).toBe(false);
    expect(shows(["people:view"], "person")).toBe(true);
  });

  it("are a class only to a role that sees it", () => {
    expect(shows(["people:view"], "person", "personal")).toBe(false);
    expect(shows(["people:view", "personal:view"], "person", "personal")).toBe(
      true,
    );
  });

  it("take a tier the server no longer knows as the most sensitive", () => {
    expect(shows(["people:view", "personal:view"], "person", "secret")).toBe(
      false,
    );
  });

  it("are a hire's own details at any class to a role that sees the hiring plan", () => {
    const hiring: Permission[] = [
      "people:view",
      "hiring-plan:view",
      "confidential:view",
    ];

    expect(shows(hiring, "planned-hire", "personal", "targetDate")).toBe(true);
    expect(shows(hiring, "planned-hire", "personal", "value:column")).toBe(
      false,
    );
    expect(shows(["people:view"], "planned-hire")).toBe(false);
  });

  it("are a feature team's to a role that sees feature teams", () => {
    expect(shows(["feature-teams:view"], "feature-team")).toBe(true);
    expect(shows(["people:view"], "feature-team")).toBe(false);
  });

  it("are the plan's General changes to a role that reads the plan", () => {
    const plan = startingRoles["product-manager"].permissions;

    expect(shows(plan, "project")).toBe(true);
    expect(shows([...plan, "personal:view"], "project", "personal")).toBe(
      false,
    );
  });
});
