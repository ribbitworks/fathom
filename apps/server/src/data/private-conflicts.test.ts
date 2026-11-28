// SPDX-License-Identifier: Apache-2.0

// Unit tests for the check on publishing private changes: which fields someone else changed since a
// change began, which whole records clash, the fields given up, and how each kind of record is
// seen by everyone else.

import { draftKey } from "@fathom/shared";
import { describe, expect, it } from "vitest";
import { type Draft } from "./draft-records.ts";
import {
  fieldConflicts,
  givenUp,
  overApproved,
  recordClash,
  type Seen,
  seenByOthers,
} from "./private-conflicts.ts";
import { type Versions } from "./private-versions.ts";
import {
  leeds,
  lisbon,
  live,
  porto,
  privateChange,
  published,
  removal,
} from "./test-private-changes.ts";

describe("the fields someone else changed since a private change began", () => {
  it("are none while the values it started from are still there", () => {
    const row = privateChange({ site: lisbon }, { site: leeds });

    expect(fieldConflicts(row, { live, published: undefined })).toEqual([]);
  });

  it("are each field of its own now holding another value, in the published draft", () => {
    // Given Ben's change of Kai's Site from Leeds, and Ana's published change to Porto
    const row = privateChange({ site: lisbon }, { site: leeds });

    // When the change is checked
    const conflicts = fieldConflicts(row, {
      live,
      published: published({ site: porto }),
    });

    // Then the Site is a conflict, with both values
    expect(conflicts).toEqual([
      {
        field: "site",
        was: leeds,
        mine: lisbon,
        theirs: porto,
        state: "waiting",
      },
    ]);
  });

  it("name a value approved since as live", () => {
    const row = privateChange({ site: lisbon }, { site: leeds });

    expect(
      fieldConflicts(row, {
        live: { ...live, site: porto },
        published: undefined,
      }),
    ).toEqual([
      {
        field: "site",
        was: leeds,
        mine: lisbon,
        theirs: porto,
        state: "live",
      },
    ]);
  });

  it("name a rejected draft's value as rejected", () => {
    const row = privateChange({ site: lisbon }, { site: leeds });

    expect(
      fieldConflicts(row, {
        live,
        published: published({ site: porto }, "rejected"),
      }).map(({ state }) => state),
    ).toEqual(["rejected"]);
  });

  it("leave out fields not its own, which others may change freely", () => {
    // Given Ben's change of Site, over Ana's published new name
    const row = privateChange(
      { preferredName: "Kai Renamed", site: lisbon },
      { site: leeds },
    );

    expect(
      fieldConflicts(row, {
        live,
        published: published({ preferredName: "Kai Renamed" }),
      }),
    ).toEqual([]);
  });

  it("leave out a field someone else changed to the same value", () => {
    const row = privateChange({ site: lisbon }, { site: leeds });

    expect(
      fieldConflicts(row, { live, published: published({ site: lisbon }) }),
    ).toEqual([]);
  });

  it("take a missing value as nothing, as a cleared one", () => {
    // Given a change from a Site nobody had, and a live record with none
    const row = privateChange({ site: lisbon }, { site: null });

    expect(
      fieldConflicts(row, {
        live: { preferredName: "Kai Lindqvist" },
        published: undefined,
      }),
    ).toEqual([]);
  });

  it.each([
    ["a missing value", {}],
    ["no value", { site: null }],
  ])("take an empty list as nothing, as %s", (_, liveSite) => {
    // Given a change from an empty Site, as a person's cleared column holds it
    const row = privateChange({ site: lisbon }, { site: [] });

    expect(
      fieldConflicts(row, {
        live: { preferredName: "Kai Lindqvist", ...liveSite },
        published: undefined,
      }),
    ).toEqual([]);
  });

  it("take the user's value as the live one where their change no longer holds the field", () => {
    // Given Ben took a published Site back to live, and Ana changed it again since
    const row = privateChange({}, { site: porto });

    expect(
      fieldConflicts(row, { live, published: published({ site: lisbon }) }),
    ).toEqual([
      {
        field: "site",
        was: porto,
        mine: leeds,
        theirs: lisbon,
        state: "waiting",
      },
    ]);
  });

  it.each([
    ["names no field of its own", privateChange({ site: lisbon }, {})],
    ["removes the record", privateChange({}, { site: leeds }, "deleted")],
  ])("are none for a change that %s, which holds its whole draft", (_, row) => {
    expect(
      fieldConflicts(row, { live, published: published({ site: porto }) }),
    ).toEqual([]);
  });

  it("are none for a change of another action than the published draft's", () => {
    const row = privateChange({ site: lisbon }, { site: leeds });
    const removal = { ...published({}), action: "deleted" } satisfies Draft;

    expect(fieldConflicts(row, { live, published: removal })).toEqual([]);
  });
});

