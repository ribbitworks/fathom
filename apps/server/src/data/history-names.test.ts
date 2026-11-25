// SPDX-License-Identifier: Apache-2.0

// Tests for what the change history names a changed value of a kind the reader can't read.

import { defaultClasses, type Permission } from "@fathom/shared";
import { describe, expect, it } from "vitest";
import type { StoredChange } from "./changes.ts";
import { unseenValueName } from "./history-names.ts";

const row = (recordType: string, field: string) =>
  ({ recordType, field }) as StoredChange;

describe("a changed value the reader can't read", () => {
  it.each<[string, string, string, Permission[], string | undefined]>([
    [
      "a project's features",
      "project",
      "featureIds",
      ["plan:view"],
      "A feature",
    ],
    [
      "a proposal's removal reasons",
      "proposal",
      "removalReasons",
      ["plan:view"],
      "A feature",
    ],
    [
      "a feature's customers",
      "feature",
      "customerIds",
      ["features:view"],
      "A customer",
    ],
    [
      "a project's features, to a role that reads features",
      "project",
      "featureIds",
      ["plan:view", "features:view"],
      undefined,
    ],
    [
      "a field that names no record",
      "project",
      "name",
      ["plan:view"],
      undefined,
    ],
  ])(
    "names %s as the reader may read it",
    (_, type, field, permissions, named) => {
      expect(
        unseenValueName(row(type, field), {
          permissions,
          dataClasses: defaultClasses,
        }),
      ).toBe(named);
    },
  );
});
