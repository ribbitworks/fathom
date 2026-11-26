// SPDX-License-Identifier: Apache-2.0

// Tests for managers' part in reporting lines, against a migrated PostgreSQL server: the Manager?
// mark someone needs before anyone reports to them, and team names and who sees what of them.

import { teams } from "@fathom/db";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { generalReader, testPosition, unique } from "./test-app.ts";
import {
  approve,
  approved,
  change,
  changed,
  closeOrgChartTests,
  cookie,
  day,
  person,
  readPerson,
  reportsTo,
  startOrgChartTests,
  test,
  today,
} from "./test-org-chart.ts";

beforeAll(startOrgChartTests);

afterAll(closeOrgChartTests);

describe("the Manager? mark", () => {
  const notMarked = (name: string) =>
    `${name} is not a manager yet: check Manager? on their row and have it approved first`;
  const stillReporting = "Reassign direct reports first";
  const nameOf = async (id: string) =>
    String((await readPerson(id))?.preferredName);

  it("is needed before anyone can be drafted to report to someone, and only once approved", async () => {
    const manager = await person({ isManager: false });
    const report = await person();
    const refused = await change(report, { managerId: manager });
    expect(refused.statusCode).toBe(400);
    expect(refused.json<{ error: string }>().error).toBe(
      notMarked(await nameOf(manager)),
    );
    await changed(manager, { isManager: true });
    expect((await change(report, { managerId: manager })).statusCode).toBe(400);
    await approved([manager]);
    await reportsTo(report, manager);
    expect((await readPerson(report))?.manager?.id).toBe(manager);
  });

  it("is General, and recorded only when it changes", async () => {
    const id = await person({ isManager: false });
    const general = await test.signedIn(generalReader);
    expect((await readPerson(id, general.cookie))?.isManager).toBe(false);
    await changed(id, { isManager: true });
    expect(await readPerson(id)).toMatchObject({
      isManager: true,
      draft: { changed: ["isManager"], live: { isManager: false } },
    });
    await approved([id]);
    expect((await readPerson(id, general.cookie))?.isManager).toBe(true);
    await changed(id, { isManager: false });
    expect((await readPerson(id))?.draft?.live.isManager).toBe(true);
    const marked = (await test.historyOf(id)).filter(
      ({ field }) => field === "isManager",
    );
    expect(
      marked.map(({ oldValue, newValue, tier }) => [oldValue, newValue, tier]),
    ).toEqual([
      [null, true, "general"],
      [null, true, "general"],
      [true, false, "general"],
    ]);
  });

  it("cannot be cleared while anyone still employed reports to them, now or from a later date", async () => {
    const manager = await person();
    const report = await person();
    await reportsTo(report, manager, "2021-01-01");
    const refused = await change(manager, { isManager: false });
    expect(refused.statusCode).toBe(409);
    expect(refused.json<{ error: string }>().error).toBe(stillReporting);
    const starter = await person({ startDate: day(30) });
    const next = await person();
    await reportsTo(report, next);
    await reportsTo(starter, manager, day(30));
    expect((await change(manager, { isManager: false })).statusCode).toBe(409);
    await changed(starter, { managerId: next, managerFrom: day(30) });
    await approved([starter]);
    await changed(manager, { isManager: false });
    await approved([manager]);
    expect((await readPerson(manager))?.isManager).toBe(false);
  });

  it("can be cleared once everyone reporting to them has left", async () => {
    const manager = await person();
    const report = await person();
    await reportsTo(report, manager, "2021-01-01");
    await changed(report, { endDate: "2022-01-01" });
    await approved([report]);
    await changed(manager, { isManager: false });
    await approved([manager]);
    expect((await readPerson(manager))?.isManager).toBe(false);
  });

  it("cannot be cleared while a draft names them as a manager", async () => {
    const manager = await person();
    const report = await person();
    await changed(report, { managerId: manager });
    expect((await change(manager, { isManager: false })).statusCode).toBe(409);
  });

  it("leaves no draft when checked and unchecked again, or unchecked when it never was", async () => {
    const id = await person({ isManager: false });
    await changed(id, { isManager: true });
    await changed(id, { isManager: false });
    expect((await readPerson(id))?.draft).toBeUndefined();
    const response = await change(id, { isManager: false });
    expect(response.json<{ changeSetId: string | null }>().changeSetId).toBe(
      null,
    );
    expect((await readPerson(id))?.draft).toBeUndefined();
  });

  it("is needed by a manager an undo puts back", async () => {
    const first = await person();
    const second = await person();
    const report = await person();
    await changed(report, { managerId: first });
    const response = await change(report, { managerId: second });
    const { changeSetId } = response.json<{ changeSetId: string }>();
    await changed(first, { isManager: false });
    await approved([first]);
    const undone = await test.request(
      cookie,
      "POST",
      `/api/undo/${changeSetId}`,
    );
    expect(undone.statusCode).toBe(409);
    expect(undone.json<{ error: string }>().error).toBe(
      notMarked(await nameOf(first)),
    );
  });

  it("is not cleared by undoing a change while a draft names them as a manager", async () => {
    const manager = await person();
    const report = await person();
    await changed(manager, { isManager: false });
    const response = await change(manager, { isManager: true });
    const { changeSetId } = response.json<{ changeSetId: string }>();
    await changed(report, { managerId: manager });
    const undone = await test.request(
      cookie,
      "POST",
      `/api/undo/${changeSetId}`,
    );
    expect(undone.statusCode).toBe(409);
    expect(undone.json<{ error: string }>().error).toBe(stillReporting);
  });

  it("cannot be cleared by approval while someone reports to them", async () => {
    const manager = await person();
    const report = await person();
    await changed(manager, { isManager: false });
    await reportsTo(report, manager);
    const response = await approve([manager]);
    expect(response.statusCode).toBe(409);
    expect(response.json<{ error: string }>().error).toBe(stillReporting);
  });
});

