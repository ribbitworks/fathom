// SPDX-License-Identifier: Apache-2.0

// Tests for a draft's details in words: what it does, or each field it changes, with who changed it.

import { describe, expect, it } from "vitest";
import type { Person } from "@fathom/shared";
import {
  configDraftFields,
  draftLines,
  personDraftFields,
} from "./draft-details.tsx";
import { phraseText } from "./phrase.tsx";

const draft = {
  madeBy: "Fictional Editor",
  editors: ["Fictional Editor"],
};

describe("a draft's details", () => {
  it("names who added or removed a record, or changed it when no field is shown", () => {
    expect(
      draftLines({ ...draft, action: "created" }, []).map(phraseText),
    ).toEqual(["Added by Fictional Editor"]);
    expect(
      draftLines({ ...draft, action: "deleted" }, []).map(phraseText),
    ).toEqual(["Removed by Fictional Editor"]);
    expect(
      draftLines({ ...draft, action: "changed", madeBy: null }, []).map(
        phraseText,
      ),
    ).toEqual(["Changed by Fathom"]);
  });

  it("names the role who last changed a draft acted as, beside their name", () => {
    const madeAs = { ...draft, madeAs: "Feature Lead" };
    expect(
      draftLines({ ...madeAs, action: "created" }, []).map(phraseText),
    ).toEqual(["Added by Fictional Editor as Feature Lead"]);
    expect(
      draftLines({ ...madeAs, action: "deleted" }, []).map(phraseText),
    ).toEqual(["Removed by Fictional Editor as Feature Lead"]);
    expect(
      draftLines(
        { ...madeAs, action: "changed" },
        configDraftFields(
          { action: "changed", changed: ["description"], live: {} },
          { description: "" },
        ),
      ).map(phraseText),
    ).toEqual(["Description changed, by Fictional Editor as Feature Lead"]);
  });

  it("names who changed each field, or who last changed the draft when that is not recorded", () => {
    const changed = configDraftFields(
      { action: "changed", changed: ["label", "description"], live: {} },
      { label: "North", description: "" },
    );
    expect(
      draftLines(
        {
          ...draft,
          action: "changed",
          changedBy: { label: "Second Fictional Editor" },
        },
        changed,
      ).map(phraseText),
    ).toEqual([
      "Name set to North, by Second Fictional Editor",
      "Description changed, by Fictional Editor",
    ]);
    expect(
      configDraftFields({ action: "created", changed: [], live: {} }, {}),
    ).toEqual([]);
    expect(
      configDraftFields(
        { action: "changed", changed: ["description"], live: {} },
        {},
      ),
    ).toEqual([
      {
        key: "description",
        field: { field: "description", oldValue: null, newValue: null },
      },
    ]);
  });

  it("names a person's old and new managers, the date, and their team's name", () => {
    const someone = (id: string, preferredName: string): Person => ({
      id,
      preferredName,
      employeeId: id,
      positionId: "position-1",
      values: {},
      links: {},
    });
    const person: Person = {
      ...someone("p1", "Fictional Report"),
      manager: { id: "m2", preferredName: "Fictional New Manager" },
      managerFrom: "2026-10-01",
      teamName: "Fictional Team",
    };
    const fields = personDraftFields(
      person,
      {
        action: "changed",
        changed: ["managerId", "managerFrom", "teamName"],
        live: {
          managerId: "m1",
          managerFrom: "2024-03-01",
          values: {},
          links: {},
        },
        state: "waiting",
        madeBy: null,
        madeAt: null,
      },
      [],
      [],
      [someone("m1", "Fictional Old Manager")],
    );
    expect(fields.map(({ field }) => field)).toEqual([
      {
        field: "managerId",
        oldValue: "Fictional Old Manager",
        newValue: "Fictional New Manager",
      },
      { field: "managerFrom", oldValue: "2024-03-01", newValue: "2026-10-01" },
      { field: "teamName", oldValue: null, newValue: "Fictional Team" },
    ]);
  });

  it("words a past manager not among the people shown as someone not shown, never none", () => {
    const [field] = personDraftFields(
      {
        id: "p3",
        preferredName: "Fictional Moved Report",
        employeeId: "p3",
        positionId: "position-1",
        values: {},
        links: {},
      },
      {
        action: "changed",
        changed: ["managerId"],
        live: { managerId: "gone", values: {}, links: {} },
        state: "waiting",
        madeBy: null,
        madeAt: null,
      },
      [],
      [],
      [],
    );
    expect(field?.field.oldValue).toBe("Someone not shown in People");
  });

  it("leaves an old manager unnamed when no people are given", () => {
    const [field] = personDraftFields(
      {
        id: "p4",
        preferredName: "Fictional Menu Report",
        employeeId: "p4",
        positionId: "position-1",
        values: {},
        links: {},
      },
      {
        action: "changed",
        changed: ["managerId"],
        live: { managerId: "m1", values: {}, links: {} },
        state: "waiting",
        madeBy: null,
        madeAt: null,
      },
      [],
      [],
    );
    expect(field?.field.oldValue).toBeNull();
  });

  it("words a person added with no manager or team as having none", () => {
    const fields = personDraftFields(
      {
        id: "p2",
        preferredName: "Fictional Starter",
        employeeId: "p2",
        positionId: "position-1",
        values: {},
        links: {},
      },
      {
        action: "created",
        changed: ["managerId", "managerFrom", "teamName"],
        live: { values: {}, links: {} },
        state: "waiting",
        madeBy: null,
        madeAt: null,
      },
      [],
      [],
    );
    expect(fields.map(({ field }) => field.newValue)).toEqual([
      null,
      null,
      null,
    ]);
    expect(fields.map(({ field }) => field.oldValue)).toEqual([
      null,
      null,
      null,
    ]);
  });

  it("names positions by their labels, with none for one no longer in any list", () => {
    const positions = {
      id: "positions",
      name: "Positions",
      description: "",
      visibility: "general" as const,
      retired: false,
      builtIn: "positions" as const,
      choices: [
        {
          id: "position-1",
          label: "Engineer",
          description: "",
          retired: false,
        },
        { id: "position-2", label: "Tester", description: "", retired: false },
      ],
    };
    const person = (positionId: string): Person => ({
      id: "p3",
      preferredName: "Fictional Mover",
      employeeId: "p3",
      positionId,
      values: {},
      links: {},
    });
    const wording = (
      positionId: string,
      action: "created" | "changed",
      live?: string,
    ) =>
      personDraftFields(
        person(positionId),
        {
          action,
          changed: ["positionId"],
          live: {
            values: {},
            links: {},
            ...(live === undefined ? {} : { positionId: live }),
          },
          state: "waiting",
          madeBy: null,
          madeAt: null,
        },
        [],
        [positions],
      ).map(({ field }) => [field.oldValue, field.newValue]);
    expect(wording("position-2", "changed", "position-1")).toEqual([
      ["Engineer", "Tester"],
    ]);
    expect(wording("position-1", "created")).toEqual([[null, "Engineer"]]);
    expect(wording("removed", "changed", "position-1")).toEqual([
      ["Engineer", null],
    ]);
  });
});
