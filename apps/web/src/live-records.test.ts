// SPDX-License-Identifier: Apache-2.0

// Tests for records and columns as they are live, with a made-up kind of record, gadgets.

import { describe, expect, it } from "vitest";
import { countedRecords, liveFields } from "./live-records.ts";
import { waiting } from "./test-support.tsx";
import { gadget, gadgetColumns, liveGadgets } from "./test-gadgets.tsx";

describe("the records as they are live", () => {
  it("leave out those only drafted to be added, and put back each detail and column a draft changes", () => {
    expect(
      liveGadgets([
        gadget("g1"),
        gadget("g2", { draft: { ...waiting, action: "created" } }),
        gadget("g3", { draft: { ...waiting, action: "deleted" } }),
        gadget("g4", {
          name: "Renamed",
          values: { f1: ["c1"], f2: ["c2"] },
          links: { f3: { address: "https://example.test/new", text: "" } },
          draft: {
            ...waiting,
            action: "changed",
            changed: ["name", "f1", "f3"],
            live: {
              name: "Gadget g4",
              values: { f1: [] },
              links: { f3: { address: "https://example.test/old", text: "" } },
            },
          },
        }),
      ]),
    ).toEqual([
      gadget("g1"),
      gadget("g3"),
      gadget("g4", {
        values: { f2: ["c2"] },
        links: { f3: { address: "https://example.test/old", text: "" } },
      }),
    ]);
  });

  it("put back a record's only note, number or ticked box as not there, where a draft gave it", () => {
    expect(
      liveGadgets([
        gadget("g1", {
          notes: { f4: "Fictional note" },
          numbers: { f5: 3 },
          flags: { f6: true },
          draft: {
            ...waiting,
            action: "changed",
            changed: ["f4", "f5", "f6"],
            live: { values: {}, links: {}, notes: {}, numbers: {}, flags: {} },
          },
        }),
      ]),
    ).toEqual([gadget("g1")]);
  });
});

