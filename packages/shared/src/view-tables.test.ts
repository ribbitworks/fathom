// SPDX-License-Identifier: Apache-2.0

// Tests for each view table's choices: the parameters its page keeps in a view, which a request
// must fit as a whole; and for who shares each table's views.

import { describe, expect, it } from "vitest";
import {
  sharesViews,
  viewChoiceSchemas,
  viewTableSchema,
} from "./view-tables.ts";

const stream = "6f1d6a52-0c1e-4a51-9b0f-1d2c3e4f5a6b";

describe("Features' choices", () => {
  const fits = (choices: object) =>
    viewChoiceSchemas.features.safeParse(choices).success;

  it("accepts the Board's stream and the card parts hidden", () => {
    expect(fits({ stream, hide: ["status", "size"] })).toBe(true);
    expect(fits({})).toBe(true);
  });

  it.each([
    [
      "the table or the board, which the two share a view across",
      { mode: "board" },
    ],
    ["a stream that isn't an identifier", { stream: "Platform" }],
    ["a card part it doesn't have", { hide: ["colour"] }],
    ["a card part twice", { hide: ["status", "status"] }],
    ["a choice it doesn't keep", { from: "2026-01-01" }],
  ])("refuses %s", (_, choices) => {
    expect(fits(choices)).toBe(false);
  });
});

describe("the choices of tables whose pages keep none", () => {
  it.each(viewTableSchema.options.filter((table) => table !== "features"))(
    "refuses any choice on %s, and accepts none",
    (table) => {
      // The table is always one of the fixed tables.
      // eslint-disable-next-line security/detect-object-injection
      const choices = viewChoiceSchemas[table];
      expect(choices.safeParse({}).success).toBe(true);
      expect(choices.safeParse({ hide: ["status"] }).success).toBe(false);
    },
  );
});

describe("Sharing views", () => {
  it.each(viewTableSchema.options.filter((table) => table !== "accounts"))(
    "shares %s's views with Edit Configuration alone",
    (table) => {
      expect(sharesViews(table, ["configuration:edit"])).toBe(true);
      expect(sharesViews(table, ["administration:edit"])).toBe(false);
    },
  );

  it("shares Accounts' views with Edit Administration alone", () => {
    expect(sharesViews("accounts", ["administration:edit"])).toBe(true);
    expect(sharesViews("accounts", ["configuration:edit"])).toBe(false);
  });
});
