// SPDX-License-Identifier: Apache-2.0

// Integration tests for filling a planned hire on feature teams: drafting the fill, approving it,
// which carries the hire's teams and lead to its person, rejecting and discarding it, the change
// history, and who may draft and decide it, for every role. The hire is recorded on its teams
// straight into their tables, to reach each state at once.

import { people } from "@fathom/db";
import {
  type ChangeHistory,
  type Permission,
  type Person,
  startingRoles,
} from "@fathom/shared";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  builtInChoice,
  errorOf,
  generalApprover,
  ok,
  testPosition,
  unique,
  type User,
} from "./test-app.ts";
import {
  test,
  editor,
  approver,
  startFeatureTeamTests,
  closeFeatureTeamTests,
  send,
  person,
  plannedHire,
  liveTeam,
  hireMemberships,
  hireOnTeam,
  hireLeading,
  leads,
  memberships,
  planner,
  changed,
  approved,
  today,
} from "./test-feature-teams.ts";

beforeAll(startFeatureTeamTests);

afterAll(closeFeatureTeamTests);

const start = "2026-09-01";

const inDraftRefusal =
  "A draft of one of this planned hire's feature teams, or one naming it, is waiting. Approve or discard it before filling the hire.";

const endRefusal = async (id: string) => {
  const name = await nameOf(id);
  return `${name} leaves before they would join or lead one of the planned hire's feature teams; change the hire's team days or ${name}'s end date first`;
};

const nameOf = async (id: string) =>
  String(
    (
      await test.connection
        .select({ name: people.preferredName })
        .from(people)
        .where(eq(people.id, id))
    )[0]?.name,
  );

const openHire = async () =>
  plannedHire({
    stateId: await builtInChoice(test.connection, "hiring-states", "open"),
  });

const fill = (hire: string, body: object, who = editor) =>
  send(who, "POST", `/api/planned-hires/${hire}/fill`, body);

// Fills the hire with a new person starting on the day given, and returns how to find the person
// once approved, since a person only drafted to be added has no record yet.
async function filledByNewPerson(hire: string, startDate = start) {
  const preferredName = unique("Fictional Starter");
  await ok(
    await fill(hire, {
      by: "new person",
      preferredName,
      employeeId: unique("FS"),
      startDate,
    }),
  );
  return async () => {
    const [row] = await test.connection
      .select({ id: people.id })
      .from(people)
      .where(eq(people.preferredName, preferredName));
    return String(row?.id);
  };
}

const decide = (
  how: "approval" | "rejection",
  hire: string,
  who: User = approver,
) =>
  send(who, "POST", `/api/drafts/${how}`, {
    plannedHires: [hire],
    ...(how === "rejection" ? { reason: "Fictional reason" } : {}),
  });

// The feature team record of a change set, as a reader sees it.
async function teamRecord(changeSetId: string, who: User = approver) {
  const { entries } = await ok<ChangeHistory>(
    await send(who, "GET", "/api/changes"),
  );
  return entries
    .find((entry) => entry.id === changeSetId)
    ?.records.find((one) => one.kind === "feature-team");
}

// The records of people on a team, without the day each was recorded.
const peopleOn = async (teamId: string) =>
  (await memberships(teamId)).filter(({ personId }) => personId !== null);

// A hire on a team, and leading it, from April.
async function hireOnLedTeam(hire: string) {
  const id = await liveTeam();
  await hireOnTeam(id, hire, { fromDate: "2026-04-01" });
  await hireLeading(id, hire, "2026-04-01");
  return id;
}

