// SPDX-License-Identifier: Apache-2.0

// Tests for the values a record holds in the columns added to its table.

import { describe, expect, it } from "vitest";
import {
  askedColumnIds,
  columnValueMaps,
  columnValueMapsOf,
  columnValuesIn,
  noColumnValues,
  optionalColumnValueMaps,
  requestedColumnValueMapsOf,
  type SomeColumnValues,
  type SomeRequestedColumnValues,
} from "./column-values.ts";

describe("values in added columns", () => {
  it("names the columns values are asked for in, choices first, then each map sent", () => {
    expect(
      askedColumnIds({
        flags: { c5: true },
        values: { c1: [] },
        links: { c2: null },
        notes: { c3: "Ready" },
      }),
    ).toEqual(["c1", "c2", "c3", "c5"]);
  });

  it("keeps a record's maps alone, with every map empty when none hold values", () => {
    const record = {
      ...noColumnValues(),
      values: { c1: ["v1"] },
      notes: { c3: "Ready" },
    };

    expect(columnValuesIn(record)).toEqual({
      links: {},
      notes: { c3: "Ready" },
      numbers: {},
      flags: {},
    });
  });

  it("leaves out each map given no values", () => {
    const given: SomeColumnValues = { numbers: { c4: 2 } };

    expect(
      columnValueMapsOf(
        optionalColumnValueMaps,
        // The map is one of those given.
        // eslint-disable-next-line security/detect-object-injection
        (map) => given[map],
      ),
    ).toEqual({ numbers: { c4: 2 } });
  });

  it("leaves out each map asked for in with no values", () => {
    const asked: SomeRequestedColumnValues = { flags: { c5: null } };

    expect(
      requestedColumnValueMapsOf(
        columnValueMaps,
        // The map is one of those asked for in.
        // eslint-disable-next-line security/detect-object-injection
        (map) => asked[map],
      ),
    ).toEqual({ flags: { c5: null } });
  });
});
