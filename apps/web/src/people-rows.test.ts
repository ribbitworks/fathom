// SPDX-License-Identifier: Apache-2.0

// Tests for the People table's two kinds of row: what a planned hire is called, and what a request
// to add one or a change to one becomes for the server.

import type { Person } from "@fathom/shared";
import { describe, expect, it } from "vitest";
import { hireChange, hireRequest } from "./hires.ts";
import {
  addedNames,
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
