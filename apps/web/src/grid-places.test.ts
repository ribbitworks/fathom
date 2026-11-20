// SPDX-License-Identifier: Apache-2.0

// Tests for the cell selected in the shared table, kept apart from the table's state.

import { describe, expect, it, vi } from "vitest";
import { placeStore } from "./grid-places.ts";

describe("the cell selected", () => {
  it("starts with none, and tells each listener when another is selected", () => {
    const store = placeStore();
    const listener = vi.fn();
    store.subscribe(listener);
    expect(store.get()).toBeUndefined();
    store.set({ row: "r1", column: "name" });
    store.set({ row: "r2", column: "name" });
    expect([store.get(), listener.mock.calls.length]).toEqual([
      { row: "r2", column: "name" },
      2,
    ]);
  });

  it("tells no one when the same cell is selected again, nor anyone who stopped listening", () => {
    const store = placeStore();
    const kept = vi.fn();
    const gone = vi.fn();
    store.subscribe(kept);
    const stop = store.subscribe(gone);
    store.set({ row: "r1", column: "name" });
    stop();
    store.set({ row: "r1", column: "name" });
    store.set({ row: "r1", column: "code" });
    expect([kept.mock.calls.length, gone.mock.calls.length]).toEqual([2, 1]);
  });
});
