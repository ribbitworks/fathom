// SPDX-License-Identifier: Apache-2.0

// Tests for which of a record's draft items its menu offers, in its row and its details panel.

import { describe, expect, it } from "vitest";
import {
  type RecordMenuFacts,
  offersAny,
  offersOwn,
  recordMenuOffer,
} from "./menu-offer.ts";

const facts = (more: Partial<RecordMenuFacts> = {}): RecordMenuFacts => ({
  ownDraft: undefined,
  takenBack: false,
  shownAction: undefined,
  changes: false,
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

  it("offers publishing the user's taking back of a published draft, which leaves the record no draft", () => {
    expect(recordMenuOffer(facts({ changes: true, takenBack: true }))).toEqual({
      ...nothing,
      publish: true,
      remove: true,
    });
  });

  it("offers no publishing of a taking back to those who don't change the record, or where nothing is published from", () => {
    expect(
      [
        facts({ takenBack: true }),
        facts({ changes: true, takenBack: true, publishes: false }),
      ].map((given) => recordMenuOffer(given).publish),
    ).toEqual([false, false]);
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
