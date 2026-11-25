// SPDX-License-Identifier: Apache-2.0

// Tests for which draft items a menu offers: a record's, in its row and its details panel, and any
// draft's.

import { describe, expect, it } from "vitest";
import {
  type DraftOffer,
  type RecordMenuFacts,
  draftOffer,
  offersAny,
  offersDraft,
  offersOwn,
  recordMenuOffer,
} from "./menu-offer.ts";

const facts = (more: Partial<RecordMenuFacts> = {}): RecordMenuFacts => ({
  ownDraft: undefined,
  shownAction: undefined,
  changes: false,
  removable: true,
  editsOwnDraft: false,
  decides: false,
  publishes: true,
  ...more,
});

const nothing = {
  decide: false,
  publish: false,
  resubmit: false,
  discard: false,
  remove: false,
};

describe("a record's menu offer", () => {
  it("offers removing a record with no draft to those who change it", () => {
    expect(recordMenuOffer(facts({ changes: true }))).toEqual({
      ...nothing,
      remove: true,
    });
  });

  it("offers no removing of a record that can never be removed", () => {
    expect(recordMenuOffer(facts({ changes: true, removable: false }))).toEqual(
      nothing,
    );
  });

  it("offers nothing to a viewer", () => {
    const offer = recordMenuOffer(
      facts({ ownDraft: { state: "waiting" }, shownAction: "changed" }),
    );

    expect(offer).toEqual(nothing);
    expect(offersAny(offer)).toBe(false);
  });

  it("offers publishing and discarding the user's own unpublished draft, then removing the record", () => {
    expect(
      recordMenuOffer(
        facts({
          changes: true,
          ownDraft: { state: "waiting", unpublished: true },
          shownAction: "changed",
        }),
      ),
    ).toEqual({ ...nothing, publish: true, discard: true, remove: true });
  });

  it("offers no publishing where the user's changes can't be published from", () => {
    expect(
      recordMenuOffer(
        facts({
          changes: true,
          publishes: false,
          ownDraft: { state: "waiting", unpublished: true },
          shownAction: "changed",
        }),
      ).publish,
    ).toBe(false);
  });

  it("offers no publishing of a published draft", () => {
    expect(
      recordMenuOffer(
        facts({
          changes: true,
          ownDraft: { state: "waiting" },
          shownAction: "changed",
        }),
      ),
    ).toEqual({ ...nothing, discard: true, remove: true });
  });

  it("offers resubmitting and discarding a rejected draft", () => {
    expect(
      recordMenuOffer(
        facts({
          changes: true,
          ownDraft: { state: "rejected" },
          shownAction: "changed",
        }),
      ),
    ).toEqual({ ...nothing, resubmit: true, discard: true, remove: true });
  });

  it.each(["created", "deleted"] as const)(
    "offers no removing of a record whose draft has %s it",
    (shownAction) => {
      expect(
        recordMenuOffer(
          facts({ changes: true, ownDraft: { state: "waiting" }, shownAction }),
        ).remove,
      ).toBe(false);
    },
  );

  it("offers the draft items alone, with no removing, on a table whose records are changed elsewhere", () => {
    const offer = recordMenuOffer(
      facts({
        editsOwnDraft: true,
        ownDraft: { state: "waiting", unpublished: true },
        shownAction: "changed",
      }),
    );

    expect(offer).toEqual({ ...nothing, publish: true, discard: true });
    expect(offersOwn(offer)).toBe(true);
  });

  it("offers deciding the draft to those who decide it now", () => {
    const offer = recordMenuOffer(
      facts({ decides: true, ownDraft: { state: "waiting" } }),
    );

    expect(offer).toEqual({ ...nothing, decide: true });
    expect(offersOwn(offer)).toBe(false);
    expect(offersAny(offer)).toBe(true);
  });
});

describe("whether a menu offers anything for the record's own draft", () => {
  it.each(["publish", "resubmit", "discard", "remove"] as const)(
    "counts %s alone",
    (item) => {
      expect(offersOwn({ ...nothing, [item]: true })).toBe(true);
    },
  );

  it("counts nothing when nothing is offered", () => {
    expect(offersOwn(nothing)).toBe(false);
  });
});

describe("a draft's offer", () => {
  const facts = {
    hasDraft: false,
    rejected: false,
    unpublished: false,
    editsDraft: false,
    decides: false,
    publishes: true,
  };
  const offering = (...items: (keyof DraftOffer)[]): DraftOffer => ({
    decide: items.includes("decide"),
    publish: items.includes("publish"),
    resubmit: items.includes("resubmit"),
    discard: items.includes("discard"),
  });

  it.each([
    ["nothing with no draft and no say", {}, offering()],
    [
      "deciding it to those who decide it",
      { decides: true },
      offering("decide"),
    ],
    [
      "nothing of its own to those who edit drafts, with no draft",
      { editsDraft: true, unpublished: true },
      offering(),
    ],
    [
      "discarding a waiting draft to those who edit it",
      { hasDraft: true, editsDraft: true },
      offering("discard"),
    ],
    [
      "resubmitting and discarding a rejected draft to those who edit it",
      { hasDraft: true, rejected: true, editsDraft: true },
      offering("resubmit", "discard"),
    ],
    [
      "publishing and discarding the user's unpublished draft",
      { hasDraft: true, unpublished: true, editsDraft: true },
      offering("publish", "discard"),
    ],
    [
      "no publishing where changes can't be published from there",
      { hasDraft: true, unpublished: true, editsDraft: true, publishes: false },
      offering("discard"),
    ],
    [
      "nothing of its own to those who don't edit it",
      { hasDraft: true, rejected: true, unpublished: true },
      offering(),
    ],
  ] as const)("offers %s", (_case, more, expected) => {
    const offer = draftOffer({ ...facts, ...more });

    expect(offer).toEqual(expected);
    expect(offersDraft(offer)).toBe(Object.values(expected).some(Boolean));
  });
});
