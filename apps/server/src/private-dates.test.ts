// SPDX-License-Identifier: Apache-2.0

// Integration tests for the dates the change history judges a person gone by: those the reader may
// see, never another user's private change.

import { recordChanges } from "@fathom/db";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { actorFor } from "./access.ts";
import { notCurrentAmong } from "./data/history-visibility.ts";
import {
  alice,
  bob,
  closeUnpublishedTests,
  startUnpublishedTests,
  test,
  type User,
} from "./test-unpublished.ts";

beforeAll(startUnpublishedTests);

afterAll(closeUnpublishedTests);

const today = "2026-11-27";

const readerOf = (who: User) =>
  actorFor({ id: who.id, name: who.name, email: "" }, "feature-lead");

describe("the dates of a person neither live nor drafted", () => {
  it("are those the reader may see, not another user's private change", async () => {
    // Given a person recorded as started, then Bob's private start date in the future
    const person = randomUUID();
    const dated = (oldValue: string | null, newValue: string) => ({
      recordType: "person",
      recordId: person,
      action: oldValue === null ? ("created" as const) : ("changed" as const),
      field: "startDate",
      tier: "personal",
      oldValue,
      newValue,
      draft: true,
    });
    await recordChanges(test.connection, null, [dated(null, "2020-01-06")]);
    await recordChanges(
      test.connection,
      { userId: bob.id, roleId: null },
      [dated("2020-01-06", "2099-01-05")],
      "edit",
      true,
    );

    // When Alice and Bob are read for
    const forAlice = await notCurrentAmong(
      test.connection,
      readerOf(alice),
      [person],
      today,
    );
    const forBob = await notCurrentAmong(
      test.connection,
      readerOf(bob),
      [person],
      today,
    );

    // Then the person has started for Alice, and not yet for Bob, who made the change
    expect([...forAlice]).toEqual([]);
    expect([...forBob]).toEqual([person]);
  });
});
