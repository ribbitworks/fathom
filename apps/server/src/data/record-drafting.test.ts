// SPDX-License-Identifier: Apache-2.0

// Unit tests for a record to change: the record as its draft makes it, or why it can't be changed,
// and the error each refusal is sent as.

import { describe, expect, it } from "vitest";
import { ConflictError, NotFoundError } from "../errors.ts";
import {
  changeableRecord,
  recordToChange,
  refusalError,
} from "./record-drafting.ts";
import {
  draft,
  feature,
  kindState,
  recordsState,
} from "./test-records-state.ts";

const id = "customer-1";
const live = { name: "Fictional Harbour Co." };

describe("a record to change", () => {
  it("is the live record when it has no draft", () => {
    const state = recordsState({ customer: kindState([[id, live]]) });
    expect(recordToChange(state, "customer", id)).toEqual({ record: live });
  });

  it("is the record as its draft makes it", () => {
    const state = recordsState({
      customer: kindState(
        [[id, live]],
        [[id, draft("changed", { name: "Fictional Port Co." })]],
      ),
    });
    expect(recordToChange(state, "customer", id)).toEqual({
      record: { name: "Fictional Port Co." },
    });
  });

  it("is a record only drafted to be added, as drafted", () => {
    const state = recordsState({
      customer: kindState([], [[id, draft("created", live)]]),
    });
    expect(recordToChange(state, "customer", id)).toEqual({ record: live });
  });

  it("is missing when there is no such record", () => {
    expect(recordToChange(recordsState({}), "customer", id)).toEqual({
      refusal: { reason: "missing" },
    });
  });

  it("is the record as it is when it has no draft", () => {
    const ordinary = feature(null);
    const state = recordsState({
      feature: kindState([["feature-1", ordinary]]),
    });
    expect(recordToChange(state, "feature", "feature-1")).toEqual({
      record: ordinary,
    });
  });

  it("is removed when its draft removes it", () => {
    const state = recordsState({
      customer: kindState([[id, live]], [[id, draft("deleted")]]),
    });
    expect(recordToChange(state, "customer", id)).toEqual({
      refusal: { reason: "removed" },
    });
  });
});

describe("the error a refusal is sent as", () => {
  it("is not found for a missing record", () => {
    expect(refusalError({ reason: "missing" })).toEqual(
      new NotFoundError("There is no such record; refresh to see the latest"),
    );
  });

  it("is a conflict saying to discard the draft that removes it", () => {
    expect(refusalError({ reason: "removed" })).toEqual(
      new ConflictError(
        "This record's draft removes it; discard the draft to change it",
      ),
    );
  });
});

describe("changing a record", () => {
  it("gives the record to change", () => {
    const state = recordsState({ customer: kindState([[id, live]]) });
    expect(changeableRecord(state, "customer", id)).toEqual(live);
  });

  it("throws the refusal's error when it can't be changed", () => {
    expect(() => changeableRecord(recordsState({}), "customer", id)).toThrow(
      NotFoundError,
    );
  });
});
