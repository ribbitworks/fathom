// SPDX-License-Identifier: Apache-2.0

// Integration tests for publishing a private change to a record only drafted to be added, whose
// addition is approved meanwhile: it publishes as a change to the live record, or as its removal.

import { drafts } from "@fathom/db";
import { and, eq } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { unique } from "./test-app.ts";
import {
  alice,
  bob,
  closeUnpublishedTests,
  decide,
  discard,
  draftPeople,
  publish,
  saved,
  startUnpublishedTests,
  test,
} from "./test-unpublished.ts";

beforeAll(startUnpublishedTests);

afterAll(closeUnpublishedTests);

afterEach(async () => {
  await discard(alice);
  await discard(bob);
});

// No route shows a published draft apart from the drafts over it, so the tests read storage.
const publishedOf = async (id: string) =>
  (
    await test.connection
      .select({ action: drafts.action, fields: drafts.fields })
      .from(drafts)
      .where(and(eq(drafts.recordType, "person"), eq(drafts.recordId, id)))
  )[0];

// Ana adds Kai and publishes; Ben then changes Kai privately, and Kai's addition is approved.
async function approvedAfter(change: (kai: string) => Promise<unknown>) {
  const [kai = ""] = await draftPeople(alice, [unique("Fictional Kai")]);
  await publish(alice);
  await change(kai);
  expect((await decide("approval", { people: [kai] })).statusCode).toBe(200);
  return kai;
}

describe("a private change to a record whose addition was approved since", () => {
  it("publishes as a change to the live record", async () => {
    const renamed = unique("Fictional Renamed");
    const kai = await approvedAfter((id) =>
      saved(bob, "PATCH", `/api/people/${id}`, { preferredName: renamed }),
    );

    expect(await publish(bob)).toBe(1);

    expect(await publishedOf(kai)).toEqual({
      action: "changed",
      fields: { preferredName: renamed },
    });
  });

  it("publishes a removal as the live record's removal", async () => {
    const kai = await approvedAfter((id) =>
      saved(bob, "DELETE", `/api/people/${id}`),
    );

    expect(await publish(bob)).toBe(1);

    expect(await publishedOf(kai)).toEqual({ action: "deleted", fields: {} });
  });
});
