// SPDX-License-Identifier: Apache-2.0

// Tests for what each type of column on People keeps and holds, apart from the database: the
// settings, tier, values, and live values of choice and web link columns.

import { describe, expect, it } from "vitest";
import { columnTypes, type LiveValues, typeOf } from "./data/column-types.ts";

const link = { address: "https://example.test/", text: "Example" };
const listOf = new Map([
  ["c1", "l1"],
  ["c2", "l1"],
  ["c9", "l2"],
]);

describe("a column's type", () => {
  it("is a choice column unless recorded as a web link column", () => {
    expect(typeOf({}).type).toBe("choice");
    expect(typeOf({ type: "choice" }).type).toBe("choice");
    expect(typeOf({ type: "link" }).type).toBe("link");
  });
});

describe("choice columns", () => {
  const { choice } = columnTypes;
  const settings = choice.settings({ listId: "l1", multiple: false });

  it("keep their list and whether they take several choices, with no visibility", () => {
    expect(settings).toEqual({
      type: "choice",
      listId: "l1",
      visibility: null,
      multiple: false,
    });
  });

  it("take their tier from their list", () => {
    expect(
      choice.tier(settings, (listId) =>
        listId === "l1" ? "restricted" : "general",
      ),
    ).toBe("restricted");
  });

  it.each([
    [["c1"], true],
    [[], true],
    [undefined, true],
    [["c1", "c2"], false],
    [["c9"], false],
    [link, true],
  ])("hold %j: %s", (value, fits) => {
    expect(choice.fits(settings, value, listOf)).toBe(fits);
  });

  it("hold several choices when they take several", () => {
    expect(
      choice.fits({ listId: "l1", multiple: true }, ["c1", "c2"], listOf),
    ).toBe(true);
  });

  it("count each choice, and nothing else", () => {
    expect(choice.count(["c1", "c2"])).toBe(2);
    expect(choice.count(link)).toBe(0);
  });

  it("show their live choices beside a draft, or none", () => {
    const live: LiveValues = { values: {}, links: {} };
    choice.showLive(live, "f1", ["c1"]);
    choice.showLive(live, "f2", undefined);
    expect(live).toEqual({ values: { f1: ["c1"], f2: [] }, links: {} });
  });
});

describe("web link columns", () => {
  const { link: linkType } = columnTypes;
  const settings = linkType.settings({
    visibility: "confidential",
    listId: "l1",
  });

  it("keep a visibility of their own, and no list", () => {
    expect(settings).toEqual({
      type: "link",
      listId: null,
      visibility: "confidential",
      multiple: false,
    });
  });

  it("take their tier from their visibility, or the most sensitive for one not known", () => {
    expect(linkType.tier(settings, () => "general")).toBe("confidential");
    expect(
      linkType.tier(
        linkType.settings({ visibility: "secret" }),
        () => "general",
      ),
    ).toBe("confidential");
  });

  it.each([
    [link, true],
    [undefined, true],
    [[], true],
    [null, true],
    [["c1"], false],
    ["https://example.test/", false],
    [{ address: "https://example.test/" }, false],
  ])("hold %j: %s", (value, fits) => {
    expect(linkType.fits(settings, value, listOf)).toBe(fits);
  });

  it("count one link, and nothing else", () => {
    expect(linkType.count(link)).toBe(1);
    expect(linkType.count([])).toBe(0);
  });

  it("show their live link beside a draft, or nothing when there is none", () => {
    const live: LiveValues = { values: {}, links: {} };
    linkType.showLive(live, "f1", link);
    linkType.showLive(live, "f2", []);
    expect(live).toEqual({ values: {}, links: { f1: link } });
  });
});
