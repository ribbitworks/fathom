// SPDX-License-Identifier: Apache-2.0

// Tests for which of the user's unpublished changes are asked for, and which publishing them takes
// along.

import { describe, expect, it } from "vitest";
import { noDrafts } from "./drafts.ts";
import { askedAmong, publishedAlong, takesBack } from "./unpublished-links.ts";

// A list, a choice added to it, a person given the choice, and a feature saved with nothing else.
const changes = [
  {
    subject: "the person Avery Fictional",
    action: "changed" as const,
    key: "person p1",
    linked: ["list-item c1"],
  },
  {
    subject: "the choice North in Sites",
    action: "created" as const,
    key: "list-item c1",
    linked: ["list l1"],
  },
  {
    subject: "the list Sites",
    action: "created" as const,
    key: "list l1",
    linked: [],
  },
  {
    subject: "the feature Offline Sync",
    action: "changed" as const,
    key: "feature f1",
    linked: [],
  },
];

describe("the changes published along with one", () => {
  it("takes every change it uses, the whole way along, in the order listed", () => {
    expect(
      publishedAlong(changes, { ...noDrafts(), people: ["p1"] }).map(
        ({ key }) => key,
      ),
    ).toEqual(["list-item c1", "list l1"]);
  });

  it("takes nothing along with a change linked to no other", () => {
    expect(
      publishedAlong(changes, {
        ...noDrafts(),
        records: [{ type: "feature", id: "f1" }],
      }),
    ).toEqual([]);
  });

  it("takes nothing along with a change the list doesn't hold yet", () => {
    expect(publishedAlong(changes, { ...noDrafts(), people: ["p9"] })).toEqual(
      [],
    );
  });
});

describe("the changes asked for", () => {
  it("are those the list holds, in its order", () => {
    expect(
      askedAmong(changes, {
        ...noDrafts(),
        people: ["p1", "p9"],
        records: [{ type: "feature", id: "f1" }],
      }).map(({ key }) => key),
    ).toEqual(["person p1", "feature f1"]);
  });
});

describe("taking back a published draft", () => {
  const takenBack = [
    ...changes,
    {
      subject: "the person Blake Fictional",
      discarded: true,
      key: "person p2",
      linked: [],
    },
  ];

  it("is asked for when each change asked for takes back a published draft", () => {
    expect(takesBack(takenBack, { ...noDrafts(), people: ["p2"] })).toBe(true);
  });

  it("is not asked for when a change asked for makes a draft, or is not the user's", () => {
    expect(
      [["p1", "p2"], ["p3"]].map((people) =>
        takesBack(takenBack, { ...noDrafts(), people }),
      ),
    ).toEqual([false, false]);
  });

  it("is not asked for when nothing is", () => {
    expect(takesBack(takenBack, noDrafts())).toBe(false);
  });
});
