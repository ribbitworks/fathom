// SPDX-License-Identifier: Apache-2.0

// Tests for a person's initials, including names with one part, extra spaces, or none at all, and
// names in other scripts, whose first characters are never split; a name with the role it acted
// as; who changed a draft; and the roles an account holds.

import { describe, expect, it } from "vitest";
import { initials, makerNames, nameAs, rolesHeld } from "./names.ts";

describe("initials", () => {
  it.each([
    ["Fictional Person", "FP"],
    ["fictional middle person", "FM"],
    ["Fictional", "F"],
    ["  Fictional   Person  ", "FP"],
    ["", ""],
    ["Вероника Елисеева", "ВЕ"],
    ["越智 太陽", "越太"],
    ["𠮷田 太郎", "𠮷太"],
    ["E\u0301lodie Dubois", "E\u0301D"],
  ])("of %j are %j", (name, expected) => {
    expect(initials(name)).toBe(expected);
  });
});

describe("nameAs", () => {
  it("names the role acted as, when known", () => {
    expect(nameAs("Fictional Person", "Feature Lead")).toBe(
      "Fictional Person as Feature Lead",
    );
    expect(nameAs("Fictional Person", null)).toBe("Fictional Person");
    expect(nameAs("Fictional Person", undefined)).toBe("Fictional Person");
  });
});

describe("makerNames", () => {
  it("names the role of the one person who changed a draft", () => {
    expect(
      makerNames({ madeBy: "Fictional Person", madeAs: "Feature Lead" }),
    ).toEqual(["Fictional Person as Feature Lead"]);
    expect(makerNames({ madeBy: null, madeAs: null })).toEqual(["Fathom"]);
  });

  it("names no role when several people changed a draft", () => {
    expect(
      makerNames({
        madeBy: "Fictional Second",
        madeAs: "Feature Lead",
        editors: ["Fictional First", null, "Fictional Second"],
      }),
    ).toEqual(["Fictional First", "Fathom", "Fictional Second"]);
  });
});

describe("rolesHeld", () => {
  it("puts the default first, marked only beside others", () => {
    expect(rolesHeld("Planner", ["Executive", "Planner"])).toEqual([
      "Planner (default)",
      "Executive",
    ]);
    expect(rolesHeld("Planner", ["Planner"])).toEqual(["Planner"]);
  });

  it("lists the roles as they are without a default", () => {
    expect(rolesHeld(undefined, ["Executive", "Planner"])).toEqual([
      "Executive",
      "Planner",
    ]);
  });
});
