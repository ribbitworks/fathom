// SPDX-License-Identifier: Apache-2.0

// Tests where a draft's Show on link leads, what it names the page, and what opening it needs.

import {
  capacityModeNeeds,
  type LinkedRecord,
  type PageNeeds,
  pageNeeds,
} from "@fathom/shared";
import { describe, expect, it } from "vitest";
import { shownPlace } from "./draft-places.ts";

describe("where a draft's record is shown", () => {
  it.each<[LinkedRecord, string, PageNeeds]>([
    [{ kind: "person", keyNumber: 3 }, "People", pageNeeds.people],
    [{ kind: "hire", keyNumber: 4 }, "People", pageNeeds.people],
    [
      { kind: "column", keyNumber: 5, table: "people" },
      "People",
      pageNeeds.people,
    ],
    [
      { kind: "column", keyNumber: 6, table: "features" },
      "Features",
      pageNeeds.features,
    ],
    [{ kind: "list", keyNumber: 7 }, "Lists", pageNeeds.lists],
    [{ kind: "release", keyNumber: 8 }, "Releases", pageNeeds.releases],
    [{ kind: "schedule", keyNumber: 9 }, "Releases", pageNeeds.releases],
    [{ kind: "team", keyNumber: 10 }, "org chart", pageNeeds["org-chart"]],
    [{ kind: "feature", keyNumber: 11 }, "Features", pageNeeds.features],
    [{ kind: "project", keyNumber: 12 }, "Projects", pageNeeds.projects],
    [{ kind: "proposal", keyNumber: 13 }, "Projects", pageNeeds.projects],
    [{ kind: "customer", keyNumber: 14 }, "Projects", pageNeeds.projects],
    [{ kind: "milestone", keyNumber: 15 }, "Projects", pageNeeds.projects],
  ])("links a %o by its key, on %s", (record, pageName, needs) => {
    expect(shownPlace(record)).toEqual({
      pageName,
      needs,
      address: {
        to: "/go/$kind/$keyNumber",
        params: { kind: record.kind, keyNumber: String(record.keyNumber) },
      },
    });
  });

  it("links the planning settings to Capacity's Settings", () => {
    expect(shownPlace("capacity-settings")).toEqual({
      pageName: "Capacity",
      needs: [capacityModeNeeds.settings],
      address: { to: "/capacity", search: { mode: "settings" } },
    });
  });
});
