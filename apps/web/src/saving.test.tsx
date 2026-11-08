// SPDX-License-Identifier: Apache-2.0

// Tests for saving changes on a page: that only the latest change made offers Undo, even when an
// earlier one finishes saving after a later one was made.

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { changeMade, notifySuccess, notifyUndoable } from "./notices.tsx";
import { useSaving } from "./saving.ts";

vi.mock("./notices.tsx", async (actual) => ({
  ...(await actual<typeof import("./notices.tsx")>()),
  notifySuccess: vi.fn(),
  notifyUndoable: vi.fn(),
}));

const queryKey = ["saving-test"];

// One client for the whole test, as the page has, holding the data changed.
function wrapperFor(client: QueryClient) {
  client.setQueryData(queryKey, { items: ["one"] });
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
  };
}

describe("saving a change", () => {
  it("only says what was done, without Undo, once a later change was made while it saved", async () => {
    // Given a change saving, which says what it did once saved
    const { result } = renderHook(
      () =>
        useSaving({ queryKey, removed: "Removed elsewhere.", blocked: false }),
      { wrapper: wrapperFor(new QueryClient()) },
    );
    let finish: ((changeSetId: string) => void) | undefined;
    act(() => {
      result.current.save({
        next: (data) => data,
        save: () =>
          new Promise<string>((resolve) => {
            finish = resolve;
          }),
        failure: "Could not save.",
        onSaved: (changeSetId, before) => {
          result.current.done("Removed the one.", changeSetId, before);
        },
      });
    });
    await waitFor(() => {
      expect(finish).toBeDefined();
    });
    // When another change is made before it finishes saving
    changeMade();
    act(() => {
      finish?.("change-set-1");
    });
    // Then it says what it did, without offering Undo
    await waitFor(() => {
      expect(notifySuccess).toHaveBeenCalledWith("Removed the one.");
    });
    expect(notifyUndoable).not.toHaveBeenCalled();
  });
});
