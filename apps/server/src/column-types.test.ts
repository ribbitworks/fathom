// SPDX-License-Identifier: Apache-2.0

// Tests for what each type of column on People keeps and holds, apart from the database: the
// settings, tier, values, and live values of choice, web link, note, number, checkbox, text, date
// and link columns.

import { describe, expect, it } from "vitest";
import {
  columnTypes,
  liveValuesOf,
  noLiveValues,
  typeOf,
} from "./data/column-types.ts";

const link = { address: "https://example.test/", text: "Example" };
const listOf = new Map([
  ["c1", "l1"],
  ["c2", "l1"],
  ["c9", "l2"],
]);

describe("a column's type", () => {
  it("is a choice column unless recorded as another type", () => {
    expect(typeOf({}).type).toBe("choice");
    expect(typeOf({ type: null }).type).toBe("choice");
    expect(typeOf({ type: "choice" }).type).toBe("choice");
    expect(typeOf({ type: "link" }).type).toBe("link");
    expect(typeOf({ type: "note" }).type).toBe("note");
  });

  it("is refused when Fathom does not know it", () => {
    expect(() => typeOf({ type: "table" })).toThrow(
      "A column has a type Fathom does not know",
    );
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
      linkedTable: null,
    });
  });

  it("take their tier from their list", () => {
    expect(
      choice.tier(settings, (listId) =>
        listId === "l1" ? "personal" : "general",
      ),
    ).toBe("personal");
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
      choice.fits(
        { listId: "l1", multiple: true, linkedTable: null },
        ["c1", "c2"],
        listOf,
      ),
    ).toBe(true);
  });

  it("count each choice, and nothing else", () => {
    expect(choice.count(["c1", "c2"])).toBe(2);
    expect(choice.count(link)).toBe(0);
  });

  it("show their live choices beside a draft, or none", () => {
    const live = noLiveValues();
    choice.showLive(live, "f1", ["c1"]);
    choice.showLive(live, "f2", undefined);
    expect(live).toEqual({
      ...noLiveValues(),
      values: { f1: ["c1"], f2: [] },
    });
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
      linkedTable: null,
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
    const live = noLiveValues();
    linkType.showLive(live, "f1", link);
    linkType.showLive(live, "f2", []);
    expect(live).toEqual({
      ...noLiveValues(),
      links: { f1: link },
    });
  });
});

describe("note columns", () => {
  const { note } = columnTypes;
  const settings = note.settings({ visibility: "personal", listId: "l1" });

  it("keep a visibility of their own, and no list", () => {
    expect(settings).toEqual({
      type: "note",
      listId: null,
      visibility: "personal",
      multiple: false,
      linkedTable: null,
    });
  });

  it("take their tier from their visibility, or the most sensitive for one not known", () => {
    expect(note.tier(settings, () => "general")).toBe("personal");
    expect(
      note.tier(note.settings({ visibility: "secret" }), () => "general"),
    ).toBe("confidential");
  });

  it.each([
    ["*Kind*", true],
    [undefined, true],
    [[], true],
    [null, true],
    ["", false],
    [["c1"], false],
    [link, false],
  ])("hold %j: %s", (value, fits) => {
    expect(note.fits(settings, value, listOf)).toBe(fits);
  });

  it("count one note, and nothing else", () => {
    expect(note.count("*Kind*")).toBe(1);
    expect(note.count("")).toBe(0);
    expect(note.count([])).toBe(0);
  });

  it("show their live note beside a draft, or nothing when there is none", () => {
    const live = noLiveValues();
    note.showLive(live, "f1", "*Kind*");
    note.showLive(live, "f2", []);
    expect(live).toEqual({
      ...noLiveValues(),
      notes: { f1: "*Kind*" },
    });
  });
});

describe("number columns", () => {
  const number = columnTypes.number;
  const settings = { listId: null, multiple: false, linkedTable: null };

  it("have a visibility of their own, as their tier", () => {
    expect(number.settings({ visibility: "personal" })).toEqual({
      type: "number",
      listId: null,
      visibility: "personal",
      multiple: false,
      linkedTable: null,
    });
  });

  it.each([
    [0, true],
    [-1.5, true],
    [undefined, true],
    [[], true],
    [null, true],
    ["1", false],
    [["c1"], false],
    [0.1 + 0.2, false],
  ])("hold %j: %s", (value, fits) => {
    expect(number.fits(settings, value, new Map())).toBe(fits);
  });

  it("count one number, 0 included, and nothing else", () => {
    expect(number.count(0)).toBe(1);
    expect(number.count("1")).toBe(0);
    expect(number.count([])).toBe(0);
  });

  it("show their live number beside a draft, 0 included, or nothing when there is none", () => {
    const live = noLiveValues();
    number.showLive(live, "f1", 0);
    number.showLive(live, "f2", []);
    expect(live.numbers).toEqual({ f1: 0 });
  });
});

