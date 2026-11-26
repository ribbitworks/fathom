// SPDX-License-Identifier: Apache-2.0

// Tests for who may decide drafts of lists, their choices and their order, by the lists' classes.

import { describe, expect, it } from "vitest";
import { actorWith } from "../access.ts";
import { ForbiddenError } from "../errors.ts";
import type { Draft } from "./draft-records.ts";
import { requireSeesLists } from "./list-approvals.ts";
import type { ListsState } from "./list-state.ts";

const user = {
  id: "fictional-user",
  name: "Fictional User",
  email: "fictional.user@fathom.test",
};
const generalOnly = actorWith(user, ["configuration:approve", "people:view"]);
const seesPersonal = actorWith(user, [
  "configuration:approve",
  "people:view",
  "personal:view",
]);

const draft = (
  action: Draft["action"],
  fields: Record<string, unknown>,
): Draft => ({ action, fields, state: "waiting", reason: null, sequence: 1 });

// A live General list, a live Personal one, a Personal list only drafted to be added with a choice
// drafted into it, and a General list drafted to become Personal.
const state = {
  lists: new Map([
    ["general", { visibility: "general" }],
    ["personal", { visibility: "personal" }],
    ["becoming", { visibility: "general" }],
  ]),
  listDrafts: new Map([
    ["added", draft("created", { visibility: "personal" })],
    ["becoming", draft("changed", { visibility: "personal" })],
  ]),
  choices: new Map(),
  choiceDrafts: new Map([
    ["new-choice", draft("created", { listId: "added" })],
  ]),
} as unknown as ListsState;

const asking = (
  asked: Partial<Record<"lists" | "choices" | "orders", string[]>>,
) => ({
  lists: [],
  choices: [],
  orders: [],
  ...asked,
});

describe("deciding drafts of lists by their classes", () => {
  it("lets a role that sees General data decide a General list's drafts", () => {
    expect(() => {
      requireSeesLists(generalOnly, state, asking({ lists: ["general"] }));
    }).not.toThrow();
  });

  it.each([
    ["a Personal list's order", { orders: ["personal"] }],
    ["a Personal list only drafted to be added", { lists: ["added"] }],
    ["a choice drafted into a Personal list", { choices: ["new-choice"] }],
    ["a General list drafted to become Personal", { lists: ["becoming"] }],
  ])("refuses a role that sees only General data %s", (_case, asked) => {
    expect(() => {
      requireSeesLists(generalOnly, state, asking(asked));
    }).toThrow(ForbiddenError);
  });

  it("checks no list for a choice Fathom no longer has", () => {
    expect(() => {
      requireSeesLists(generalOnly, state, asking({ choices: ["gone"] }));
    }).not.toThrow();
  });

  it("lets a role that sees Personal data decide them", () => {
    expect(() => {
      requireSeesLists(
        seesPersonal,
        state,
        asking({
          lists: ["added", "becoming"],
          choices: ["new-choice"],
          orders: ["personal"],
        }),
      );
    }).not.toThrow();
  });
});
