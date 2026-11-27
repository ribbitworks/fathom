// SPDX-License-Identifier: Apache-2.0

// Integration tests for adding several of the plan's records of one kind at once: all in one change
// set or none, with their identifiers in the order asked.

import { changes } from "@fathom/db";
import type { ProjectPlan } from "@fathom/shared";
import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { errorOf, ok, unique } from "./test-app.ts";
import {
  addPerson,
  addProject,
  closeProjectTests,
  readPlan,
  send,
  startProjectTests,
  test,
} from "./test-projects.ts";

beforeAll(startProjectTests);

afterAll(closeProjectTests);

interface Added {
  plan: ProjectPlan;
  ids: string[];
  changeSetId: string;
}

// Each kind: where its records are added, a row of it named as given, one the server refuses once
// it has the others, with the status it refuses with, and its records in the plan.
interface Kind {
  path: string;
  row: (name: string, projectId: string) => object;
  refused: (name: string, first: string) => object;
  refusedWith: number;
  records: (plan: ProjectPlan) => readonly { id: string; name: string }[];
}

const conflict = 409;
const notFound = 404;

const linkingNothing = { customerIds: [randomUUID()] };

const kinds: Record<string, Kind> = {
  customers: {
    path: "/api/customers",
    row: (name) => ({ name }),
    refused: (_name, first) => ({ name: first }),
    refusedWith: conflict,
    records: (plan) => plan.customers,
  },
  projects: {
    path: "/api/projects",
    row: (name) => ({ name }),
    refused: (name) => ({ name, ...linkingNothing }),
    refusedWith: notFound,
    records: (plan) => plan.projects,
  },
  proposals: {
    path: "/api/proposals",
    row: (name) => ({ name }),
    refused: (name) => ({ name, ...linkingNothing }),
    refusedWith: notFound,
    records: (plan) => plan.proposals,
  },
  features: {
    path: "/api/features",
    row: (name) => ({ name }),
    refused: (name) => ({ name, ...linkingNothing }),
    refusedWith: notFound,
    records: (plan) => plan.features,
  },
  milestones: {
    path: "/api/milestones",
    row: (name, projectId) => ({ name, projectId, date: "2027-01-04" }),
    refused: (name) => ({ name, projectId: randomUUID(), date: "2027-01-04" }),
    refusedWith: notFound,
    records: (plan) => plan.projects.flatMap(({ milestones }) => milestones),
  },
  activities: {
    path: "/api/activities",
    row: (name, projectId) => ({ name, projectId }),
    refused: (name) => ({ name, projectId: randomUUID() }),
    refusedWith: notFound,
    records: (plan) => plan.activities,
  },
};

const rowsAtOnce = 3;

describe.each(Object.entries(kinds))(
  "adding several %s at once",
  (_kind, { path, row, refused, refusedWith, records }) => {
    const names = () =>
      Array.from({ length: rowsAtOnce }, () => unique("Fictional Pasted"));

    it("adds every row in one change set, giving their identifiers in order", async () => {
      const { id: projectId } = await addProject();
      const asked = names();

      const added = await ok<Added>(
        await send(
          "POST",
          path,
          { records: asked.map((name) => row(name, projectId)) },
          { publish: false },
        ),
        201,
      );

      expect(added.changeSetId).toEqual(expect.any(String));
      const shown = new Map(
        records(added.plan).map(({ id, name }) => [id, name]),
      );
      expect(added.ids.map((id) => shown.get(id))).toEqual(asked);
    });

    it("adds none when one row is refused", async () => {
      const { id: projectId } = await addProject();
      const [first = "", second = "", third = ""] = names();

      const response = await send(
        "POST",
        path,
        {
          records: [
            row(first, projectId),
            refused(second, first),
            row(third, projectId),
          ],
        },
        { publish: false },
      );

      expect(response.statusCode, response.body).toBe(refusedWith);
      const kept = records(await readPlan()).map(({ name }) => name);
      expect(kept).not.toContain(first);
      expect(kept).not.toContain(third);
    });

    it("records every row in the one change set that undoing names", async () => {
      const { id: projectId } = await addProject();
      const { ids, changeSetId } = await ok<Added>(
        await send(
          "POST",
          path,
          { records: names().map((name) => row(name, projectId)) },
          { publish: false },
        ),
        201,
      );

      const recorded = await test.connection
        .selectDistinct({ recordId: changes.recordId })
        .from(changes)
        .where(eq(changes.changeSetId, changeSetId));
      expect(recorded.map(({ recordId }) => recordId).sort()).toEqual(
        [...ids].sort(),
      );
    });
  },
);

describe("adding milestones at once", () => {
  it("adds them to each project they name", async () => {
    const [first, second] = [await addProject(), await addProject()];
    const asked = [
      { projectId: first.id, name: unique("Fictional Kickoff") },
      { projectId: second.id, name: unique("Fictional Handover") },
    ];

    const { plan, ids } = await ok<Added>(
      await send(
        "POST",
        "/api/milestones",
        { records: asked.map((one) => ({ ...one, date: "2027-01-04" })) },
        { publish: false },
      ),
      201,
    );

    const shown = plan.projects.flatMap(({ milestones }) => milestones);
    expect(
      ids.map((id) => {
        const found = shown.find((milestone) => milestone.id === id);
        return { projectId: found?.projectId, name: found?.name };
      }),
    ).toEqual(asked);
  });
});

describe.each([
  ["projects", "/api/projects", (plan: ProjectPlan) => plan.projects],
  ["proposals", "/api/proposals", (plan: ProjectPlan) => plan.proposals],
])("adding several %s at once with owners", (_kind, path, records) => {
  it("refuses them all when a later row's owner isn't one of People", async () => {
    const ownerId = await addPerson();
    const asked = [unique("Fictional Owned"), unique("Fictional Owned")];

    const response = await send(
      "POST",
      path,
      {
        records: [
          { name: asked[0], ownerId },
          { name: asked[1], ownerId: randomUUID() },
        ],
      },
      { publish: false },
    );

    expect(response.statusCode).toBe(400);
    expect(errorOf(response)).toBe("Choose an owner from People");
    const kept = records(await readPlan()).map(({ name }) => name);
    expect(kept).not.toContain(asked[0]);
  });
});
