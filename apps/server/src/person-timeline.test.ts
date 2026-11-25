// SPDX-License-Identifier: Apache-2.0

// Tests for a person's timeline, against a migrated PostgreSQL server: the planned hire they filled,
// their start, managers, feature teams and teams led, as each role may see them; refused to a role
// that doesn't see start and end dates, and for someone who doesn't exist.

import {
  accessHistory,
  dataClasses,
  featureTeamLeads,
  featureTeamMemberships,
  featureTeams,
  reportingLines,
} from "@fathom/db";
import type { Permission, Timeline } from "@fathom/shared";
import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { rolesGranting } from "./access.ts";
import { unique } from "./test-app.ts";
import {
  approved,
  closeFillTests,
  editor,
  existing,
  filled,
  hire,
  person,
  send,
  startFillTests,
  test,
} from "./test-fills.ts";

beforeAll(startFillTests);

afterAll(closeFillTests);

const timelineOf = (id: string, who = editor) =>
  send(who, "GET", `/api/people/${id}/timeline`);

// Someone who reports to one manager, then another, filled a planned hire, was on a feature team
// and led it, and the person and their two managers.
async function story() {
  const first = await person({ preferredName: unique("Fictional Ana") });
  const second = await person({ preferredName: unique("Fictional Ben") });
  const report = await person({ preferredName: unique("Fictional Kai") });
  await send(editor, "PATCH", `/api/people/${report}`, {
    managerId: first,
    managerFrom: "2021-01-04",
  });
  await approved({ people: [report] });
  await send(editor, "PATCH", `/api/people/${report}`, {
    managerId: second,
    managerFrom: "2022-03-07",
  });
  await approved({ people: [report] });
  const hireId = await hire();
  await filled(hireId, existing(report));
  await approved({ plannedHires: [hireId] });
  const [team] = await test.connection
    .insert(featureTeams)
    .values({ name: unique("Fictional Search") })
    .returning({ id: featureTeams.id });
  const teamId = String(team?.id);
  await test.connection.insert(featureTeamMemberships).values([
    { teamId, personId: report, member: true, fromDate: "2021-02-01" },
    { teamId, personId: report, member: false, fromDate: "2023-05-01" },
  ]);
  await test.connection.insert(featureTeamLeads).values([
    { teamId, leadId: report, fromDate: "2022-01-03" },
    { teamId, leadId: null, fromDate: "2023-05-01" },
  ]);
  return { first, second, report, teamId };
}