describe("a private change with fields given up for the values others see", () => {
  const seen: Seen = {
    live,
    published: published({ preferredName: "Kai Renamed", site: porto }),
  };

  it("is unchanged when it gives up none", () => {
    const row = privateChange({ site: lisbon }, { site: leeds });

    expect(givenUp(row, seen, new Set())).toBe(row);
  });

  it("takes the published draft's value, no longer its own, keeping its other fields", () => {
    // Given Ben's change of Site and Team name, over Ana's published Site and name
    const row = privateChange(
      { preferredName: "Kai Renamed", site: lisbon, teamName: "Fictional" },
      { site: leeds, teamName: null },
    );

    // When he gives up the Site
    const kept = givenUp(row, seen, new Set(["site"]));

    // Then the Site is Ana's, and only his Team name is his own
    expect(kept?.fields).toEqual({
      preferredName: "Kai Renamed",
      site: porto,
      teamName: "Fictional",
    });
    expect(kept?.startedFrom).toEqual({ teamName: null });
  });

  it("leaves a field the published draft doesn't change as it is live", () => {
    const row = privateChange(
      { site: lisbon, teamName: "Fictional" },
      { site: leeds, teamName: null },
    );

    expect(
      givenUp(row, { live, published: undefined }, new Set(["site"]))?.fields,
    ).toEqual({ teamName: "Fictional" });
  });

  it("changes nothing once every field of its own is given up", () => {
    const row = privateChange({ site: lisbon }, { site: leeds });

    expect(givenUp(row, seen, new Set(["site"]))).toBeUndefined();
  });
});

describe("a clash on a whole record", () => {
  it("is a private change over a removal published since", () => {
    const row = privateChange({ site: lisbon }, { site: leeds });

    expect(recordClash(row, { live, published: removal })).toEqual({
      removedBy: "theirs",
      state: "waiting",
      fields: [],
    });
  });

  it("is a private take-back of a field over a removal published since", () => {
    // Given Ben took back a published Site for Kai, and Cleo's removal of Kai published since
    const row = privateChange({}, { site: porto });

    expect(recordClash(row, { live, published: removal })).toMatchObject({
      removedBy: "theirs",
    });
  });

  it("is a private discard of an added record someone edited since", () => {
    // Given Ben discarded the draft adding Noor, which Ana then edited and published
    const row = privateChange({}, { name: "Noor" });
    const added = {
      ...published({ name: "Noor Haddad" }),
      action: "created",
    } satisfies Draft;

    expect(
      recordClash(row, { live: undefined, published: added }),
    ).toMatchObject({ removedBy: "mine" });
  });

  it("is none for a private discard of an added record as it started", () => {
    const row = privateChange({}, { name: "Noor" });
    const added = {
      ...published({ name: "Noor" }),
      action: "created",
    } satisfies Draft;

    expect(
      recordClash(row, { live: undefined, published: added }),
    ).toBeUndefined();
  });

  it("is a private removal of a record changed in a draft published since", () => {
    // Given Ben's removal of Kai as live, and Ana's published Site since
    const row = privateChange({}, {}, "deleted");

    expect(
      recordClash(row, { live, published: published({ site: porto }) }),
    ).toEqual({
      removedBy: "mine",
      state: "waiting",
      fields: ["site"],
    });
  });

  it("is a private removal of a record whose value approved since isn't the one it started from", () => {
    const row = privateChange({}, { site: porto }, "deleted");

    expect(recordClash(row, { live, published: undefined })).toEqual({
      removedBy: "mine",
      state: "live",
      fields: ["site"],
    });
  });

  it("is none for a change taking a published removal back", () => {
    const row = privateChange({}, {});

    expect(recordClash(row, { live, published: removal })).toBeUndefined();
  });

  it("is none for a private removal of a record as it started", () => {
    const row = privateChange({}, { site: porto }, "deleted");

    expect(
      recordClash(row, { live, published: published({ site: porto }) }),
    ).toBeUndefined();
  });

  it("is none for a private removal of a record others no longer have", () => {
    const row = privateChange({}, {}, "deleted");

    expect(recordClash(row, { live, published: removal })).toBeUndefined();
  });

  it("is none for a private change over a record as others have it", () => {
    const row = privateChange({ site: lisbon }, { site: leeds });

    expect(
      recordClash(row, { live, published: published({ site: porto }) }),
    ).toBeUndefined();
  });

  const liveSince = (...fields: string[]) => ({
    added: false,
    changes: fields.map((field) => ({ field, tier: "general", madeBy: "Dee" })),
  });

  it("is a private removal of a record with a field made live since that it never started from", () => {
    const row = privateChange({}, {}, "deleted");

    expect(
      recordClash(row, {
        live,
        published: undefined,
        liveSince: liveSince("site", "site"),
      }),
    ).toEqual({ removedBy: "mine", state: "live", fields: ["site"] });
  });

  it("judges a field it started from by its value, whatever was made live since", () => {
    const row = privateChange({}, { site: leeds }, "deleted");

    expect(
      recordClash(row, {
        live,
        published: undefined,
        liveSince: liveSince("site"),
      }),
    ).toBeUndefined();
  });
});