describe("checkbox columns", () => {
  const { flag } = columnTypes;
  const settings = { listId: null, multiple: false, linkedTable: null };

  it("have a visibility of their own, as their tier", () => {
    expect(flag.settings({ visibility: "personal" })).toEqual({
      type: "flag",
      listId: null,
      visibility: "personal",
      multiple: false,
      linkedTable: null,
    });
  });

  it.each([
    [true, true],
    [undefined, true],
    [[], true],
    [null, true],
    [false, false],
    ["yes", false],
    [1, false],
  ])("hold %j: %s", (value, fits) => {
    expect(flag.fits(settings, value, new Map())).toBe(fits);
  });

  it("count a ticked box, and nothing else", () => {
    expect(flag.count(true)).toBe(1);
    expect(flag.count(false)).toBe(0);
    expect(flag.count([])).toBe(0);
  });

  it("show their live box beside a draft only while it is ticked", () => {
    const live = noLiveValues();
    flag.showLive(live, "f1", true);
    flag.showLive(live, "f2", []);
    expect(live.flags).toEqual({ f1: true });
  });
});

describe("text columns", () => {
  const { text } = columnTypes;
  const settings = text.settings({ visibility: "general" });

  it("have a visibility of their own", () => {
    expect(settings).toEqual({
      type: "text",
      listId: null,
      visibility: "general",
      multiple: false,
      linkedTable: null,
    });
  });

  it.each([
    [{ text: "North 4-12" }, true],
    [{ text: "North\nwing" }, false],
    [{ text: "x".repeat(200) }, true],
    [{ text: "x".repeat(201) }, false],
    [{ text: "" }, false],
    [undefined, true],
    [[], true],
    ["North 4-12", false],
    [link, false],
  ])("hold %j: %s", (value, fits) => {
    expect(text.fits(settings, value, new Map())).toBe(fits);
  });

  it("count one text, and never a note", () => {
    expect(text.count({ text: "North 4-12" })).toBe(1);
    expect(text.count("North 4-12")).toBe(0);
    expect(columnTypes.note.count({ text: "North 4-12" })).toBe(0);
  });

  it("show their live text beside a draft, or nothing when there is none", () => {
    const live = noLiveValues();
    text.showLive(live, "f1", { text: "North 4-12" });
    text.showLive(live, "f2", []);
    expect(live.texts).toEqual({ f1: "North 4-12" });
  });
});

describe("date columns", () => {
  const { date } = columnTypes;
  const settings = { listId: null, multiple: false, linkedTable: null };

  it("have a visibility of their own, as their tier", () => {
    expect(date.settings({ visibility: "personal" })).toEqual({
      type: "date",
      listId: null,
      visibility: "personal",
      multiple: false,
      linkedTable: null,
    });
  });

  it.each([
    [{ date: "2026-03-14" }, true],
    [{ date: "2028-02-29" }, true],
    [{ date: "2026-02-30" }, false],
    [{ date: "2026-3-14" }, false],
    [{ date: "" }, false],
    [{ date: "2026-03-14", text: "x" }, false],
    [undefined, true],
    [[], true],
    ["2026-03-14", false],
    [{ text: "2026-03-14" }, false],
  ])("hold %j: %s", (value, fits) => {
    expect(date.fits(settings, value, new Map())).toBe(fits);
  });

  it("count one day, never a note's or a text's, and are never counted as either", () => {
    expect(date.count({ date: "2026-03-14" })).toBe(1);
    expect(date.count("2026-03-14")).toBe(0);
    expect(date.count({ text: "2026-03-14" })).toBe(0);
    expect(columnTypes.note.count({ date: "2026-03-14" })).toBe(0);
    expect(columnTypes.text.count({ date: "2026-03-14" })).toBe(0);
  });

  it("show their live day beside a draft, or nothing when there is none", () => {
    const live = noLiveValues();
    date.showLive(live, "f1", { date: "2026-03-14" });
    date.showLive(live, "f2", []);
    expect(live.days).toEqual({ f1: "2026-03-14" });
  });
});

