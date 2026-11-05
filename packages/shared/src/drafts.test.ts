// SPDX-License-Identifier: Apache-2.0

// Tests for the drafts an Approver approves or rejects at once.

import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  draftsAtOnce,
  draftsRequestSchema,
  rejectionRequestSchema,
} from "./drafts.ts";

const message = (result: { error?: { issues: { message: string }[] } }) =>
  result.error?.issues[0]?.message;

describe("draftsRequestSchema", () => {
  it("accepts drafts of any kind, counting the column order as one", () => {
    expect(draftsRequestSchema.safeParse({ columnOrder: true }).success).toBe(
      true,
    );
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

  it("refuses more drafts than are approved at once, counting the column order", () => {
    expect(
      message(
        draftsRequestSchema.safeParse({
          people: ids(draftsAtOnce / 2),
          lists: ids(draftsAtOnce / 2),
          columnOrder: true,
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