describe("a person's timeline", () => {
  it("lists their start, the hire they filled, their managers, feature teams and teams led, by day", async () => {
    const { first, second, report, teamId } = await story();

    const response = await timelineOf(report);

    expect(response.statusCode, response.body).toBe(200);
    const { days } = response.json<Timeline>();
    const fields = days.flatMap(({ changes }) =>
      changes.map(({ field }) => field),
    );
    expect(fields).toEqual(
      expect.arrayContaining([
        "start",
        "manager",
        "featureTeams",
        "leads",
        "filled",
      ]),
    );
    const managers = days.flatMap(({ changes }) =>
      changes.filter(({ field }) => field === "manager"),
    );
    expect(managers.map(({ value }) => value?.id)).toEqual([first, second]);
    expect(managers[1]?.was?.id).toBe(first);
    const teams = days.flatMap(({ changes }) =>
      changes.filter(({ field }) => field === "featureTeams"),
    );
    expect(teams.map(({ value, part }) => [value?.id, part])).toEqual([
      [teamId, "added"],
      [teamId, "removed"],
    ]);
    const leading = days.flatMap(({ changes }) =>
      changes.filter(({ field }) => field === "leads"),
    );
    expect(leading.map(({ part }) => part)).toEqual(["added", "removed"]);
    expect(
      days.find(({ changes }) =>
        changes.some(({ field }) => field === "filled"),
      )?.changes[0]?.value?.name,
    ).toMatch(/^HIRE-\d+$/u);
  });

  it("names no manager from the day a manager is taken away", async () => {
    const manager = await person();
    const report = await person();
    await send(editor, "PATCH", `/api/people/${report}`, {
      managerId: manager,
      managerFrom: "2021-01-04",
    });
    await approved({ people: [report] });
    await send(editor, "PATCH", `/api/people/${report}`, {
      managerId: null,
      managerFrom: "2022-03-07",
    });
    await approved({ people: [report] });

    const { days } = (await timelineOf(report)).json<Timeline>();

    const last = days
      .flatMap(({ changes }) => changes)
      .findLast(({ field }) => field === "manager");
    expect(last).toMatchObject({ value: null, was: { id: manager } });
  });

  it("counts the others given the same new manager that day, leaving out those starting with them", async () => {
    const first = await person();
    const second = await person();
    const [kai, lea, starter] = [
      await person(),
      await person(),
      await person(),
    ];
    for (const report of [kai, lea]) {
      await send(editor, "PATCH", `/api/people/${report}`, {
        managerId: first,
        managerFrom: "2021-01-04",
      });
      await approved({ people: [report] });
      await send(editor, "PATCH", `/api/people/${report}`, {
        managerId: second,
        managerFrom: "2022-03-07",
      });
      await approved({ people: [report] });
    }
    await send(editor, "PATCH", `/api/people/${starter}`, {
      managerId: second,
      managerFrom: "2022-03-07",
    });
    await approved({ people: [starter] });

    const { days } = (
      await timelineOf(kai, await test.signedIn("engineering-director"))
    ).json<Timeline>();

    const moved = days
      .flatMap(({ changes }) => changes)
      .findLast(({ field }) => field === "manager");
    expect(moved).toMatchObject({ value: { id: second }, others: 1 });
  });

  it("lists only their start and managers for someone with no feature teams or hires", async () => {
    const { first } = await story();

    const { days } = (await timelineOf(first)).json<Timeline>();

    const fields = new Set(
      days.flatMap(({ changes }) => changes.map(({ field }) => field)),
    );
    expect(
      [...fields].every((field) => ["start", "manager"].includes(field)),
    ).toBe(true);
    expect(fields.has("start")).toBe(true);
  });

  it("leaves out feature teams for a role without them, and a later day's manager for one without Confidential", async () => {
    const { report, first } = await story();
    await test.connection
      .insert(reportingLines)
      .values({ personId: report, managerId: first, fromDate: "2099-01-04" });
    const reader = await test.signedIn(["people:view", "personal:view"]);

    const response = await timelineOf(report, reader);

    expect(response.statusCode, response.body).toBe(200);
    const fields = response
      .json<Timeline>()
      .days.flatMap(({ changes }) => changes.map(({ field }) => field));
    expect(fields).toContain("start");
    expect(fields).not.toContain("featureTeams");
    expect(fields).not.toContain("leads");
    expect(fields).not.toContain("filled");
    expect(response.json<Timeline>().days.some(({ day }) => day > "2090")).toBe(
      false,
    );
  });

  it("leaves out past managers and feature teams once their classes are Confidential", async () => {
    const { report } = await story();
    const reader = await test.signedIn([
      "people:view",
      "personal:view",
      "feature-teams:view",
    ]);
    await test.connection.insert(dataClasses).values([
      { field: "managerHistory", dataClass: "confidential" },
      { field: "featureTeamDates", dataClass: "confidential" },
    ]);
    try {
      const response = await timelineOf(report, reader);

      expect(response.statusCode, response.body).toBe(200);
      const fields = response
        .json<Timeline>()
        .days.flatMap(({ changes }) => changes.map(({ field }) => field));
      expect(fields).toContain("start");
      expect(fields).not.toContain("manager");
      expect(fields).not.toContain("featureTeams");
      expect(fields).not.toContain("leads");
    } finally {
      await test.connection.delete(dataClasses);
    }
  });

  it("is refused for someone who doesn't exist", async () => {
    const response = await timelineOf(randomUUID());

    expect(response.statusCode).toBe(404);
  });

  it.each(rolesGranting("people:view"))(
    "a %s sees it only with start and end dates, and in it only what its classes show",
    async (role) => {
      const { report, first } = await story();
      await test.connection
        .insert(reportingLines)
        .values({ personId: report, managerId: first, fromDate: "2099-01-04" });
      const reader = await test.signedIn(role);

      const response = await timelineOf(report, reader);

      const has = (permission: Permission) =>
        rolesGranting(permission).includes(role);
      if (!has("personal:view")) {
        expect(response.statusCode).toBe(403);
        return;
      }
      expect(response.statusCode, response.body).toBe(200);
      const fields = response
        .json<Timeline>()
        .days.flatMap(({ day, changes }) =>
          changes.map(({ field }) =>
            field === "manager" && day > "2090" ? "later manager" : field,
          ),
        );
      expect(fields.includes("filled")).toBe(
        has("hiring-plan:view") && has("confidential:view"),
      );
      expect(fields.includes("featureTeams")).toBe(has("feature-teams:view"));
      expect(fields.includes("leads")).toBe(has("feature-teams:view"));
      expect(fields.includes("manager")).toBe(true);
      expect(fields.includes("later manager")).toBe(has("confidential:view"));
      const recorded = await test.connection
        .select({ action: accessHistory.action })
        .from(accessHistory)
        .where(eq(accessHistory.actorId, reader.id));
      const actions = recorded.map(({ action }) => action);
      expect(actions).toContain("personal-viewed");
      expect(actions.includes("hiring-plan-viewed")).toBe(
        fields.includes("filled"),
      );
    },
  );
});