describe("a team's name", () => {
  it("is shown for each of the manager's reports, and stays with the manager when reports move", async () => {
    const manager = await person();
    const other = await person();
    const report = await person();
    await reportsTo(report, manager);
    const name = unique("Fictional Platform Team");
    await changed(manager, { teamName: name });
    await approved([manager]);
    expect(
      await test.connection.select().from(teams).where(eq(teams.name, name)),
    ).toEqual([{ managerId: manager, name, colour: null }]);
    expect((await readPerson(report))?.team).toBe(name);
    expect((await readPerson(manager))?.teamName).toBe(name);
    await reportsTo(report, other, today);
    expect((await readPerson(report))?.team).toBeNull();
    expect((await readPerson(manager))?.teamName).toBe(name);
  });

  it("is unique, ignoring letter case, live or drafted", async () => {
    const first = await person();
    const second = await person();
    const third = await person();
    const name = unique("Fictional Data Team");
    await changed(first, { teamName: name });
    expect(
      (await change(second, { teamName: name.toUpperCase() })).statusCode,
    ).toBe(409);
    await approved([first]);
    expect((await change(third, { teamName: name })).statusCode).toBe(409);
  });

  it("cannot be given to two people added together", async () => {
    const name = unique("Fictional Twin Team");
    const response = await test.request(cookie, "POST", "/api/people", {
      people: [1, 2].map(() => ({
        preferredName: unique("Fictional Person"),
        employeeId: unique("RL"),
        positionId: testPosition,
        teamName: name,
      })),
    });
    expect(response.statusCode, response.body).toBe(409);
  });

  it("is taken by an editor's own unpublished draft, and not by another editor's", async () => {
    // Given one editor's unpublished draft naming a team
    const first = await person();
    const second = await person();
    const name = unique("Fictional Unpublished Team");
    const other = await test.signedIn("workforce-administrator");
    const unpublished = await test.request(
      other.cookie,
      "PATCH",
      `/api/people/${first}`,
      { teamName: name },
      { publish: false },
    );
    expect(unpublished.statusCode, unpublished.body).toBe(200);

    // When that editor and another give the name to someone else
    const own = await test.request(
      other.cookie,
      "PATCH",
      `/api/people/${second}`,
      { teamName: name },
      { publish: false },
    );
    const taken = await change(second, { teamName: name });

    // Then only the editor whose draft names it is refused
    expect(own.statusCode, own.body).toBe(409);
    expect(own.json<{ error: string }>().error).toBe(
      "Another team has that name",
    );
    expect(taken.statusCode, taken.body).toBe(200);
    await test.request(other.cookie, "POST", "/api/unpublished/discard");
  });

  it("cannot be put back by undo once another team has taken it", async () => {
    const first = await person();
    const second = await person();
    const name = unique("Fictional Undone Team");
    await changed(first, { teamName: name });
    const renamed = await change(first, {
      teamName: unique("Fictional Renamed"),
    });
    const { changeSetId } = renamed.json<{ changeSetId: string }>();
    await changed(second, { teamName: name });
    const undone = await test.request(
      cookie,
      "POST",
      `/api/undo/${changeSetId}`,
    );
    expect(undone.statusCode).toBe(409);
  });

  it("is seen by readers who see only General details, as drafted, on the manager and their reports", async () => {
    const manager = await person();
    const report = await person();
    await reportsTo(report, manager);
    const name = unique("Fictional Drafted Team");
    await changed(manager, { teamName: name });
    const reader = await test.signedIn(generalReader);
    expect((await readPerson(manager, reader.cookie))?.teamName).toBe(name);
    expect((await readPerson(report, reader.cookie))?.team).toBe(name);
  });

  it("is removed when emptied", async () => {
    const manager = await person({ teamName: unique("Fictional Team") });
    await changed(manager, { teamName: "" });
    await approved([manager]);
    expect(
      await test.connection
        .select()
        .from(teams)
        .where(eq(teams.managerId, manager)),
    ).toEqual([]);
  });
});