describe("the records the metrics count", () => {
  const gadgets = [
    gadget("g1"),
    gadget("g2", { draft: { ...waiting, action: "created" } }),
    gadget("g3", { draft: { ...waiting, action: "deleted" } }),
  ];
  const [column, other] = gadgetColumns([], [], []);

  // A gadget whose draft changes its first column from nothing to c1.
  const changed = (id: string, draft: object) =>
    gadget(id, {
      values: { f1: ["c1"] },
      draft: {
        ...waiting,
        action: "changed",
        changed: ["f1"],
        live: { values: { f1: [] }, links: {} },
        ...draft,
      },
    });
  const ids = (rows: readonly { id: string }[] | undefined) =>
    rows?.map(({ id }) => id);
  const firstValues = (rows: readonly { values: object }[] | undefined) =>
    rows?.map(({ values }) => values);

  it("are those shown, live alone, with nothing to compare where nothing is drafted", () => {
    expect(
      countedRecords(
        "live",
        gadgets,
        undefined,
        [],
        () => undefined,
        liveGadgets,
      ),
    ).toEqual({ rows: gadgets, besideLive: false });
  });

  it("are, live only, those shown, and as the drafts will make them, with and without the user's own unpublished changes", () => {
    const drafted = [
      ...gadgets,
      gadget("g4", {
        draft: { ...waiting, action: "created", unpublished: true },
      }),
      gadget("g5", {
        draft: { ...waiting, action: "created", state: "rejected" },
      }),
    ];
    const counted = countedRecords(
      "live",
      liveGadgets(drafted),
      drafted,
      [],
      () => undefined,
      liveGadgets,
    );
    expect(ids(counted.rows)).toEqual(["g1", "g3"]);
    expect(ids(counted.toCome?.coming.rows)).toEqual(["g1", "g2", "g4"]);
    expect(ids(counted.toCome?.published.rows)).toEqual(["g1", "g2"]);
    expect(counted.drafted).toBeUndefined();
  });

  it("are, with drafts applied, those shown, and as published and live with those drafted to be removed, but no live figures", () => {
    const [kept, added, removed] = gadgets;
    const counted = countedRecords(
      "drafts",
      [kept, added].flatMap((each) => (each ? [each] : [])),
      removed ? [removed] : [],
      [],
      () => undefined,
      liveGadgets,
    );
    expect(ids(counted.rows)).toEqual(["g1", "g2"]);
    expect(ids(counted.drafted?.published.rows)).toEqual(["g1", "g2"]);
    expect(ids(counted.live?.rows)).toEqual(["g1", "g3"]);
    expect(counted.besideLive).toBe(false);
  });

  it("are, as published, without the user's own unpublished changes", () => {
    const counted = countedRecords(
      "both",
      [
        gadget("g1"),
        gadget("g4", {
          draft: { ...waiting, action: "created", unpublished: true },
        }),
        gadget("g5", {
          draft: { ...waiting, action: "deleted", unpublished: true },
        }),
        changed("g6", { unpublished: true }),
      ],
      [],
      [],
      () => undefined,
      liveGadgets,
    );
    expect(ids(counted.rows)).toEqual(["g1", "g4", "g6"]);
    expect(ids(counted.drafted?.published.rows)).toEqual(["g1", "g5", "g6"]);
    expect(firstValues(counted.drafted?.published.rows)?.at(-1)).toEqual({});
    expect(counted.besideLive).toBe(true);
  });

  it("are, as waiting, without rejected drafts either", () => {
    const counted = countedRecords(
      "both",
      [changed("g6", {}), changed("g7", { state: "rejected" })],
      [],
      [],
      () => undefined,
      liveGadgets,
    );
    expect(firstValues(counted.drafted?.published.rows)).toEqual([
      { f1: ["c1"] },
      { f1: ["c1"] },
    ]);
    expect(firstValues(counted.drafted?.waiting.rows)).toEqual([
      { f1: ["c1"] },
      {},
    ]);
  });

  it("are, with drafts beside live, those not drafted to be removed, and as they are live by each column's live copy", () => {
    const counted = countedRecords(
      "both",
      gadgets,
      [],
      [column, other].flatMap((each) => (each ? [each] : [])),
      (each) => (each === column ? each : undefined),
      liveGadgets,
    );
    expect(counted.rows.map(({ id }) => id)).toEqual(["g1", "g2"]);
    expect(counted.live?.rows.map(({ id }) => id)).toEqual(["g1", "g3"]);
    expect(counted.live?.columns).toEqual([column]);
  });
});

describe("the live columns", () => {
  const column = {
    id: "f1",
    keyNumber: 1,
    name: "Grade",
    type: "choice" as const,
    listId: "l1",
    visibility: null,
    multiple: false,
    required: true,
  };
  const draft = {
    state: "waiting" as const,
    madeBy: null,
    madeAt: null,
  };
  it("leave out columns only drafted to be added, and put back each setting a draft changes", () => {
    expect(
      liveFields([
        { ...column, id: "f0" },
        {
          ...column,
          draft: {
            ...draft,
            action: "changed",
            changed: ["name", "required"],
            live: { name: "Level", required: false },
          },
        },
        {
          ...column,
          id: "f2",
          keyNumber: 1,
          draft: { ...draft, action: "created", changed: [], live: {} },
        },
        {
          ...column,
          id: "f4",
          keyNumber: 1,
          listId: "l2",
          draft: {
            ...draft,
            action: "changed",
            changed: ["listId"],
            live: { listId: "l1" },
          },
        },
        {
          ...column,
          id: "f3",
          keyNumber: 1,
          draft: { ...draft, action: "deleted", changed: [], live: {} },
        },
      ]),
    ).toEqual([
      { ...column, id: "f0" },
      { ...column, name: "Level", required: false },
      { ...column, id: "f4" },
      { ...column, id: "f3" },
    ]);
  });
});
