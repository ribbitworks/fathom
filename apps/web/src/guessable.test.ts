// SPDX-License-Identifier: Apache-2.0

// Tests for loading the check for guessable passwords: it loads once and is kept, a failed load is
// tried again, and the hook gives the check once it has loaded, and nothing if it cannot load.

import type { GuessableCheck } from "@fathom/shared";
import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { loadGuessableCheck, useGuessableCheck } from "./guessable.ts";

const owner = { name: "Fictional Person", email: "person@example.test" };

describe("loadGuessableCheck", () => {
  it("tries again after a failed load, then keeps the check it loaded", async () => {
    const check: GuessableCheck = () => true;
    await expect(
      loadGuessableCheck(() => Promise.reject(new Error("offline"))),
    ).rejects.toThrow("offline");
    const load = vi.fn(() => Promise.resolve({ isGuessable: check }));
    expect(await loadGuessableCheck(load)).toBe(check);
    expect(await loadGuessableCheck(load)).toBe(check);
    expect(load).toHaveBeenCalledTimes(1);
  });
});

describe("useGuessableCheck", () => {
  it("gives the check once it has loaded", async () => {
    const check: GuessableCheck = () => false;
    const { result } = renderHook(() =>
      useGuessableCheck(() => Promise.resolve(check)),
    );
    expect(result.current).toBeUndefined();
    await waitFor(() => {
      expect(result.current).toBe(check);
    });
  });

  it("gives nothing when the check cannot load", async () => {
    const load = vi.fn(() => Promise.reject(new Error("offline")));
    const { result } = renderHook(() => useGuessableCheck(load));
    await waitFor(() => {
      expect(load).toHaveBeenCalled();
    });
    await Promise.resolve();
    expect(result.current).toBeUndefined();
  });

  it("loads the real check from the shared package", async () => {
    vi.resetModules();
    const fresh = await import("./guessable.ts");
    const isGuessable = await fresh.loadGuessableCheck();
    expect(isGuessable("test12345678", owner)).toBe(true);
    expect(isGuessable("Correct-horse-91", owner)).toBe(false);
  });
});
