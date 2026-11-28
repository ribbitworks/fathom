// SPDX-License-Identifier: Apache-2.0

// Tests for the pages a last view is kept for, the tables each shows, and the last view's schemas.

import { describe, expect, it } from "vitest";
import {
  firstTables,
  lastViewModes,
  lastViewRequestSchema,
  lastViewsSchema,
  viewPageOf,
  viewPageSchema,
} from "./last-views.ts";

describe("the pages a last view is kept for", () => {
  it("open on a table of their own", () => {
    expect(
      viewPageSchema.options.filter(
        // The page is always one of the fixed pages.
        // eslint-disable-next-line security/detect-object-injection
        (page) => viewPageOf[firstTables[page]] !== page,
      ),
    ).toEqual([]);
  });

  it("offer a mode only on Features", () => {
    expect(Object.keys(lastViewModes)).toEqual(["features"]);
    expect(lastViewModes.features?.safeParse("board").success).toBe(true);
  });
});

describe("a last view as a page sends it", () => {
  const sent = { table: "proposals", definition: { search: "new" } };

  it("keeps its table, view, saved view and mode", () => {
    const whole = {
      ...sent,
      view: "20000000-0000-4000-8000-000000000001",
      mode: "board",
    };
    expect(lastViewRequestSchema.parse(whole)).toEqual(whole);
  });

  it.each([
    ["a table no page shows", { ...sent, table: "settings" }],
    ["a saved view that is not an identifier", { ...sent, view: "mine" }],
    ["a mode longer than any page's", { ...sent, mode: "x".repeat(21) }],
  ])("is refused with %s", (_, request) => {
    expect(lastViewRequestSchema.safeParse(request).success).toBe(false);
  });
});

describe("the last views a reader is sent", () => {
  it("are each under a page with a Views menu", () => {
    const people = { table: "people", definition: {} };
    expect(lastViewsSchema.parse({ people })).toEqual({ people });
    expect(lastViewsSchema.safeParse({ settings: people }).success).toBe(false);
  });
});
