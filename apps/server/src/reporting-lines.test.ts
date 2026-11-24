// SPDX-License-Identifier: Apache-2.0

// Tests for reporting lines, against a migrated PostgreSQL server: drafting a manager, from a date,
// and approving it into a line kept with the person's past lines; the rules a line must follow; and
// who sees managers, their dates, and changes to them.

import { accessHistory, people, reportingLines } from "@fathom/db";
import type { ChangeHistory } from "@fathom/shared";
import { asc, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { rolesGranting } from "./access.ts";
import { generalReader, testPosition, unique } from "./test-app.ts";
import {
  approve,
  approved,
  change,
  changed,
  closeOrgChartTests,
  cookie,
  day,
  editorId,
  person,
  readPerson,
  reportsTo,
  startOrgChartTests,
  test,
  today,
} from "./test-org-chart.ts";

beforeAll(startOrgChartTests);

afterAll(closeOrgChartTests);

async function linesOf(id: string) {
  return test.connection
    .select({
      managerId: reportingLines.managerId,
      fromDate: reportingLines.fromDate,
    })
    .from(reportingLines)
    .where(eq(reportingLines.personId, id))
    .orderBy(asc(reportingLines.fromDate));
}

describe("a reporting line", () => {
  it("is drafted with a manager and a from date, today by default, and kept once approved", async () => {
    const manager = await person();
    const report = await person();
    await changed(report, { managerId: manager });
    expect(await linesOf(report)).toEqual([]);
    const drafted = await readPerson(report);
    expect(drafted?.manager?.id).toBe(manager);
    expect(drafted?.managerFrom).toBe(today);
    expect(drafted?.draft?.changed).toEqual(["managerId", "managerFrom"]);
    await approved([report]);
    expect(await linesOf(report)).toEqual([
      { managerId: manager, fromDate: today },
    ]);
    const shown = await readPerson(report);
    expect(shown?.draft).toBeUndefined();
    expect(shown?.team).toBeNull();
  });

  it("keeps past lines when a later one starts, and replaces the one in force when it starts the same day", async () => {
    const first = await person();
    const second = await person();
    const third = await person();
    const report = await person();
    await reportsTo(report, first, "2024-03-01");
    await reportsTo(report, second, "2025-06-01");
    expect(await linesOf(report)).toEqual([
      { managerId: first, fromDate: "2024-03-01" },
      { managerId: second, fromDate: "2025-06-01" },
    ]);
    await reportsTo(report, third, "2025-06-01");
    expect(await linesOf(report)).toEqual([
      { managerId: first, fromDate: "2024-03-01" },
      { managerId: third, fromDate: "2025-06-01" },
    ]);
  });

  it("moves to another date when only its date changes, after the line before it", async () => {
    const first = await person();
    const second = await person();
    const report = await person();
    await reportsTo(report, first, "2024-03-01");
    await reportsTo(report, second, "2025-06-01");
    await changed(report, { managerFrom: "2025-05-01" });
    await approved([report]);
    expect((await linesOf(report)).map(({ fromDate }) => fromDate)).toEqual([
      "2024-03-01",
      "2025-05-01",
    ]);
    const response = await change(report, { managerFrom: "2024-03-01" });
    expect(response.statusCode).toBe(400);
  });

  it("records that someone has no manager from a date", async () => {
    const manager = await person();
    const report = await person();
    await reportsTo(report, manager, "2024-03-01");
    await reportsTo(report, null);
    expect(await linesOf(report)).toEqual([
      { managerId: manager, fromDate: "2024-03-01" },
      { managerId: null, fromDate: today },
    ]);
    expect((await readPerson(report))?.manager).toBeNull();
  });

  it("is given to someone added with a manager, from today, or from their start date when it is still to come", async () => {
    const manager = await person();
    const report = await person({ managerId: manager });
    expect(await linesOf(report)).toEqual([
      { managerId: manager, fromDate: today },
    ]);
    const starter = await person({ startDate: day(30), managerId: manager });
    expect(await linesOf(starter)).toEqual([
      { managerId: manager, fromDate: day(30) },
    ]);
  });

  it("is given to someone added with a manager from the date given, or today when they have no start date", async () => {
    const manager = await person();
    const dated = await person({
      managerId: manager,
      managerFrom: "2024-03-01",
    });
    expect(await linesOf(dated)).toEqual([
      { managerId: manager, fromDate: "2024-03-01" },
    ]);
    const undated = await person({ startDate: null, managerId: manager });
    expect(await linesOf(undated)).toEqual([
      { managerId: manager, fromDate: today },
    ]);
  });

  it("starts on a new employee's start date, even when that is still to come", async () => {
    const manager = await person();
    const starter = await person({ startDate: day(30) });
    await reportsTo(starter, manager);
    expect(await linesOf(starter)).toEqual([
      { managerId: manager, fromDate: day(30) },
    ]);
  });

  it.each([
    ["before the person's start date", "2019-12-31"],
    ["after today", day(1)],
    ["before the line in force", "2024-01-01"],
  ])("cannot start %s", async (_, from) => {
    const manager = await person();
    const other = await person();
    const report = await person();
    await reportsTo(report, manager, "2024-03-01");
    const response = await change(report, {
      managerId: other,
      managerFrom: from,
    });
    expect(response.statusCode, response.body).toBe(400);
  });

  it("refuses a start date after an existing line starts", async () => {
    const manager = await person();
    const report = await person();
    await reportsTo(report, manager, "2024-03-01");
    const response = await change(report, { startDate: "2024-04-01" });
    expect(response.statusCode, response.body).toBe(400);
  });

  it("refuses a manager not employed on the day it starts", async () => {
    const left = await person({ endDate: "2023-12-31" });
    const report = await person();
    const response = await change(report, {
      managerId: left,
      managerFrom: "2024-02-01",
    });
    expect(response.statusCode, response.body).toBe(400);
    expect(response.json<{ error: string }>().error).toMatch(
      /is not employed on 2024-02-01/,
    );
  });

  it("refuses a manager only drafted to be added", async () => {
    const drafted = await test.request(cookie, "POST", "/api/people", {
      people: [
        {
          preferredName: unique("Fictional Person"),
          employeeId: unique("RL"),
          positionId: testPosition,
        },
      ],
    });
    const managerId = String(drafted.json<{ ids: string[] }>().ids[0]);
    const report = await person();
    expect((await change(report, { managerId })).statusCode).toBe(400);
  });

  it("refuses anyone reporting to themselves, directly or through others", async () => {
    const top = await person();
    const middle = await person();
    const bottom = await person();
    expect((await change(top, { managerId: top })).statusCode).toBe(400);
    await reportsTo(middle, top);
    await reportsTo(bottom, middle);
    const response = await change(top, { managerId: bottom });
    expect(response.statusCode, response.body).toBe(400);
  });

  it("refuses approving drafts that together make a loop", async () => {
    const first = await person();
    const second = await person();
    await changed(first, { managerId: second });
    // The draft of the first is counted, so the second cannot be drafted to report to them.
    expect((await change(second, { managerId: first })).statusCode).toBe(400);
  });

  it("refuses approving drafts that together make a loop, drafted unseen by each other", async () => {
    const first = await person();
    const second = await person();
    const other = await test.signedIn("workforce-administrator");
    const unpublished = await test.request(
      cookie,
      "PATCH",
      `/api/people/${first}`,
      { managerId: second },
      { publish: false },
    );
    expect(unpublished.statusCode, unpublished.body).toBe(200);
    expect(
      (await change(second, { managerId: first }, other.cookie)).statusCode,
    ).toBe(200);
    await test.request(cookie, "POST", "/api/unpublished/publish");
    // A third person can still be drafted under either, without the loop between them stopping the
    // check.
    const third = await person();
    expect((await change(third, { managerId: first })).statusCode).toBe(200);
    expect((await approve([first, second])).statusCode).toBe(409);
    expect(await linesOf(first)).toEqual([]);
  });

  it("is shown in the change history by the managers' names", async () => {
    const name = unique("Fictional Named Manager");
    const manager = await person({ preferredName: name });
    const report = await person();
    await changed(report, { managerId: manager });
    const history = (
      await test.request(cookie, "GET", "/api/changes")
    ).json<ChangeHistory>();
    expect(history.entries[0]?.records[0]?.fields).toContainEqual(
      expect.objectContaining({
        field: "managerId",
        oldValue: null,
        newValue: name,
      }),
    );
  });

  it("leaves out people drafted to be removed when looking for loops", async () => {
    const leaving = await person();
    const report = await person();
    const removed = await test.request(
      cookie,
      "DELETE",
      `/api/people/${leaving}`,
    );
    expect(removed.statusCode, removed.body).toBe(200);
    const manager = await person();
    expect((await change(report, { managerId: manager })).statusCode).toBe(200);
  });

  it("keeps someone who is or was a manager from being removed", async () => {
    const manager = await person();
    const report = await person();
    await reportsTo(report, manager, "2024-03-01");
    await reportsTo(report, null);
    const response = await test.request(
      cookie,
      "DELETE",
      `/api/people/${manager}`,
    );
    expect(response.statusCode, response.body).toBe(409);
  });

  it("moves a new employee's first line with their start date, when it is put off", async () => {
    const manager = await person();
    const starter = await person({ startDate: day(30) });
    await reportsTo(starter, manager);
    await changed(starter, { startDate: day(60) });
    await approved([starter]);
    expect(await linesOf(starter)).toEqual([
      { managerId: manager, fromDate: day(60) },
    ]);
  });

  it("lets a manager's start be put off together with their report's, approved together", async () => {
    const manager = await person({ startDate: day(30) });
    const report = await person({ startDate: day(30) });
    await reportsTo(report, manager);
    await changed(report, { startDate: day(60) });
    await changed(manager, { startDate: day(60) });
    await approved([report, manager]);
    expect(await linesOf(report)).toEqual([
      { managerId: manager, fromDate: day(60) },
    ]);
  });

  it("refuses moving a line that is not there", async () => {
    const loner = await person();
    expect(
      (await change(loner, { managerFrom: "2024-03-01" })).statusCode,
    ).toBe(400);
    expect(await linesOf(loner)).toEqual([]);
  });

  it("refuses a loop on any day from the date a line starts, not only today", async () => {
    const top = await person();
    const middle = await person();
    const later = await person();
    await reportsTo(middle, top, "2024-01-01");
    await reportsTo(middle, later, "2025-06-01");
    // The top reporting to the middle from January 2025 makes a loop until June.
    expect(
      (await change(top, { managerId: middle, managerFrom: "2025-01-01" }))
        .statusCode,
    ).toBe(400);
    expect(
      (await change(top, { managerId: middle, managerFrom: "2025-07-01" }))
        .statusCode,
    ).toBe(200);
  });

  it("counts a draft that only moves a line's date when looking for loops", async () => {
    const manager = await person();
    const report = await person();
    await reportsTo(report, manager, "2024-03-01");
    await reportsTo(report, null, "2025-01-01");
    // Moving the line with no manager to September keeps the report under the manager until then.
    await changed(report, { managerFrom: "2025-09-01" });
    expect(
      (await change(manager, { managerId: report, managerFrom: "2025-06-01" }))
        .statusCode,
    ).toBe(400);
  });

  it("counts a draft that changes only the manager, keeping the line's date, when looking for loops", async () => {
    const top = await person();
    const first = await person();
    const second = await person();
    await reportsTo(first, top, "2024-01-01");
    await reportsTo(second, top, "2024-01-01");
    // The first is drafted to the second from the same day, so the draft holds no date of its own.
    await changed(first, { managerId: second, managerFrom: "2024-01-01" });
    expect(
      (await change(second, { managerId: first, managerFrom: "2024-02-01" }))
        .statusCode,
    ).toBe(400);
  });

  it("refuses a loop in the gap left when a line moves later", async () => {
    const manager = await person();
    const report = await person();
    await reportsTo(manager, report, "2025-06-01");
    await reportsTo(manager, null, "2025-09-01");
    await reportsTo(report, manager, "2025-10-01");
    // Moving the manager's line with no manager to November puts their line to the report back in
    // force for October, when the report reports to them.
    expect(
      (await change(manager, { managerFrom: "2025-11-01" })).statusCode,
    ).toBe(400);
  });

  it("keeps a line where it is when the start date is corrected to earlier", async () => {
    const manager = await person({ startDate: "2024-02-15" });
    const report = await person({ startDate: "2024-03-01" });
    await reportsTo(report, manager, "2024-03-01");
    await changed(report, { startDate: "2024-02-01" });
    await approved([report]);
    expect(await linesOf(report)).toEqual([
      { managerId: manager, fromDate: "2024-03-01" },
    ]);
  });

  it("counts a draft that only moves a line's date for its own manager, not for past ones", async () => {
    const first = await person();
    const second = await person();
    const report = await person();
    await reportsTo(report, first, "2024-03-01");
    await reportsTo(report, second, "2025-06-01");
    await changed(report, { managerFrom: "2025-07-01" });
    expect((await change(first, { endDate: "2025-06-15" })).statusCode).toBe(
      200,
    );
  });

  it("is put back to no manager by undoing the change that gave one", async () => {
    const manager = await person();
    const report = await person();
    await reportsTo(report, null, "2024-03-01");
    const response = await change(report, { managerId: manager });
    const { changeSetId } = response.json<{ changeSetId: string }>();
    const undone = await test.request(
      cookie,
      "POST",
      `/api/undo/${changeSetId}`,
    );
    expect(undone.statusCode, undone.body).toBe(200);
    expect((await readPerson(report))?.manager).toBeNull();
  });

  it("keeps a manager's start and end dates around the lines that name them, warning only when they leave after a line starts", async () => {
    const manager = await person();
    const report = await person();
    await reportsTo(report, manager, "2024-03-01");
    expect(
      (await change(manager, { startDate: "2025-01-01" })).statusCode,
    ).toBe(400);
    expect((await change(manager, { endDate: "2024-01-01" })).statusCode).toBe(
      400,
    );
    expect((await change(manager, { endDate: "2025-01-01" })).statusCode).toBe(
      200,
    );
  });

  it("refuses a manager's end date before a draft moves a line to them", async () => {
    const manager = await person();
    const report = await person();
    await reportsTo(report, manager, "2024-03-01");
    await changed(report, { managerFrom: "2025-01-01" });
    expect((await change(manager, { endDate: "2024-06-01" })).statusCode).toBe(
      400,
    );
  });

  it("refuses approving a manager's end date before a line to them, drafted since, starts", async () => {
    const manager = await person();
    const report = await person();
    await changed(manager, { endDate: "2026-05-01" });
    // Drafted while the manager's end date is still only a draft, under another editor.
    const other = await test.signedIn("workforce-administrator");
    expect(
      (await change(report, { managerId: manager }, other.cookie)).statusCode,
    ).toBe(200);
    await approved([report]);
    expect((await approve([manager])).statusCode).toBe(400);
  });

  it("checks a line again on approval, against the manager as they are then", async () => {
    const manager = await person();
    const report = await person();
    await changed(report, { managerId: manager, managerFrom: "2024-03-01" });
    await test.connection
      .update(people)
      .set({ startDate: "2025-01-01" })
      .where(eq(people.id, manager));
    expect((await approve([report])).statusCode).toBe(400);
    expect(await linesOf(report)).toEqual([]);
  });

  it("refuses a manager drafted to be removed, and removing someone a draft names as manager, published or not", async () => {
    const leaving = await person();
    const report = await person();
    const removed = await test.request(
      cookie,
      "DELETE",
      `/api/people/${leaving}`,
    );
    expect(removed.statusCode, removed.body).toBe(200);
    expect((await change(report, { managerId: leaving })).statusCode).toBe(400);
    const manager = await person();
    const other = await test.signedIn("workforce-administrator");
    const unpublished = await test.request(
      other.cookie,
      "PATCH",
      `/api/people/${report}`,
      { managerId: manager },
      { publish: false },
    );
    expect(unpublished.statusCode, unpublished.body).toBe(200);
    expect(
      (await test.request(cookie, "DELETE", `/api/people/${manager}`))
        .statusCode,
    ).toBe(409);
  });

  it("is not written when its draft is rejected", async () => {
    const manager = await person();
    const report = await person();
    await changed(report, { managerId: manager });
    const approver = await test.signedIn("engineering-director");
    const response = await test.request(
      approver.cookie,
      "POST",
      "/api/drafts/rejection",
      { people: [report], reason: "Fictional reason" },
    );
    expect(response.statusCode, response.body).toBe(200);
    expect((await approve([report])).statusCode).toBe(409);
    expect(await linesOf(report)).toEqual([]);
  });

  it("is put back as it was by undoing the change of manager", async () => {
    const first = await person();
    const second = await person();
    const report = await person();
    await changed(report, { managerId: first, managerFrom: "2024-03-01" });
    const response = await change(report, { managerId: second });
    const { changeSetId } = response.json<{ changeSetId: string }>();
    const undone = await test.request(
      cookie,
      "POST",
      `/api/undo/${changeSetId}`,
    );
    expect(undone.statusCode, undone.body).toBe(200);
    const shown = await readPerson(report);
    expect(shown?.manager?.id).toBe(first);
    expect(shown?.managerFrom).toBe("2024-03-01");
  });

  it("warns those who see Personal details when the manager's end date has passed", async () => {
    const manager = await person();
    const report = await person();
    await reportsTo(report, manager, "2024-03-01");
    await changed(manager, { endDate: day(-1) });
    await approved([manager]);
    expect((await readPerson(report))?.managerLeft).toBe(true);
    const planner = await test.signedIn(generalReader);
    const seen = await readPerson(report, planner.cookie);
    expect(seen?.manager?.id).toBe(manager);
    expect(seen?.managerLeft).toBeUndefined();
  });
});

describe("who sees reporting lines", () => {
  let manager = "";
  let newManager = "";
  let report = "";

  beforeAll(async () => {
    manager = await person({ preferredName: unique("Fictional Old Manager") });
    newManager = await person();
    report = await person();
    await reportsTo(report, manager, "2024-03-01");
    // A waiting draft moving the report to a new manager.
    await changed(report, { managerId: newManager });
  });

  it.each(rolesGranting("people:view"))(
    "a %s, a role that sees people, sees the live manager, and the draft's manager and the date only if the role lets them see Personal data",
    async (role) => {
      const { cookie: reader } = await test.signedIn(role);
      const seen = await readPerson(report, reader);
      const sees = rolesGranting("personal:view").includes(role);
      expect(seen?.manager?.id).toBe(sees ? newManager : manager);
      expect(seen?.managerFrom).toBe(sees ? today : undefined);
      expect(seen?.draft?.changed).toEqual(
        sees ? ["managerId", "managerFrom"] : undefined,
      );
    },
  );

  it.each(rolesGranting("plan:view"))(
    "a %s, a role that sees the change history, sees changes of manager only if the role lets them see Personal data",
    async (role) => {
      const { cookie: reader } = await test.signedIn(role);
      const history = (
        await test.request(reader, "GET", "/api/changes")
      ).json<ChangeHistory>();
      const shown = JSON.stringify(history).includes('"managerId"');
      expect(shown).toBe(rolesGranting("personal:view").includes(role));
    },
  );

  it("records changing a line in the access history", async () => {
    const recorded = await test.connection
      .select({ subjectId: accessHistory.subjectId })
      .from(accessHistory)
      .where(eq(accessHistory.actorId, editorId));
    expect(recorded.map(({ subjectId }) => subjectId)).toContain(report);
  });
});
