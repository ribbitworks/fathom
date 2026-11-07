// SPDX-License-Identifier: Apache-2.0

// Tests for planned hires: what a request to add or change a hire accepts, and how a hire's
// temporary ID is written.

import { describe, expect, it } from "vitest";
import {
  hireChangeSchema,
  hireRequestSchema,
  hiringMeaningSchema,
  temporaryId,
} from "./hires.ts";
import { meaningsOf } from "./lists.ts";
import { personLengths } from "./people.ts";

const position = "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d";
const manager = "6f1c2b9e-4d3a-4f8b-9c7e-2a1b3c4d5e6f";
const state = "7a8b9c0d-1e2f-4a3b-8c4d-5e6f7a8b9c0d";

describe("hiring meanings and temporary IDs", () => {
  it("are those of the hiring states list but Hired, which is people's", () => {
    expect(hiringMeaningSchema.options).toEqual(
      meaningsOf("hiring-states").filter((meaning) => meaning !== "hired"),
    );
  });

  it("writes a temporary ID as TBD- and its number", () => {
    expect(temporaryId(7)).toBe("TBD-7");
  });
});

describe("adding a hire", () => {
  it("gives it no name, a temporary ID, no target date, and no manager unless told otherwise", () => {
    expect(hireRequestSchema.parse({ positionId: position })).toEqual({
      name: null,
      requisition: null,
      positionId: position,
      targetDate: null,
      managerId: null,
    });
  });

  it("takes a name, a requisition, a target date, a state, and a manager", () => {
    expect(
      hireRequestSchema.parse({
        name: " Backend engineer 3 ",
        requisition: " REQ-1042 ",
        positionId: position,
        targetDate: "2027-03-01",
        stateId: state,
        managerId: manager,
      }),
    ).toEqual({
      name: "Backend engineer 3",
      requisition: "REQ-1042",
      positionId: position,
      targetDate: "2027-03-01",
      stateId: state,
      managerId: manager,
    });
  });

  it.each([
    ["no position", { positionId: undefined }],
    ["an empty name", { name: "  " }],
    ["an empty requisition", { requisition: "  " }],
    [
      "a requisition too long",
      { requisition: "x".repeat(personLengths.employeeId + 1) },
    ],
    ["a requisition that looks like a temporary ID", { requisition: "tbd-12" }],
    ["a date that is not a day", { targetDate: "2027-03" }],
    ["a state that is not an identifier", { stateId: "open" }],
    ["a manager that is not an identifier", { managerId: "someone" }],
  ])("refuses %s", (_what, wrong) => {
    expect(
      hireRequestSchema.safeParse({ positionId: position, ...wrong }).success,
    ).toBe(false);
  });
});

describe("changing a hire", () => {
  it("takes any of its details alone", () => {
    expect(hireChangeSchema.parse({ stateId: state })).toEqual({
      stateId: state,
    });
    expect(hireChangeSchema.parse({ managerId: null })).toEqual({
      managerId: null,
    });
  });

  it("clears the requisition and the target date with null", () => {
    expect(
      hireChangeSchema.parse({ requisition: null, targetDate: null }),
    ).toEqual({ requisition: null, targetDate: null });
  });
});
