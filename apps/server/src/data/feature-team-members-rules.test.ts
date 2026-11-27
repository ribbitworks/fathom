// SPDX-License-Identifier: Apache-2.0

// Unit tests for the members and lead a feature team is to have: who may join it, who may lead it,
// and how a planned hire that can't is refused, by what the role sees.

import { defaultClasses, startingRoles, withImplied } from "@fathom/shared";
import { describe, expect, it } from "vitest";
import {
  type Everyone,
  type Member,
  membersRefusal,
} from "./feature-team-rules.ts";
import { plannedHire, someone } from "./test-feature-team-people.ts";

const member = "person-member";
const joining = "person-joining";
const outsider = "person-outsider";
const hire = "hire-open";

describe("a team's members and lead", () => {
  const seesPeople = {
    permissions: withImplied(
      startingRoles["workforce-administrator"].permissions,
    ),
    dataClasses: defaultClasses,
  };
  const seesNoEmployment = {
    permissions: withImplied(startingRoles["feature-lead"].permissions),
    dataClasses: defaultClasses,
  };
  const filledHire = "hire-filled";
  const removedHire = "hire-removed";
  const everyone: Everyone = new Map<string, Member>([
    [member, someone()],
    [joining, someone({ started: false, startDate: "2099-01-01" })],
    [outsider, someone({ left: true, endDate: "2021-06-30" })],
    [hire, plannedHire()],
    [filledHire, plannedHire({ filledBy: "person-filler" })],
    [removedHire, plannedHire({ removing: true })],
  ]);
  const refusal = (
    access: typeof seesPeople,
    added: string[],
    leadId: string | null = null,
    members = added,
  ) => membersRefusal(access, added, members, leadId, everyone);

  it.each([
    ["a role that sees employment dates", seesPeople],
    ["a role that doesn't", seesNoEmployment],
  ])(
    "asks %s for someone from People for a member who is not a person",
    (_, access) => {
      expect(refusal(access, ["person-unknown"])).toBe(
        "Choose members from People",
      );
    },
  );

  it("refuses someone who has left, as such, to a role that sees employment dates", () => {
    expect(refusal(seesPeople, [outsider])).toBe(
      "Someone who has left can't join a team",
    );
  });

  it("asks for someone from People for someone who has left, to a role that doesn't see employment dates", () => {
    expect(refusal(seesNoEmployment, [outsider])).toBe(
      "Choose members from People",
    );
  });

  it("asks for someone from People for someone who has not started, to a role that doesn't see employment dates", () => {
    expect(refusal(seesNoEmployment, [joining])).toBe(
      "Choose members from People",
    );
  });

  it("takes someone who has not started from a role that sees employment dates", () => {
    expect(refusal(seesPeople, [joining])).toBeUndefined();
  });

  it("checks only the members added, so someone on the team who has since left stops nothing", () => {
    expect(
      refusal(seesNoEmployment, [member], null, [member, outsider]),
    ).toBeUndefined();
  });

  it("refuses a lead who is not one of the members", () => {
    expect(refusal(seesPeople, [member], joining)).toBe(
      "The feature lead must be one of the members",
    );
  });

  it("takes a lead among the members", () => {
    expect(refusal(seesPeople, [member], member)).toBeUndefined();
  });

  it("takes a team with no lead", () => {
    expect(refusal(seesPeople, [], null)).toBeUndefined();
  });

  it.each([
    ["a role that sees employment dates", seesPeople],
    ["a role that doesn't", seesNoEmployment],
  ])("takes a planned hire, as member and lead, from %s", (_, access) => {
    expect(refusal(access, [hire], hire)).toBeUndefined();
  });

  it("refuses a filled planned hire as a member, saying so to a role that sees its fill", () => {
    expect(refusal(seesPeople, [filledHire])).toBe(
      "This planned hire has been filled. Choose the person who filled it.",
    );
  });

  it("refuses a filled planned hire to a role that doesn't see its fill, without saying why", () => {
    expect(refusal(seesNoEmployment, [filledHire])).toBe(
      "This planned hire can't join or lead a team.",
    );
  });

  it("refuses a filled planned hire as lead the same way", () => {
    expect(refusal(seesNoEmployment, [], filledHire, [filledHire])).toBe(
      "This planned hire can't join or lead a team.",
    );
  });

  it("refuses a planned hire drafted to be removed as a member", () => {
    expect(refusal(seesPeople, [member, removedHire])).toBe(
      "This planned hire is drafted to be removed, so it can't join or lead a team.",
    );
  });

  it("refuses a planned hire drafted to be removed to a role that doesn't see the hiring plan, without saying why", () => {
    expect(refusal(seesNoEmployment, [member, removedHire])).toBe(
      "This planned hire can't join or lead a team.",
    );
  });

  it("refuses a planned hire that can't lead as the lead, though already a member", () => {
    expect(refusal(seesPeople, [], removedHire, [removedHire])).toBe(
      "This planned hire is drafted to be removed, so it can't join or lead a team.",
    );
  });

  it("refuses a planned hire as lead unless it is one of the members", () => {
    expect(refusal(seesPeople, [member], hire)).toBe(
      "The feature lead must be one of the members",
    );
  });
});