describe("filling a planned hire on feature teams", () => {
  it("is drafted, leaving the hire's teams as they are", async () => {
    const hire = await openHire();
    const id = await hireOnLedTeam(hire);

    await filledByNewPerson(hire);

    expect(await peopleOn(id)).toEqual([]);
    expect(await hireMemberships(id)).toEqual([
      { plannedHireId: hire, member: true, fromDate: "2026-04-01" },
    ]);
  });

  it("carries the hire's team and lead to its person from their start on approval, ending the hire's", async () => {
    // Given a hire on a team and leading it, filled by someone starting in September
    const hire = await openHire();
    const id = await hireOnLedTeam(hire);
    const filledBy = await filledByNewPerson(hire);

    // When the fill is approved
    await ok(await decide("approval", hire));
    const filler = await filledBy();

    // Then the person joins and leads the team from their start, as the hire leaves it
    expect(await peopleOn(id)).toEqual([
      { personId: filler, member: true, fromDate: start },
    ]);
    expect(await hireMemberships(id)).toEqual([
      { plannedHireId: hire, member: true, fromDate: "2026-04-01" },
      { plannedHireId: hire, member: false, fromDate: start },
    ]);
    expect(await leads(id)).toEqual([
      { leadId: null, leadPlannedHireId: hire, fromDate: "2026-04-01" },
      { leadId: filler, leadPlannedHireId: null, fromDate: start },
    ]);
  });

  it("gives someone already in Fathom a team the hire joins later on the hire's own day", async () => {
    const hire = await openHire();
    const id = await liveTeam();
    await hireOnTeam(id, hire, { fromDate: "2026-10-01" });
    const filler = await person();
    await ok(await fill(hire, { by: "existing person", personId: filler }));

    await ok(await decide("approval", hire));

    expect(await peopleOn(id)).toEqual([
      { personId: filler, member: true, fromDate: "2026-10-01" },
    ]);
    expect(await hireMemberships(id)).toEqual([]);
  });

  it("gives someone already in Fathom a team the hire is on from today, leaving the hire's past days as they were", async () => {
    const hire = await openHire();
    const id = await hireOnLedTeam(hire);
    const filler = await person();
    await ok(await fill(hire, { by: "existing person", personId: filler }));

    await ok(await decide("approval", hire));

    expect(await peopleOn(id)).toEqual([
      { personId: filler, member: true, fromDate: today },
    ]);
    expect(await hireMemberships(id)).toEqual([
      { plannedHireId: hire, member: true, fromDate: "2026-04-01" },
      { plannedHireId: hire, member: false, fromDate: today },
    ]);
  });

  it("keeps the records of someone already on the hire's team, passing them the lead", async () => {
    // Given a person on a team, and a hire on it leading it, leaving it in December
    const filler = await person();
    const hire = await openHire();
    const id = await liveTeam({ members: [filler] });
    await hireOnTeam(id, hire, { fromDate: "2026-04-01" });
    await hireLeading(id, hire, "2026-04-01");
    await hireOnTeam(id, hire, { fromDate: "2026-12-01", member: false });
    const own = await peopleOn(id);
    await ok(await fill(hire, { by: "existing person", personId: filler }));

    // When the fill is approved
    const { changeSetId } = await ok<{ changeSetId: string }>(
      await decide("approval", hire),
    );

    // Then the person keeps their own records, leads from today, and is named once
    expect(await peopleOn(id)).toEqual(own);
    expect(await hireMemberships(id)).toEqual([
      { plannedHireId: hire, member: true, fromDate: "2026-04-01" },
      { plannedHireId: hire, member: false, fromDate: today },
    ]);
    expect((await leads(id)).at(-1)).toEqual({
      leadId: filler,
      leadPlannedHireId: null,
      fromDate: today,
    });
    const record = await teamRecord(changeSetId);
    expect(
      record?.fields.find(({ field }) => field === "members")?.newValue,
    ).toHaveLength(1);
  });

  it("takes off a hire joining a team later that its person is on already, changing nothing of theirs", async () => {
    const filler = await person();
    const hire = await openHire();
    const id = await liveTeam({ members: [filler] });
    await hireOnTeam(id, hire, { fromDate: "2026-10-01" });
    const own = await peopleOn(id);
    await ok(await fill(hire, { by: "existing person", personId: filler }));

    await ok(await decide("approval", hire));

    expect(await peopleOn(id)).toEqual(own);
    expect(await hireMemberships(id)).toEqual([]);
  });

  it("records the person joining and leading as the hire leaves in the change history", async () => {
    const hire = await openHire();
    await hireOnLedTeam(hire);
    await filledByNewPerson(hire);

    const { changeSetId } = await ok<{ changeSetId: string }>(
      await decide("approval", hire),
    );

    const record = await teamRecord(changeSetId);
    const field = (name: string) =>
      record?.fields.find((one) => one.field === name);
    const words = (name: string) => [
      String(field(name)?.oldValue),
      String(field(name)?.newValue),
    ];
    for (const name of ["members", "leadId"]) {
      const [was, is] = words(name);
      expect(was).toContain("Fictional Planned Hire");
      expect(is).toContain("Fictional Starter");
    }
  });

  it("shows a reader without Personal details no day and no person not yet started in the history", async () => {
    const hire = await openHire();
    await hireOnLedTeam(hire);
    await filledByNewPerson(hire);

    const { changeSetId } = await ok<{ changeSetId: string }>(
      await decide("approval", hire),
    );

    const record = await teamRecord(changeSetId, planner);
    expect(record).toBeDefined();
    expect(
      String(record?.fields.find(({ field }) => field === "members")?.oldValue),
    ).toContain("Fictional Planned Hire");
    expect(record?.fields.map(({ field }) => field)).not.toContain(
      "memberFrom",
    );
    expect(JSON.stringify(record)).not.toContain("Fictional Starter");
  });

  it("refuses approval while a draft of one of the hire's teams waits, adding no person and no records", async () => {
    // Given a fill by someone new, then a draft renaming the hire's team
    const hire = await openHire();
    const id = await hireOnLedTeam(hire);
    const filledBy = await filledByNewPerson(hire);
    await changed(id, { name: unique("Fictional Renamed Team") });

    // When the fill is approved
    const response = await decide("approval", hire);

    // Then it is refused, and nothing it would make is there
    expect(response.statusCode).toBe(409);
    expect(errorOf(response)).toBe(inDraftRefusal);
    expect(await filledBy()).toBe("undefined");
    expect(await peopleOn(id)).toEqual([]);
    expect(await hireMemberships(id)).toEqual([
      { plannedHireId: hire, member: true, fromDate: "2026-04-01" },
    ]);
  });

  it("is refused while a team's draft takes the hire off its team", async () => {
    const hire = await openHire();
    const id = await hireOnLedTeam(hire);
    await changed(id, { remove: [hire] });

    const response = await fill(hire, {
      by: "existing person",
      personId: await person(),
    });

    expect(response.statusCode).toBe(409);
    expect(errorOf(response)).toBe(inDraftRefusal);
  });

  it("is approved together with a later draft of one of the hire's teams", async () => {
    // Given a fill, then a draft renaming the hire's team
    const hire = await openHire();
    const id = await hireOnLedTeam(hire);
    const filler = await person();
    await ok(await fill(hire, { by: "existing person", personId: filler }));
    await changed(id, { name: unique("Fictional Renamed Team") });

    // When both are approved at once
    const response = await send(approver, "POST", "/api/drafts/approval", {
      plannedHires: [hire],
      featureTeams: [id],
    });

    // Then the person takes the hire's place on the renamed team
    expect(response.statusCode).toBe(200);
    expect(await peopleOn(id)).toEqual([
      { personId: filler, member: true, fromDate: today },
    ]);
  });

  it("passes the lead only from the day a person on the team only later joins it, leaving them out of the members until then", async () => {
    // Given a person joining a team in November, and a hire on it and leading it
    const filler = await person();
    const hire = await openHire();
    const id = await hireOnLedTeam(hire);
    await changed(id, { add: [filler], from: "2026-11-01" });
    await approved(id);
    await ok(await fill(hire, { by: "existing person", personId: filler }));

    // When the fill is approved
    const { changeSetId } = await ok<{ changeSetId: string }>(
      await decide("approval", hire),
    );

    // Then the team has no lead until the person joins, and leads from then
    expect((await leads(id)).slice(-2)).toEqual([
      { leadId: null, leadPlannedHireId: null, fromDate: today },
      { leadId: filler, leadPlannedHireId: null, fromDate: "2026-11-01" },
    ]);
    const members = (await teamRecord(changeSetId))?.fields.find(
      ({ field }) => field === "members",
    );
    expect(JSON.stringify(members?.newValue ?? null)).not.toContain(
      await nameOf(filler),
    );
  });

  it("doesn't tell a drafter without Personal details that the person leaves before a team day, leaving it to the Approver", async () => {
    // Given a person leaving in September and a hire joining a team in October
    const filler = await person({ endDate: "2026-09-30" });
    const hire = await openHire();
    await hireOnTeam(await liveTeam(), hire, { fromDate: "2026-10-01" });
    const who = await test.signedIn(
      startingRoles["workforce-administrator"].permissions.filter(
        (permission: Permission) => !permission.startsWith("personal:"),
      ),
    );

    // When someone without Personal details drafts the fill
    const drafting = await fill(
      hire,
      { by: "existing person", personId: filler },
      who,
    );

    // Then it is drafted, and approving it is refused
    expect(drafting.statusCode).toBe(200);
    expect(errorOf(await decide("approval", hire))).toBe(
      await endRefusal(filler),
    );
  });

  it("refuses someone whose end date comes before a day on the hire's teams, when drafted and approved", async () => {
    // Given a person leaving in September and a hire joining a team in October
    const filler = await person({ endDate: "2026-09-30" });
    const hire = await openHire();
    const id = await liveTeam();
    await hireOnTeam(id, hire, { fromDate: "2026-10-01" });
    const refusal = await endRefusal(filler);

    // Then filling with them is refused
    const drafting = await fill(hire, {
      by: "existing person",
      personId: filler,
    });
    expect(errorOf(drafting)).toBe(refusal);

    // And a fill drafted before the hire joined another team is refused on approval
    const other = await openHire();
    await ok(await fill(other, { by: "existing person", personId: filler }));
    await hireOnTeam(id, other, { fromDate: "2026-10-01" });
    const approving = await decide("approval", other);
    expect(approving.statusCode).toBe(409);
    expect(errorOf(approving)).toBe(refusal);
  });

  it("refuses approval once its person is no longer in Fathom", async () => {
    const hire = await openHire();
    await hireOnLedTeam(hire);
    const filler = await person();
    await ok(await fill(hire, { by: "existing person", personId: filler }));
    await test.connection.delete(people).where(eq(people.id, filler));

    const response = await decide("approval", hire);

    expect(response.statusCode).toBe(409);
    expect(errorOf(response)).toBe(
      "The person filling this planned hire is no longer in Fathom; discard the fill",
    );
  });

  it.each([["rejection"], ["discard"]] as const)(
    "leaves the hire's teams as they are on its %s",
    async (how) => {
      const hire = await openHire();
      const id = await hireOnLedTeam(hire);
      await filledByNewPerson(hire);

      await ok(
        how === "discard"
          ? await send(editor, "DELETE", `/api/planned-hires/${hire}/draft`)
          : await decide("rejection", hire),
      );

      expect(await peopleOn(id)).toEqual([]);
      expect(await hireMemberships(id)).toEqual([
        { plannedHireId: hire, member: true, fromDate: "2026-04-01" },
      ]);
    },
  );
});

