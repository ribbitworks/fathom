// SPDX-License-Identifier: Apache-2.0

// Tests for the drafts an Approver approves or rejects at once, and the area each kind belongs to.

import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { permissionGrid } from "./access.ts";
import {
  approvableKinds,
  approvePermissions,
  draftKinds,
  draftsAtOnce,
  draftsRequestSchema,
  draftsWhere,
  kindsAsked,
  planningSettingsId,
  recordRefSchema,
  rejectionRequestSchema,
} from "./drafts.ts";

const message = (result: { error?: { issues: { message: string }[] } }) =>
  result.error?.issues[0]?.message;

describe("draftsRequestSchema", () => {
  it("accepts drafts of any kind", () => {
    expect(draftsRequestSchema.parse({ people: [randomUUID()] }).lists).toEqual(
      [],
    );
  });

  const tooFewOrMany = `Choose from 1 to ${String(draftsAtOnce)} drafts`;
  const ids = (count: number) =>
    Array.from({ length: count }, () => randomUUID());

  it("refuses a request for no drafts", () => {
    expect(message(draftsRequestSchema.safeParse({}))).toBe(tooFewOrMany);
  });

  it("refuses more drafts than are approved at once", () => {
    expect(
      message(
        draftsRequestSchema.safeParse({
          people: ids(draftsAtOnce / 2 + 1),
          lists: ids(draftsAtOnce / 2),
        }),
      ),
    ).toBe(tooFewOrMany);
  });

  it("refuses the same record of the plan twice", () => {
    const id = randomUUID();
    expect(
      message(
        draftsRequestSchema.safeParse({
          records: [
            { type: "release", id },
            { type: "release", id },
          ],
        }),
      ),
    ).toBe("Each record once");
  });

  it("refuses the same draft twice", () => {
    const id = randomUUID();
    expect(message(draftsRequestSchema.safeParse({ choices: [id, id] }))).toBe(
      "Each choice once",
    );
  });
});

describe("rejectionRequestSchema", () => {
  const columns = [randomUUID()];

  it("keeps a rejection's reason trimmed", () => {
    expect(
      rejectionRequestSchema.safeParse({ columns, reason: " Not now " }).data
        ?.reason,
    ).toBe("Not now");
  });

  it("needs a reason", () => {
    expect(
      rejectionRequestSchema.safeParse({ columns, reason: " " }).success,
    ).toBe(false);
  });

  it("needs drafts", () => {
    expect(
      message(rejectionRequestSchema.safeParse({ reason: "Not now" })),
    ).toBe(`Choose from 1 to ${String(draftsAtOnce)} drafts`);
  });
});

describe("approving by area", () => {
  const release = { type: "release" as const, id: randomUUID() };
  const stream = { type: "release-stream" as const, id: randomUUID() };
  const everyKind = draftsRequestSchema.parse({
    people: [randomUUID()],
    plannedHires: [randomUUID()],
    featureTeams: [randomUUID()],
    lists: [randomUUID()],
    choices: [randomUUID()],
    orders: [randomUUID()],
    columns: [randomUUID()],
    records: [
      release,
      stream,
      ...(
        [
          "cycle-pattern",
          "feature",
          "customer",
          "proposal",
          "project",
          "milestone",
          "allocation",
        ] as const
      ).map((type) => ({ type, id: randomUUID() })),
      { type: "planning-settings", id: planningSettingsId },
    ],
  });

  it("approves each kind with an Approve permission on the Roles grid", () => {
    const approving = new Set(
      permissionGrid.flatMap(({ actions }) =>
        actions.approve === undefined ? [] : [actions.approve],
      ),
    );
    for (const kind of draftKinds) {
      // The kind is always one of the fixed list.
      // eslint-disable-next-line security/detect-object-injection
      for (const permission of approvePermissions[kind]) {
        expect(approving).toContain(permission);
      }
    }
  });

  it("finds every kind asked for, and none when nothing is", () => {
    expect(kindsAsked(everyKind)).toEqual([...draftKinds]);
    expect(
      kindsAsked(draftsRequestSchema.parse({ records: [release] })),
    ).toEqual(["release"]);
  });

  it("keeps only the drafts of the kinds wanted", () => {
    expect(draftsWhere(everyKind, (kind) => kind === "release-stream")).toEqual(
      {
        people: [],
        plannedHires: [],
        featureTeams: [],
        lists: [],
        choices: [],
        orders: [],
        columns: [],
        records: [stream],
      },
    );
    expect(draftsWhere(everyKind, () => true)).toEqual(everyKind);
  });

  it("names the kinds some permissions approve", () => {
    expect(approvableKinds(["people:approve", "features:approve"])).toEqual([
      "person",
      "release",
      "feature",
    ]);
    expect(approvableKinds(["plan:approve", "people:view"])).toEqual([
      "release-stream",
      "cycle-pattern",
      "customer",
      "proposal",
      "project",
      "milestone",
    ]);
    expect(approvableKinds(["features:edit", "people:view"])).toEqual([]);
  });
});

describe("naming a record", () => {
  it("takes a record's identifier, or the planning settings' name", () => {
    for (const id of [randomUUID(), planningSettingsId]) {
      expect(recordRefSchema.safeParse({ type: "release", id }).success).toBe(
        true,
      );
    }
  });

  it("refuses any other name", () => {
    expect(
      recordRefSchema.safeParse({ type: "release", id: "settings" }).success,
    ).toBe(false);
  });
});