describe("a change over a published removal", () => {
  const row = {
    ...privateChange({ site: lisbon }, { site: leeds }),
    since: new Date("2026-11-20"),
  };

  it("clashes where the removal was published after the change began", () => {
    expect(
      recordClash(row, {
        live,
        published: removal,
        removedAt: new Date("2026-11-21"),
      }),
    ).toMatchObject({ removedBy: "theirs" });
  });

  it("asks nothing where the change was made over a removal already published", () => {
    expect(
      recordClash(row, {
        live,
        published: removal,
        removedAt: new Date("2026-11-19"),
      }),
    ).toBeUndefined();
  });
});

describe("a private change to a record whose addition was approved since", () => {
  const added = { added: true, changes: [] };

  it("becomes a change of its own fields to the live record", () => {
    const row = privateChange(
      { preferredName: "Kai Lindqvist", site: lisbon },
      { site: leeds },
      "created",
    );

    expect(overApproved(row, { live, published: undefined })).toEqual({
      ...row,
      action: "changed",
      fields: { site: lisbon },
    });
  });

  it("empties a field of its own it left out, as nothing or no choices", () => {
    const row = privateChange(
      { preferredName: "Kai Lindqvist" },
      { team: "team-a", "value:site": [leeds] },
      "created",
    );

    expect(overApproved(row, { live, published: undefined }).fields).toEqual({
      team: null,
      "value:site": [],
    });
  });

  it("becomes the live record's removal where it took the addition back", () => {
    const row = privateChange({}, { site: leeds });

    expect(
      overApproved(row, { live, published: undefined, liveSince: added }),
    ).toEqual({ ...row, action: "deleted", fields: {} });
  });

  it.each([
    [
      "a record still only drafted",
      privateChange({}, { site: leeds }, "created"),
      undefined,
      added,
    ],
    [
      "an addition of its maker's own",
      privateChange({ site: lisbon }, {}, "created"),
      live,
      undefined,
    ],
    [
      "a take-back of a change, approved since",
      privateChange({}, { site: leeds }),
      live,
      { added: false, changes: [] },
    ],
    [
      "a change to a live record",
      privateChange({ site: lisbon }, { site: leeds }),
      live,
      undefined,
    ],
  ])("is as it was for %s", (_, row, record, since) => {
    expect(
      overApproved(row, {
        live: record,
        published: undefined,
        ...(since === undefined ? {} : { liveSince: since }),
      }),
    ).toBe(row);
  });
});

describe("a record as everyone else sees it", () => {
  const madeLive = { added: true, changes: [] };
  const draft = published({ name: "Fictional" });
  const record = { name: "Fictional Live" };
  const lists = {
    lists: new Map([["list", record]]),
    listDrafts: new Map([["list", draft]]),
    choices: new Map([
      ["choice", { record: { ...record, listId: "list" }, position: 0 }],
    ]),
    choiceDrafts: new Map([["choice", draft]]),
    orderDrafts: new Map([["list", draft]]),
  };
  const versions = {
    people: {
      live: new Map([["id", record]]),
      theirs: new Map([["id", draft]]),
    },
    hires: {
      live: new Map([["id", record]]),
      theirs: new Map([["id", draft]]),
    },
    teams: {
      live: new Map([["id", record]]),
      theirs: new Map([["id", draft]]),
    },
    theirs: {
      lists,
      columns: {
        fields: new Map([["column", record]]),
        fieldDrafts: new Map([["column", draft]]),
      },
    },
    records: {
      theirs: {
        release: {
          live: new Map([["id", record]]),
          drafts: new Map([["id", draft]]),
        },
      },
    },
    liveSince: new Map([[draftKey("person", "removed"), madeLive]]),
    removedAt: new Map(),
  } as unknown as Versions;
  const seenOf = (recordType: string, recordId: string) =>
    seenByOthers(versions, { ...privateChange({}, {}), recordType, recordId });

  it.each([
    ["person", "id"],
    ["planned-hire", "id"],
    ["feature-team", "id"],
    ["list", "list"],
    ["field", "column"],
    ["release", "id"],
  ])("is a %s as it is live, under its published draft", (kind, id) => {
    expect(seenOf(kind, id)).toEqual({ live: record, published: draft });
  });

  it("is a choice as it is live, under its published draft", () => {
    expect(seenOf("list-item", "choice")).toEqual({
      live: { ...record, listId: "list" },
      published: draft,
    });
  });

  it("is a list's order as its choices stand live, under its published draft", () => {
    expect(seenOf("choice-order", "list")).toEqual({
      live: { order: ["choice"] },
      published: draft,
    });
  });

  it("comes with what was made live since a removal of it began", () => {
    expect(seenOf("person", "removed")).toEqual({
      live: undefined,
      published: undefined,
      liveSince: madeLive,
    });
  });

  it("is nothing for a kind Fathom no longer has", () => {
    expect(seenOf("retired-kind", "id")).toEqual({
      live: undefined,
      published: undefined,
    });
  });
});
