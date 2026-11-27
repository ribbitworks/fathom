// SPDX-License-Identifier: Apache-2.0

// Unit tests for the side kept of each clash on publishing private changes: a clash asked about
// until a side is kept for what was shown, one the role doesn't see given up, and the change as it
// publishes once the sides are applied.

import { describe, expect, it } from "vitest";
import { type Seen } from "./private-conflicts.ts";
import { resolved } from "./private-resolutions.ts";
import {
  kai,
  leeds,
  lisbon,
  live,
  porto,
  privateChange,
  published,
  removal,
} from "./test-private-changes.ts";

describe("the private changes going once the values kept are applied", () => {
  const seen: Seen = { live, published: published({ site: porto }) };
  const row = privateChange(
    { site: lisbon, teamName: "Fictional" },
    { site: leeds, teamName: null },
  );
  const shownToken = "shown";
  const asShown = {
    token: () => shownToken,
    unseenFields: () => new Set<string>(),
    blind: () => false,
  };
  const keeping = (
    keep: "mine" | "theirs",
    field = "site",
    token = shownToken,
  ) => ({
    recordType: "person" as const,
    recordId: kai,
    field,
    keep,
    token,
  });

  it("leave a conflict with no value kept unresolved", () => {
    const going = resolved([row], () => seen, [], asShown);

    expect(going.unresolved).toEqual([
      {
        row,
        kind: "person",
        conflict: {
          field: "site",
          was: leeds,
          mine: lisbon,
          theirs: porto,
          state: "waiting",
        },
      },
    ]);
  });

  it("ask again where the other side changed since the user was shown it", () => {
    const going = resolved(
      [row],
      () => seen,
      [keeping("mine", "site", "an earlier token")],
      asShown,
    );

    expect(going.unresolved).toHaveLength(1);
  });

  it("publish the user's value where they keep theirs", () => {
    const going = resolved([row], () => seen, [keeping("mine")], asShown);

    expect(going).toEqual({
      rows: [{ row, publishing: row, givenUp: new Set(), whole: false }],
      unresolved: [],
    });
  });

  it("publish the value others see where the user keeps it", () => {
    const going = resolved([row], () => seen, [keeping("theirs")], asShown);

    expect(going.unresolved).toEqual([]);
    expect(going.rows[0]?.publishing?.fields).toEqual({
      site: porto,
      teamName: "Fictional",
    });
    expect(going.rows[0]?.givenUp).toEqual(new Set(["site"]));
  });

  it("ignore a value kept for a field that is no conflict", () => {
    const going = resolved(
      [row],
      () => seen,
      [keeping("theirs"), keeping("theirs", "teamName")],
      asShown,
    );

    expect(going.rows[0]?.publishing?.startedFrom).toEqual({ teamName: null });
  });

  it("leave a change of a kind Fathom no longer has unchecked", () => {
    const retired = { ...row, recordType: "retired-kind" };

    expect(resolved([retired], () => seen, [], asShown)).toEqual({
      rows: [
        { row: retired, publishing: retired, givenUp: new Set(), whole: false },
      ],
      unresolved: [],
    });
  });
});

describe("a clash on a whole record once a side is kept", () => {
  it("is asked about until a side is kept, the other side giving up the whole change", () => {
    // Given Ben's Site for Kai, whom Ana's published removal removes
    const row = privateChange({ site: lisbon }, { site: leeds });
    const seen = { live, published: removal };
    const token = "shown";
    const keeping = (keep: "mine" | "theirs") => [
      { recordType: "person" as const, recordId: kai, keep, token },
    ];
    const asShown = (unseen: string[] = []) => ({
      token: () => token,
      unseenFields: () => new Set(unseen),
      blind: () => false,
    });

    expect(resolved([row], () => seen, [], asShown()).unresolved).toEqual([
      {
        row,
        kind: "person",
        clash: { removedBy: "theirs", state: "waiting", fields: [] },
      },
    ]);
    expect(
      resolved([row], () => seen, keeping("mine"), asShown()).rows,
    ).toEqual([{ row, publishing: row, givenUp: new Set(), whole: false }]);
    expect(
      resolved([row], () => seen, keeping("theirs"), asShown()).rows,
    ).toEqual([
      { row, publishing: undefined, givenUp: new Set(), whole: true },
    ]);
  });

  it("gives up a clash the role doesn't see, whatever side was sent for it", () => {
    // Given Ben's Site for Kai, which Ana changed since, in a field his role no longer sees
    const row = privateChange({ site: lisbon }, { site: leeds });
    const seen = { live, published: published({ site: porto }) };

    const going = resolved(
      [row],
      () => seen,
      [
        {
          recordType: "person",
          recordId: kai,
          field: "site",
          keep: "mine",
          token: "none",
        },
      ],
      {
        token: () => "none",
        unseenFields: () => new Set(),
        blind: () => true,
      },
    );

    expect(going.unresolved).toEqual([]);
    expect(going.rows[0]?.publishing).toBeUndefined();
  });

  it("gives up the fields the role no longer sees where the user keeps their change over a removal", () => {
    // Given Ben's Site and Team name for Kai, whom Ana's published removal removes, and a role that
    // no longer sees Team name
    const row = privateChange(
      { site: lisbon, teamName: "Fictional" },
      { site: leeds, teamName: null },
    );
    const seen = { live, published: removal };

    const [going] = resolved(
      [row],
      () => seen,
      [{ recordType: "person", recordId: kai, keep: "mine", token: "shown" }],
      {
        token: () => "shown",
        unseenFields: () => new Set(["teamName"]),
        blind: () => false,
      },
    ).rows;

    expect(going?.publishing?.fields).toEqual({ site: lisbon });
    expect(going?.givenUp).toEqual(new Set(["teamName"]));
  });

  it("keeps the user's own removal whole where they keep it", () => {
    const row = privateChange({}, {}, "deleted");
    const seen = { live, published: published({ site: porto }) };

    const [going] = resolved(
      [row],
      () => seen,
      [{ recordType: "person", recordId: kai, keep: "mine", token: "shown" }],
      {
        token: () => "shown",
        unseenFields: () => new Set(["site"]),
        blind: () => false,
      },
    ).rows;

    expect(going).toEqual({
      row,
      publishing: row,
      givenUp: new Set(),
      whole: false,
    });
  });
});