describe("who may decide a fill carrying feature teams", () => {
  // A fill by someone already in Fathom in the hire's position, whose own draft holds nothing, so
  // only the carried teams need sight of Personal details.
  async function fillOnTeam(onTeam = true) {
    const hire = await openHire();
    if (onTeam) await hireOnTeam(await liveTeam(), hire);
    const filler = await person({ positionId: testPosition });
    await ok(await fill(hire, { by: "existing person", personId: filler }));
    return hire;
  }

  it("refuses an Approver who doesn't see Personal details", async () => {
    const who = await test.signedIn(generalApprover);

    const response = await decide("approval", await fillOnTeam(), who);

    expect(response.statusCode).toBe(403);
    expect(errorOf(response)).toBe(
      "This fill moves the planned hire's feature teams to its person, so an Approver who sees feature teams and Personal details must decide it",
    );
  });

  it("lets that Approver decide a fill carrying no team", async () => {
    const who = await test.signedIn(generalApprover);

    expect(
      (await decide("approval", await fillOnTeam(false), who)).statusCode,
    ).toBe(200);
  });

  const withoutTeams = startingRoles["project-manager"].permissions.filter(
    (permission: Permission) => permission !== "feature-teams:view",
  );

  it("refuses an Approver who doesn't see feature teams", async () => {
    const who = await test.signedIn(withoutTeams);

    expect(
      (await decide("rejection", await fillOnTeam(), who)).statusCode,
    ).toBe(403);
  });

  it("is marked as needing another approver only for an Approver who doesn't see feature teams", async () => {
    const hire = await fillOnTeam();
    const marked = async (who: User) => {
      const draft = (
        await ok<{ people: Person[] }>(await send(who, "GET", "/api/people"))
      ).people.find(({ id }) => id === hire)?.draft;
      return [draft?.needsOtherApprover, draft?.holdsUnseen];
    };

    expect(await marked(await test.signedIn(withoutTeams))).toEqual([
      true,
      true,
    ]);
    expect(await marked(approver)).toEqual([undefined, undefined]);
  });

  const deciders = new Set(["project-manager", "engineering-director"]);

  it.each(Object.keys(startingRoles).map((role) => [role]))(
    "allows or refuses the %s to approve one",
    async (role) => {
      const hire = await fillOnTeam();
      const who = await test.signedIn(role as keyof typeof startingRoles);

      const response = await decide("approval", hire, who);

      expect(response.statusCode).toBe(deciders.has(role) ? 200 : 403);
    },
  );
});

describe("who may draft a fill of a hire on a team", () => {
  const fillers = new Set(["engineering-director", "workforce-administrator"]);

  it.each(Object.keys(startingRoles).map((role) => [role]))(
    "allows or refuses the %s",
    async (role) => {
      const hire = await openHire();
      await hireOnTeam(await liveTeam(), hire);
      const who = await test.signedIn(role as keyof typeof startingRoles);

      const response = await fill(
        hire,
        { by: "existing person", personId: await person() },
        who,
      );

      expect(response.statusCode).toBe(fillers.has(role) ? 200 : 403);
    },
  );
});
