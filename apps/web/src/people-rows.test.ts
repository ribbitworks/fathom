// SPDX-License-Identifier: Apache-2.0

// Tests for the People table's two kinds of row: what a planned hire is called, what a request to
// add one or a change to one becomes for the server, and how a month counts each kind.

import type { Person } from "@fathom/shared";
import { describe, expect, it } from "vitest";
import { hireChange, hireRequest } from "./hires.ts";
import {
  addedNames,
  monthCount,
  noticeName,
  personOnly,
  plannedHireName,
  rowName,
} from "./people-rows.ts";
import { positions } from "./test-support.tsx";

const hire: Person = {
  id: "h1",
  keyNumber: 1,
  kind: "planned-hire",
  preferredName: "",
  employeeId: "TBD-7",
  positionId: "position-1",
  values: {},
  links: {},
};

describe("a row's name", () => {
  it("is a planned hire's own, or its position and ID, or its ID to those who cannot see positions", () => {
    expect(
      rowName({ ...hire, preferredName: "Fictional opening" }, [positions]),
    ).toBe("Fictional opening");
    expect(rowName(hire, [positions])).toBe("Fictional Engineer, TBD-7");
    expect(rowName(hire, [])).toBe("TBD-7");
  });
});

describe("a planned hire's name in a sentence", () => {
  it("says it is a planned hire", () => {
    expect(plannedHireName(hire, [positions])).toBe(
      "the planned hire Fictional Engineer, TBD-7",
    );
  });
});

describe("a row's name in a notice", () => {
  it("is a person's preferred name alone", () => {
    expect(
      noticeName(
        {
          ...hire,
          id: "p1",
          kind: "person",
          preferredName: "Fictional Person",
          employeeId: "E-1",
        },
        [positions],
      ),
    ).toBe("Fictional Person");
  });
});

describe("what a planned hire's row sends", () => {
  it("adds a hire with no name or requisition when they are left empty, in the state chosen, if any", () => {
    const request = {
      preferredName: " ",
      employeeId: "",
      positionId: "position-1",
      values: {},
      links: {},
    };
    expect(hireRequest(request)).toEqual({
      name: null,
      requisition: null,
      positionId: "position-1",
      targetDate: null,
      managerId: null,
      isManager: false,
      values: {},
      links: {},
    });
    expect(
      hireRequest({
        ...request,
        preferredName: "Fictional opening",
        employeeId: "REQ-1",
        startDate: "2027-03-01",
        managerId: "p1",
        isManager: true,
        stateId: "s1",
      }),
    ).toEqual({
      name: "Fictional opening",
      requisition: "REQ-1",
      positionId: "position-1",
      targetDate: "2027-03-01",
      managerId: "p1",
      isManager: true,
      stateId: "s1",
      values: {},
      links: {},
    });
  });

  it("keeps a hire's values in added columns, as a person's are", () => {
    const values = { f1: ["c1"] };
    const links = { f2: { address: "https://example.test/", text: "" } };
    const notes = { f3: "Fictional note" };
    expect(hireChange({ values, links, notes })).toEqual({
      values,
      links,
      notes,
    });
    expect(
      hireRequest({
        preferredName: "",
        employeeId: "",
        positionId: "position-1",
        values,
        links,
        notes,
      }).notes,
    ).toEqual(notes);
  });

  it("changes only what a change to the row holds, a start date being the target date", () => {
    expect(hireChange({})).toEqual({});
    expect(
      hireChange({
        preferredName: "",
        employeeId: "REQ-2",
        positionId: "position-1",
        startDate: null,
        stateId: "s2",
        managerId: null,
        isManager: true,
      }),
    ).toEqual({
      name: null,
      requisition: "REQ-2",
      positionId: "position-1",
      targetDate: null,
      stateId: "s2",
      managerId: null,
      isManager: true,
    });
  });

  it("leaves a person's request without the kind of row it was made in", () => {
    expect(
      personOnly({
        kind: "person",
        stateId: "s1",
        preferredName: "Avery Fictional",
        employeeId: "E1",
        positionId: "position-1",
        values: {},
        links: {},
      }),
    ).toEqual({
      stateId: "s1",
      preferredName: "Avery Fictional",
      employeeId: "E1",
      positionId: "position-1",
      values: {},
      links: {},
    });
  });
});

describe("what a notice calls the rows being added", () => {
  it("says people, planned hires, or both", () => {
    const person = {
      preferredName: "Avery Fictional",
      employeeId: "E1",
      positionId: "position-1",
      values: {},
      links: {},
    };
    const opening = { ...person, kind: "planned-hire" as const };
    expect(addedNames([person])).toBe("the person");
    expect(addedNames([opening])).toBe("the planned hire");
    expect(addedNames([person, person])).toBe("the people");
    expect(addedNames([opening, opening])).toBe("the planned hires");
    expect(addedNames([person, opening])).toBe("the people and planned hires");
  });
});

describe("a planned hire's numbers", () => {
  it("are sent when adding a hire and when changing one", () => {
    const row = {
      preferredName: "Fictional opening",
      employeeId: "",
      positionId: "position-1",
      values: {},
      links: {},
      numbers: { f1: 0 },
    };
    expect(hireRequest(row).numbers).toEqual({ f1: 0 });
    expect(hireChange({ numbers: { f1: null } }).numbers).toEqual({
      f1: null,
    });
  });
});

describe("a month's count of people and planned hires", () => {
  const rows = (people: number, hires: number) => [
    ...Array.from({ length: people }, () => ({ hire: false })),
    ...Array.from({ length: hires }, () => ({ hire: true })),
  ];
  const isHire = ({ hire }: { hire: boolean }) => hire;
  const counted = (
    all: ReturnType<typeof rows>,
    shown?: ReturnType<typeof rows>,
  ) => monthCount("Nov 2026", isHire, all, shown);

  it.each([
    [
      "people and planned hires",
      rows(14, 1),
      "Nov 2026: 14 people, 1 planned hire",
    ],
    ["people only", rows(3, 0), "Nov 2026: 3 people"],
    ["planned hires only", rows(0, 2), "Nov 2026: 2 planned hires"],
    ["no one", rows(0, 0), "Nov 2026: 0 people"],
  ])(
    "names the month first, then %s, with nothing narrowing the rows",
    (_, all, words) => {
      expect(counted(all)).toBe(words);
    },
  );

  it.each([
    [
      "people alone, leaving out planned hires none of which are shown",
      rows(6, 0),
      "Nov 2026: 6 of 14 people",
    ],
    [
      "both kinds, when both are shown",
      rows(4, 1),
      "Nov 2026: 4 of 14 people, 1 of 1 planned hire",
    ],
    [
      "planned hires alone, when no people are shown",
      rows(0, 1),
      "Nov 2026: 1 of 1 planned hire",
    ],
    ["people, when no one is shown", rows(0, 0), "Nov 2026: 0 of 14 people"],
  ])("counts %s while something narrows the rows", (_, shown, words) => {
    expect(counted(rows(14, 1), shown)).toBe(words);
  });

  it("names planned hires when a month has no people and none of its rows are shown", () => {
    expect(counted(rows(0, 2), rows(0, 0))).toBe(
      "Nov 2026: 0 of 2 planned hires",
    );
  });
});