describe("link columns", () => {
  const { record } = columnTypes;
  const one = { listId: null, multiple: false, linkedTable: "people" };
  const several = { ...one, multiple: true };

  it("keep their table, a visibility of their own, and whether they take several records", () => {
    expect(
      record.settings({
        visibility: "personal",
        linkedTable: "features",
        multiple: true,
      }),
    ).toEqual({
      type: "record",
      listId: null,
      visibility: "personal",
      multiple: true,
      linkedTable: "features",
    });
  });

  it("are refused a table Fathom doesn't link to", () => {
    expect(() =>
      record.settings({ visibility: "general", linkedTable: "lists" }),
    ).toThrow();
  });

  it.each([
    [one, { people: ["p1"] }, true],
    [one, { people: ["p1", "p2"] }, false],
    [several, { people: ["p1", "p2"] }, true],
    [one, { features: ["f1"] }, false],
    [one, { people: [] }, false],
    [one, { people: ["p1"], features: ["f1"] }, false],
    [one, ["p1"], false],
    [one, undefined, true],
    [one, [], true],
  ])("with %j, hold %j: %s", (settings, value, fits) => {
    expect(record.fits(settings, value, new Map())).toBe(fits);
  });

  it("count each record linked, never choices, and are never counted as choices", () => {
    expect(record.count({ people: ["p1", "p2"] })).toBe(2);
    expect(record.count(["p1"])).toBe(0);
    expect(columnTypes.choice.count({ people: ["p1"] })).toBe(0);
  });

  it("show their live records beside a draft, or nothing when there are none", () => {
    const live = noLiveValues();
    record.showLive(live, "f1", { features: ["a1", "a2"] });
    record.showLive(live, "f2", []);
    expect(live.linked).toEqual({ f1: ["a1", "a2"] });
  });

  it("hold each record in the values table's column for its table", () => {
    expect(record.rows({ people: ["p1", "p2"] })).toEqual([
      { linkedPersonId: "p1" },
      { linkedPersonId: "p2" },
    ]);
    expect(record.rows({ features: ["a1"] })).toEqual([
      { linkedFeatureId: "a1" },
    ]);
  });
});

describe("the values table's rows", () => {
  it("hold each type's value in its own column, and nothing for a value of another type", () => {
    expect(
      Object.values(columnTypes).map((type) => [
        type.type,
        type.rows(["c1"]),
        type.rows(link),
        type.rows("*Kind*"),
        type.rows(0),
        type.rows(true),
        type.rows({ text: "Desk" }),
        type.rows({ date: "2026-03-14" }),
        type.rows({ people: ["p1"] }),
      ]),
    ).toEqual([
      ["choice", [{ choiceId: "c1" }], [], [], [], [], [], [], []],
      [
        "link",
        [],
        [{ linkAddress: link.address, linkText: link.text }],
        [],
        [],
        [],
        [],
        [],
        [],
      ],
      ["note", [], [], [{ note: "*Kind*" }], [], [], [], [], []],
      ["number", [], [], [], [{ number: 0 }], [], [], [], []],
      ["flag", [], [], [], [], [{ flag: true }], [], [], []],
      ["text", [], [], [], [], [], [{ text: "Desk" }], [], []],
      ["date", [], [], [], [], [], [], [{ date: "2026-03-14" }], []],
      ["record", [], [], [], [], [], [], [], [{ linkedPersonId: "p1" }]],
    ]);
  });
});

describe("live values", () => {
  it("are read by the type each value recorded is of", () => {
    expect(
      liveValuesOf(
        new Map<string, unknown>([
          ["f1", ["c1"]],
          ["f2", true],
          ["f3", 0],
          ["f4", []],
          ["f5", { text: "North 4-12" }],
          ["f6", "*Kind*"],
          ["f7", { date: "2026-03-14" }],
          ["f8", { people: ["p1"] }],
        ]),
      ),
    ).toEqual({
      ...noLiveValues(),
      values: { f1: ["c1"] },
      numbers: { f3: 0 },
      flags: { f2: true },
      texts: { f5: "North 4-12" },
      notes: { f6: "*Kind*" },
      days: { f7: "2026-03-14" },
      linked: { f8: ["p1"] },
    });
  });
});
