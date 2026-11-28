// SPDX-License-Identifier: Apache-2.0

// Integration tests for a filled planned hire on the org chart, against a migrated PostgreSQL server
// of their own, so no other test's drafts record a view of Personal details for its readers: where
// its card is sent, and the view that sending it records.

import { accessHistory, listItems, plannedHires } from "@fathom/db";
import { and, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { testPosition } from "./test-app.ts";
import {
  test,
  person,
  chart,
  filledOnTeams,
  startOrgChartTests,
  closeOrgChartTests,
} from "./test-org-chart.ts";

beforeAll(startOrgChartTests);

afterAll(closeOrgChartTests);

describe("a filled planned hire on the chart", () => {
  // An open hire filled by someone, as a fill's approval leaves it.
  const filledHire = async (filledBy: string, temporaryNumber: number) => {
    const states = await test.connection
      .select({ id: listItems.id })
      .from(listItems)
      .where(eq(listItems.meaning, "open"))
      .limit(1);
    const id = randomUUID();
    await test.connection.insert(plannedHires).values({
      id,
      temporaryNumber,
      positionId: testPosition,
      stateId: String(states[0]?.id),
      filledBy,
    });
    return id;
  };

  it("is on the chart only to those who do not see its person while they have not started, and on its teams alone to those who do", async () => {
    const starter = await person({ startDate: "2026-08-03", isManager: false });
    const started = await person({ isManager: false });
    const waiting = await filledHire(starter, 900_101);
    const done = await filledHire(started, 900_102);
    const viewer = await test.signedIn(["people:view", "feature-teams:view"]);
    const shown = await chart(viewer.cookie);
    expect(shown.get(waiting)?.planned).toEqual({
      expected: "2026-08",
      shownId: "TBD-900101",
    });
    expect(shown.has(done)).toBe(false);
    expect((await filledOnTeams(viewer.cookie)).size).toBe(0);
    expect((await chart()).has(waiting)).toBe(false);
    const onTeams = await filledOnTeams();
    expect(onTeams.get(waiting)).toMatchObject({
      preferredName: "Fictional Engineer, TBD-900101",
      position: "Fictional Engineer",
      employeeId: null,
      planned: { expected: "2026-08", shownId: "TBD-900101" },
    });
    expect(onTeams.has(done)).toBe(false);
  });

  it("records a view of Personal details when its card is sent for feature teams", async () => {
    const starter = await person({ startDate: "2026-08-03", isManager: false });
    const waiting = await filledHire(starter, 900_103);
    const viewer = await test.signedIn([
      "people:view",
      "feature-teams:view",
      "personal:view",
    ]);

    const filled = await filledOnTeams(viewer.cookie);

    expect(filled.has(waiting)).toBe(true);
    const views = await test.connection
      .select({ id: accessHistory.id })
      .from(accessHistory)
      .where(
        and(
          eq(accessHistory.actorId, viewer.id),
          eq(accessHistory.action, "personal-viewed"),
        ),
      );
    expect(views).toHaveLength(1);
  });
});
