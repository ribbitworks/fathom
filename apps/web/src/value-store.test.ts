// SPDX-License-Identifier: Apache-2.0

// Tests for a value kept apart from a component's state: what it starts with, and telling its
// listeners only of a value that differs.

import { describe, expect, it, vi } from "vitest";
import { valueStore } from "./value-store.ts";

const sameNumber = (kept: number, next: number) => kept === next;

describe("valueStore", () => {
  it("starts with the value given, or none", () => {
    expect([
      valueStore<number>(sameNumber, 3).get(),
      valueStore<number>(sameNumber).get(),
    ]).toEqual([3, undefined]);
  });

  it("tells its listeners of a value that differs, and keeps it", () => {
    // Given a store and a listener
    const store = valueStore<number>(sameNumber, 1);
    const listener = vi.fn();
    store.subscribe(listener);

    // When a different value is set
    store.set(2);

    // Then the listener hears once, and the store holds it
    expect([listener.mock.calls.length, store.get()]).toEqual([1, 2]);
  });

  it("tells no one of the same value again", () => {
    const store = valueStore<number>(sameNumber, 1);
    const listener = vi.fn();
    store.subscribe(listener);
    store.set(1);
    expect(listener).not.toHaveBeenCalled();
  });

  it("tells a listener nothing once it stops listening", () => {
    const store = valueStore<number>(sameNumber);
    const listener = vi.fn();
    const stop = store.subscribe(listener);
    stop();
    store.set(5);
    expect(listener).not.toHaveBeenCalled();
  });
});
