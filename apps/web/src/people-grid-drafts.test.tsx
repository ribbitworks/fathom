// SPDX-License-Identifier: Apache-2.0

// Tests for the people as the Draft menu shows them: live people and links with drafts taken back,
// and drafts applied or shown beside live.

import type { Person } from "@fathom/shared";
import { describe, expect, it } from "vitest";
import { livePeople, peopleAsShown } from "./people-grid.tsx";

describe("the live people", () => {
  const draft = {
    state: "waiting" as const,
    madeBy: null,
    madeAt: null,
    changed: [],
    live: { values: {}, links: {} },
  };
  const person = (id: string, more: Partial<Person> = {}): Person => ({
    id,
    keyNumber: 1,
    preferredName: `Fictional ${id}`,
    employeeId: id,
    positionId: "position-1",
    startDate: "2024-01-01",
    endDate: null,
    values: {},
    links: {},
    ...more,
  });

  it("leaves out those only drafted to be added, and puts back what drafts change", () => {
    expect(
      livePeople([
        person("p1"),
        person("p2", { draft: { ...draft, action: "created" } }),
        person("p3", { draft: { ...draft, action: "deleted" } }),
        person("p4", {
          preferredName: "Fictional Renamed",
          endDate: "2027-01-01",
          values: { f1: ["c2"], f2: ["c9"], f3: ["c5"] },
          draft: {
            ...draft,
            action: "changed",
            changed: ["preferredName", "endDate", "f1", "f2", "f4"],
            live: {
              preferredName: "Fictional p4",
              values: { f1: ["c1"], f2: [] },
              links: {},
            },
          },
        }),
      ]),
    ).toEqual([
      person("p1"),
      person("p3"),
      person("p4", { endDate: null, values: { f3: ["c5"], f1: ["c1"] } }),
    ]);
  });
});

describe("the live links", () => {
  it("puts back each link a draft changes, keeping the rest", () => {
    const kept = { address: "https://kept.example.test/", text: "" };
    const live = { address: "https://live.example.test/", text: "Live" };
    const [person] = livePeople([
      {
        id: "p1",
        keyNumber: 1,
        preferredName: "Fictional p1",
        employeeId: "p1",
        positionId: "position-1",
        values: {},
        links: {
          f1: { address: "https://drafted.example.test/", text: "" },
          f2: kept,
          f3: { address: "https://added.example.test/", text: "" },
        },
        draft: {
          action: "changed",
          changed: ["f1", "f3"],
          live: { values: {}, links: { f1: live } },
          state: "waiting",
          madeBy: null,
          madeAt: null,
        },
      },
    ]);
    expect(person?.links).toEqual({ f2: kept, f1: live });
  });
});

describe("people as the Draft menu shows them", () => {
  const someone = (id: string, details: Partial<Person> = {}): Person => ({
    id,
    keyNumber: 1,
    preferredName: `Fictional ${id}`,
    employeeId: `E${id}`,
    values: {},
    links: {},
    ...details,
  });
  const drafted = (
    action: "created" | "changed" | "deleted",
    state: "waiting" | "rejected" = "waiting",
    changes: Partial<Person> = {},
  ): Partial<Person> => ({
    ...changes,
    draft: {
      action,
      changed: Object.keys(changes),
      live: { preferredName: "Fictional live", values: {}, links: {} },
      state,
      madeBy: null,
      madeAt: null,
    },
  });
  const people = [
    someone("1"),
    someone("2", drafted("changed", "waiting", { preferredName: "Renamed" })),
    someone("3", drafted("changed", "rejected", { preferredName: "Refused" })),
    someone("4", drafted("deleted")),
    someone("5", drafted("created")),
    someone("6", drafted("created", "rejected")),
  ];
  const names = (show: "both" | "drafts" | "live") =>
    peopleAsShown(people, show).map(({ preferredName }) => preferredName);

  it("shows everyone as drafted beside live", () => {
    expect(names("both")).toEqual([
      "Fictional 1",
      "Renamed",
      "Refused",
      "Fictional 4",
      "Fictional 5",
      "Fictional 6",
    ]);
  });

  it("applies waiting drafts, takes rejected ones back, and leaves out those removed or only refused", () => {
    expect(names("drafts")).toEqual([
      "Fictional 1",
      "Renamed",
      "Fictional live",
      "Fictional 5",
    ]);
  });

  it("shows those live as they are", () => {
    expect(names("live")).toEqual([
      "Fictional 1",
      "Fictional live",
      "Fictional live",
      "Fictional 4",
    ]);
  });
});
