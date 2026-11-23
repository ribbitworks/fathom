// SPDX-License-Identifier: Apache-2.0

// Tests for each view table's choices, Features' and the Org chart's among them: the parameters its
// page keeps in a view, which a request must fit as a whole; and for who shares each table's views.

import { describe, expect, it } from "vitest";
import {
  sharesViews,
  viewChoiceSchemas,
  viewTableSchema,
} from "./view-tables.ts";

const stream = "6f1d6a52-0c1e-4a51-9b0f-1d2c3e4f5a6b";
const lead = "1b2c3d4e-5f60-4a71-8b92-a3b4c5d6e7f8";

describe("Features' choices", () => {
  const fits = (choices: object) =>
    viewChoiceSchemas.features.safeParse(choices).success;

  it("accepts the Board's stream and the card parts hidden", () => {
    expect(fits({ stream, hide: ["status", "size"] })).toBe(true);
    expect(fits({})).toBe(true);
  });

  it.each([
    [
      "the table or the board, which the two share a view across",
      { mode: "board" },
    ],
    ["a stream that isn't an identifier", { stream: "Platform" }],
    ["a card part it doesn't have", { hide: ["colour"] }],
    ["a card part twice", { hide: ["status", "status"] }],
    ["a choice it doesn't keep", { from: "2026-01-01" }],
  ])("refuses %s", (_, choices) => {
    expect(fits(choices)).toBe(false);
  });
});

describe("the Org chart's choices", () => {
  const fits = (choices: object) =>
    viewChoiceSchemas["org-chart"].safeParse(choices).success;

  it("accepts feature teams, the levels shown and the team shown alone", () => {
    expect(fits({ teams: "feature", levels: "3", team: lead })).toBe(true);
    expect(fits({ levels: "all" })).toBe(true);
    expect(fits({ levels: "999" })).toBe(true);
    expect(fits({})).toBe(true);
  });

  it.each([
    ["reporting teams, which is what it starts with", { teams: "reporting" }],
    ["no levels", { levels: "0" }],
    ["levels that aren't a count", { levels: "two" }],
    ["levels written with a leading zero", { levels: "03" }],
    ["more levels than any chart has", { levels: "1000" }],
    ["levels as a number", { levels: 3 }],
    ["a team by its manager's Employee ID", { team: "E-1042" }],
    ["the day, which a view doesn't keep", { day: "2026-12-01" }],
  ])("refuses %s", (_, choices) => {
    expect(fits(choices)).toBe(false);
  });
});

describe("the Drafts page's choices", () => {
  const fits = (choices: object) =>
    viewChoiceSchemas.drafts.safeParse(choices).success;

  it.each(["decide", "unpublished", "all"])("keeps the %s tab", (tab) => {
    expect(fits({ tab })).toBe(true);
  });

  it("keeps no tab, for the reader's first", () => {
    expect(fits({})).toBe(true);
  });

  it.each([
    ["a tab the page doesn't have", { tab: "theirs" }],
    ["the tab's old name for one's own changes", { tab: "mine" }],
    ["the old choice of drafts to decide", { decide: "mine" }],
    ["another page's choice", { hide: ["status"] }],
  ])("refuses %s", (_, choices) => {
    expect(fits(choices)).toBe(false);
  });
});

describe("Releases' choices", () => {
  const fits = (choices: object) =>
    viewChoiceSchemas.releases.safeParse(choices).success;

  it("accepts shipped releases shown, or nothing chosen", () => {
    expect([fits({ shipped: "shown" }), fits({})]).toEqual([true, true]);
  });

  it.each([
    ["shipped releases set any other way", { shipped: "hidden" }],
    ["a choice it doesn't keep", { hide: ["status"] }],
  ])("refuses %s", (_, choices) => {
    expect(fits(choices)).toBe(false);
  });
});

describe("Cycles' choices", () => {
  const fits = (choices: object) =>
    viewChoiceSchemas.cycles.safeParse(choices).success;

  it("accepts past or later cycles shown, both, or nothing chosen", () => {
    expect([
      fits({ past: "shown" }),
      fits({ later: "shown" }),
      fits({ past: "shown", later: "shown" }),
      fits({}),
    ]).toEqual([true, true, true, true]);
  });

  it.each([
    ["past cycles set any other way", { past: "hidden" }],
    ["later cycles set any other way", { later: "hidden" }],
    ["shipped releases, which only Releases keeps", { shipped: "shown" }],
  ])("refuses %s", (_, choices) => {
    expect(fits(choices)).toBe(false);
  });
});

describe("Allocations' choices", () => {
  const fits = (choices: object) =>
    viewChoiceSchemas.capacity.safeParse(choices).success;

  it("accepts the rows over kept, those under, both, or nothing chosen", () => {
    expect([
      fits({ over: "shown" }),
      fits({ under: "shown" }),
      fits({ over: "shown", under: "shown" }),
      fits({}),
    ]).toEqual([true, true, true, true]);
  });

  it.each([
    ["the rows over set any other way", { over: "hidden" }],
    ["the rows under set any other way", { under: "hidden" }],
    ["past cycles, which only Cycles keeps", { past: "shown" }],
  ])("refuses %s", (_, choices) => {
    expect(fits(choices)).toBe(false);
  });
});

const keepsChoices = new Set([
  "capacity",
  "features",
  "releases",
  "cycles",
  "org-chart",
  "drafts",
]);

describe("the choices of tables whose pages keep none", () => {
  it.each(viewTableSchema.options.filter((table) => !keepsChoices.has(table)))(
    "refuses any choice on %s, and accepts none",
    (table) => {
      // The table is always one of the fixed tables.
      // eslint-disable-next-line security/detect-object-injection
      const choices = viewChoiceSchemas[table];
      expect(choices.safeParse({}).success).toBe(true);
      expect(choices.safeParse({ hide: ["status"] }).success).toBe(false);
    },
  );
});

describe("Sharing views", () => {
  const sharers = {
    people: ["people:edit"],
    "org-chart": ["people:edit"],
    features: ["features:edit"],
    releases: ["features:edit"],
    projects: ["plan:edit"],
    proposals: ["plan:edit"],
    customers: ["plan:edit"],
    milestones: ["plan:edit"],
    cycles: ["plan:edit", "configuration:edit"],
    "release-streams": ["plan:edit", "configuration:edit"],
    capacity: ["allocations:edit"],
    "feature-assignments": ["feature-teams:edit"],
    lists: ["configuration:edit"],
    drafts: ["configuration:edit"],
    accounts: ["administration:edit"],
  } as const;
  const permissions = [...new Set(Object.values(sharers).flat())];

  it("names a sharer for every table", () => {
    expect(Object.keys(sharers).sort()).toEqual(
      [...viewTableSchema.options].sort(),
    );
  });

  it.each(Object.entries(sharers))(
    "shares %s's views with any of %j, which edit its records, alone",
    (table, own: readonly string[]) => {
      const viewTable = viewTableSchema.parse(table);
      for (const sharer of own) {
        expect(sharesViews(viewTable, [sharer])).toBe(true);
      }
      for (const other of permissions.filter((one) => !own.includes(one))) {
        expect(sharesViews(viewTable, [other])).toBe(false);
      }
    },
  );
});
