// SPDX-License-Identifier: Apache-2.0

// Access control tests for the change history's configuration and columns: configuration is seen
// with View Configuration, whether or not the role sees people, and a column with its table's
// records, whether or not the role sees configuration.

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  closeUnpublishedTests,
  history,
  startUnpublishedTests,
  user,
  type User,
} from "./test-unpublished.ts";

beforeAll(startUnpublishedTests);

afterAll(closeUnpublishedTests);

const kindsSeenBy = async (who: User) =>
  new Set(
    (await history(who)).flatMap(({ records }) =>
      records.map(({ kind }) => kind),
    ),
  );

describe("the change history", () => {
  it("shows configuration, but no column or person, to a role that sees configuration alone", async () => {
    const kinds = await kindsSeenBy(await user(["configuration:view"]));

    expect(kinds.has("list")).toBe(true);
    expect(kinds.has("field")).toBe(false);
    expect(kinds.has("person")).toBe(false);
  });

  it("shows People's columns to a role that sees people, without configuration", async () => {
    const kinds = await kindsSeenBy(await user(["people:view"]));

    expect(kinds.has("field")).toBe(true);
    expect(kinds.has("list")).toBe(false);
  });
});
