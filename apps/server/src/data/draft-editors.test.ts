// SPDX-License-Identifier: Apache-2.0

// Tests for which kinds of draft each starting role may change.

import {
  type DraftKind,
  draftKinds,
  type Role,
  roleSchema,
} from "@fathom/shared";
import { fictionalUser as user } from "@fathom/test-utils";
import { describe, expect, it } from "vitest";
import { actorFor } from "../access.ts";
import { editsDraft, editsKind, recordEditor } from "./draft-editors.ts";

const thePlan: readonly DraftKind[] = [
  "release-stream",
  "cycle-pattern",
  "release",
  "feature",
  "customer",
  "proposal",
  "project",
  "milestone",
  "project-activity",
  "release-activity",
];

const configuration: readonly DraftKind[] = [
  "list",
  "list-item",
  "choice-order",
  "planning-settings",
];

// The kinds of draft each starting role changes, as Roles sets out; every other kind it doesn't. A
// column's drafts go by the column's table, tested below.
const changedBy: Record<Role, readonly DraftKind[]> = {
  "team-member": [],
  "product-manager": thePlan,
  "feature-lead": ["release", "feature", "release-activity", "feature-team"],
  "project-manager": thePlan,
  "engineering-manager": [...thePlan, "allocation", "feature-team"],
  "engineering-director": draftKinds.filter((kind) => kind !== "field"),
  "workforce-administrator": [
    "release-stream",
    "cycle-pattern",
    ...configuration,
    "person",
    "planned-hire",
    "feature-team",
  ],
  executive: [],
  administrator: [],
};

describe("the kinds of draft each starting role changes", () => {
  for (const role of roleSchema.options) {
    it(`gives the ${role} its own kinds, and none of the rest`, () => {
      const actor = actorFor(user, role);
      const allowed = draftKinds.filter((kind) => editsDraft(actor, kind));
      // The role is always one of the fixed roles.
      // eslint-disable-next-line security/detect-object-injection
      const own = changedBy[role];
      expect(allowed).toEqual(draftKinds.filter((kind) => own.includes(kind)));
    });
  }

  it("changes no kind Fathom no longer has", () => {
    expect(
      editsDraft(actorFor(user, "engineering-director"), "fictional-kind"),
    ).toBe(false);
  });
});

describe("the drafts of a column", () => {
  const people = { tableName: "people" };
  const features = { tableName: "features" };

  it.each([
    ["product-manager", false, true],
    ["feature-lead", false, true],
    ["project-manager", false, true],
    ["engineering-manager", false, true],
    ["engineering-director", true, true],
    ["workforce-administrator", true, false],
    ["team-member", false, false],
  ] as const)(
    "go by the column's table: the %s changes People's %s and Features' %s",
    (role, onPeople, onFeatures) => {
      const actor = actorFor(user, role);
      expect(editsDraft(actor, "field", people)).toBe(onPeople);
      expect(editsDraft(actor, "field", features)).toBe(onFeatures);
    },
  );

  it("are changed by nobody when the column is unknown", () => {
    expect(editsDraft(actorFor(user, "engineering-director"), "field")).toBe(
      false,
    );
  });
});

describe("changing allocations", () => {
  it("needs the allocations' Personal data as well as Edit Allocations", () => {
    const editor = actorFor(user, "engineering-manager");
    const unseeing = {
      ...editor,
      permissions: editor.permissions.filter((one) => one !== "personal:view"),
    };

    expect(editsKind(unseeing, "allocation")).toBe(false);
    expect(() => recordEditor(unseeing, "allocation")).toThrow(/Personal/u);
    expect(recordEditor(editor, "allocation")).toBe(editor);
  });

  it("refuses without saying why to a role that can't edit them", () => {
    expect(() =>
      recordEditor(actorFor(user, "team-member"), "allocation"),
    ).toThrow(/^Forbidden$/u);
  });
});
