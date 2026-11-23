// SPDX-License-Identifier: Apache-2.0

// Integration tests for the org chart on a chosen day, against a migrated PostgreSQL server, with
// drafts laid over it for those who may change reporting lines from it.

import { accessHistory, dataClasses } from "@fathom/db";
import { type Permission } from "@fathom/shared";
import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { generalReader, personalReader, testPosition } from "./test-app.ts";
import {
  test,
  cookie,
  unique,
  approved,
  person,
  changed,
  chartOn,
  startOrgChartTests,
  closeOrgChartTests,
} from "./test-org-chart.ts";

beforeAll(startOrgChartTests);

afterAll(closeOrgChartTests);

describe("the org chart on a chosen day", () => {
  it("shows each person under the manager they had that day", async () => {
    const earlier = await person();
    const later = await person();
    const report = await person({ isManager: false });
    await changed(report, { managerId: earlier, managerFrom: "2024-01-01" });
    await approved([report]);
    await changed(report, { managerId: later, managerFrom: "2024-03-01" });
    await approved([report]);

    expect((await chartOn("2024-02-29")).get(report)?.managerId).toBe(earlier);
    expect((await chartOn("2024-03-01")).get(report)?.managerId).toBe(later);
  });

  it("shows only those employed that day", async () => {
    const starter = await person({ startDate: "2024-06-01" });

    expect((await chartOn("2024-05-31")).has(starter)).toBe(false);
    expect((await chartOn("2024-06-01")).has(starter)).toBe(true);
  });

  // A report under one manager from 2024-01-01, drafted to another from the day given.
  async function draftedReport(from: string) {
    const first = await person();
    const second = await person();
    const report = await person({ isManager: false });
    await changed(report, { managerId: first, managerFrom: "2024-01-01" });
    await approved([report]);
    await changed(report, { managerId: second, managerFrom: from });
    return { first, second, report };
  }

  it("lays drafts over an earlier day for those who may change reporting lines then", async () => {
    const { first, second, report } = await draftedReport("2024-03-01");

    expect((await chartOn("2024-06-01")).get(report)).toMatchObject({
      managerId: first,
      draft: { managerId: second, managerFrom: "2024-03-01" },
    });
    expect(
      (await chartOn("2024-06-01", cookie, "drafted")).get(report)?.managerId,
    ).toBe(second);
  });

  it("leaves a line drafted from a later day out of an earlier one", async () => {
    const { first, report } = await draftedReport("2024-03-01");

    const shown = (await chartOn("2024-02-01")).get(report);

    expect(shown?.managerId).toBe(first);
    expect(shown?.draft).toBeUndefined();
    expect(
      (await chartOn("2024-02-01", cookie, "drafted")).get(report)?.managerId,
    ).toBe(first);
  });

  it("dates a draft changing only the manager as the current line is", async () => {
    const { report } = await draftedReport("2024-03-01");
    await approved([report]);
    const third = await person();
    await changed(report, { managerId: third, managerFrom: "2024-03-01" });

    expect((await chartOn("2024-02-01")).get(report)?.draft).toBeUndefined();
    expect((await chartOn("2024-06-01")).get(report)?.draft).toEqual({
      managerId: third,
      managerFrom: "2024-03-01",
      state: "waiting",
      unpublished: false,
    });
  });

  it("lays a draft moving only the line's date over an earlier day, with the date", async () => {
    const manager = await person();
    const report = await person({ isManager: false });
    await changed(report, { managerId: manager, managerFrom: "2024-01-01" });
    await approved([report]);
    await changed(report, { managerFrom: "2024-04-01" });

    expect((await chartOn("2024-03-01")).get(report)?.draft).toEqual({
      managerId: null,
      managerFrom: "2024-04-01",
      state: "waiting",
      unpublished: false,
    });
  });

  it("draws someone drafted to be added under their manager on an earlier day", async () => {
    const manager = await person();
    const added = await test.request(cookie, "POST", "/api/people", {
      people: [
        {
          preferredName: unique("Fictional Person"),
          employeeId: unique("OC"),
          positionId: testPosition,
          startDate: "2020-01-01",
          managerId: manager,
          managerFrom: "2024-01-01",
        },
      ],
    });
    const id = String(added.json<{ ids: string[] }>().ids[0]);

    const drafted = await chartOn("2024-06-01", cookie, "drafted");

    expect(drafted.get(id)?.managerId).toBe(manager);
  });

  it.each([
    ["people:edit", "personal:view"],
    ["personal:edit", "personal:view"],
  ])(
    "shows an earlier day as approved, without drafts, to those with %s alone",
    async (...granted) => {
      const { first, report } = await draftedReport("2024-03-01");
      const reader = await test.signedIn([
        "people:view",
        ...granted,
      ] as Permission[]);

      const shown = (await chartOn("2024-06-01", reader.cookie)).get(report);

      expect(shown?.managerId).toBe(first);
      expect(shown?.draft).toBeUndefined();
    },
  );

  it("lays drafts over an earlier day for those who change past managers' class, wherever it is kept", async () => {
    const { report } = await draftedReport("2024-03-01");
    const editor = await test.signedIn([
      "people:view",
      "people:edit",
      "feature-teams:view",
      "personal:view",
    ]);
    await test.connection
      .insert(dataClasses)
      .values({ field: "managerHistory", dataClass: "general" });
    try {
      const shown = (await chartOn("2024-06-01", editor.cookie)).get(report);

      expect(shown?.draft).toBeDefined();
    } finally {
      await test.connection.delete(dataClasses);
    }
  });

  it("shows an earlier day as approved to those who edit Personal details once past managers are kept Confidential", async () => {
    const { report } = await draftedReport("2024-03-01");
    const editor = await test.signedIn([
      "people:view",
      "people:edit",
      "feature-teams:view",
      "personal:view",
      "personal:edit",
      "confidential:view",
    ]);
    await test.connection
      .insert(dataClasses)
      .values({ field: "managerHistory", dataClass: "confidential" });
    try {
      const shown = (await chartOn("2024-06-01", editor.cookie)).get(report);

      expect(shown?.draft).toBeUndefined();
    } finally {
      await test.connection.delete(dataClasses);
    }
  });

  it("shows the chart as approved, without drafts, to those who may not change reporting lines", async () => {
    const { first, report } = await draftedReport("2024-03-01");
    const reader = await test.signedIn("engineering-manager");

    const shown = (await chartOn("2024-06-01", reader.cookie)).get(report);

    expect(shown?.managerId).toBe(first);
    expect(shown?.draft).toBeUndefined();
  });

  it("shows a later day as approved, without drafts, since reporting lines are not dated ahead", async () => {
    const { first, report } = await draftedReport("2024-03-01");

    const shown = (await chartOn("2026-07-01")).get(report);

    expect(shown?.managerId).toBe(first);
    expect(shown?.draft).toBeUndefined();
  });

  it.each([
    ["engineering-manager", 200],
    ["engineering-director", 200],
    ["workforce-administrator", 200],
    ["executive", 200],
    ["team-member", 403],
    ["product-manager", 403],
    ["feature-lead", 403],
    ["project-manager", 200],
  ] as const)("answers %s with %i", async (role, status) => {
    const reader = await test.signedIn(role);

    const response = await test.request(
      reader.cookie,
      "GET",
      "/api/org-chart?on=2024-06-01",
    );

    expect(response.statusCode).toBe(status);
  });

  it("is refused without View People", async () => {
    const reader = await test.signedIn(["personal:view"]);

    expect(
      (await test.request(reader.cookie, "GET", "/api/org-chart?on=2024-06-01"))
        .statusCode,
    ).toBe(403);
  });

  it("is refused when signed out", async () => {
    expect(
      (await test.request("", "GET", "/api/org-chart?on=2024-06-01"))
        .statusCode,
    ).toBe(401);
  });

  it("is refused a day that does not exist", async () => {
    expect(
      (await test.request(cookie, "GET", "/api/org-chart?on=2024-02-30"))
        .statusCode,
    ).toBe(400);
  });

  it("is refused on a later day to readers who do not see Confidential data", async () => {
    const reader = await test.signedIn(personalReader);

    const response = await test.request(
      reader.cookie,
      "GET",
      "/api/org-chart?on=2099-06-01",
    );

    expect(response.statusCode).toBe(403);
    expect(response.json<{ error: string }>().error).toBe(
      "Future dates need Confidential access.",
    );
  });

  it("is refused to readers who do not see Personal details", async () => {
    const reader = await test.signedIn(generalReader);

    const response = await test.request(
      reader.cookie,
      "GET",
      "/api/org-chart?on=2024-06-01",
    );

    expect(response.statusCode).toBe(403);
    expect(response.json<{ error: string }>().error).toBe(
      "Other dates need Personal access.",
    );
  });

  it("records a view of Personal details", async () => {
    const reader = await test.signedIn("engineering-director");

    await chartOn("2024-06-01", reader.cookie);

    expect(
      await test.connection
        .select({ id: accessHistory.id })
        .from(accessHistory)
        .where(
          and(
            eq(accessHistory.actorId, reader.id),
            eq(accessHistory.action, "personal-viewed"),
          ),
        ),
    ).not.toEqual([]);
  });
});
