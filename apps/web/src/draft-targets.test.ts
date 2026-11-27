// SPDX-License-Identifier: Apache-2.0

// Tests for naming a draft by its record, of each kind: the selection deciding it sends, and where
// discarding and resubmitting it are sent.

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  type DraftTarget,
  discardTarget,
  resubmitTarget,
  targetSelection,
} from "./draft-targets.ts";
import { noDrafts } from "./drafts.ts";
import { serverAnswers } from "./test-support.tsx";

afterEach(() => {
  vi.unstubAllGlobals();
});

const changeSetId = "00000000-0000-4000-8000-000000000001";
const ref = { type: "release", id: "r1" } as const;

// Each kind of target, with the selection it names and the draft's address.
const targets: [DraftTarget, object, string][] = [
  [{ kind: "person", id: "p1" }, { people: ["p1"] }, "/api/people/p1/draft"],
  [
    { kind: "planned-hire", id: "h1" },
    { plannedHires: ["h1"] },
    "/api/planned-hires/h1/draft",
  ],
  [
    { kind: "feature-team", id: "t1" },
    { featureTeams: ["t1"] },
    "/api/feature-teams/t1/draft",
  ],
  [{ kind: "list", listId: "l1" }, { lists: ["l1"] }, "/api/lists/l1/draft"],
  [
    { kind: "choice", listId: "l1", choiceId: "c1" },
    { choices: ["c1"] },
    "/api/lists/l1/choices/c1/draft",
  ],
  [
    { kind: "order", listId: "l1" },
    { orders: ["l1"] },
    "/api/lists/l1/order/draft",
  ],
  [
    { kind: "column", id: "f1", table: "features" },
    { columns: ["f1"] },
    "/api/features/columns/f1/draft",
  ],
  [
    { kind: "record", ref },
    { records: [ref] },
    "/api/records/release/r1/draft",
  ],
];

describe("a draft named by its record", () => {
  it.each(targets)("of %o is selected alone", (target, selection) => {
    expect(targetSelection(target)).toEqual({ ...noDrafts(), ...selection });
  });

  it.each(targets)(
    "of %o is discarded at its own address",
    async (target, _selection, address) => {
      serverAnswers({
        [`DELETE ${address}`]: () => Response.json({ changeSetId }),
      });
      expect(await discardTarget(target)).toBe(changeSetId);
    },
  );

  it.each(targets)(
    "of %o is resubmitted at its own address",
    async (target, _selection, address) => {
      serverAnswers({
        [`DELETE ${address}/rejection`]: () => Response.json({ changeSetId }),
      });
      expect(await resubmitTarget(target)).toBe(changeSetId);
    },
  );
});
