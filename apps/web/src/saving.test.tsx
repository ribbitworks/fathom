// SPDX-License-Identifier: Apache-2.0

// Tests for saving changes on a page: that only the latest change made offers Undo, even when an
// earlier one finishes saving after a later one was made, and which fields leave Cmd+Z to their own
// undo.

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { changeMade, notifySuccess, notifyUndoable } from "./notices.tsx";
import { isUndo, useSaving } from "./saving.ts";

// Semgrep can't parse typeof import() as a type argument.
type Notices = typeof import("./notices.tsx");

vi.mock("./notices.tsx", async (actual) => ({
  ...(await actual<Notices>()),
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

describe("Cmd+Z", () => {
  // Whether Cmd+Z, pressed with focus on the element, undoes the latest saved change, heard on the
  // page as the page hears it, after the element's own handlers.
  function undoesFrom(element: HTMLElement): boolean {
    document.body.append(element);
    let undoes = false;
    const onKey = (event: KeyboardEvent) => {
      undoes = isUndo(event);
    };
    document.addEventListener("keydown", onKey);
    element.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "z",
        metaKey: true,
        bubbles: true,
        cancelable: true,
      }),
    );
    document.removeEventListener("keydown", onKey);
    element.remove();
    return undoes;
  }

  // A note editor whose own undo takes away all its typing, leaving it empty.
  function noteEditorUndoingToEmpty() {
    const element = noteEditor("<p>Draft</p>");
    element.addEventListener("keydown", (event) => {
      element.innerHTML = "<p><br></p>";
      event.preventDefault();
    });
    return element;
  }

  function field(tag: "input" | "textarea", value: string, type?: string) {
    const element = document.createElement(tag);
    if (type !== undefined) element.setAttribute("type", type);
    element.value = value;
    return element;
  }

  function noteEditor(html: string) {
    const element = document.createElement("div");
    element.setAttribute("contenteditable", "true");
    element.innerHTML = html;
    return element;
  }

  it.each([
    ["a text field with text", "the typing", field("input", "Draft")],
    [
      "an email field with text",
      "the typing",
      field("input", "a@b.test", "email"),
    ],
    ["a text area with text", "the typing", field("textarea", "Draft")],
    ["the note editor with text", "the typing", noteEditor("<p>Draft</p>")],
    [
      "the note editor undoing all its typing",
      "the typing",
      noteEditorUndoingToEmpty(),
    ],
    ["an empty text field", "the saved change", field("input", "")],
    ["the empty note editor", "the saved change", noteEditor("<p><br></p>")],
    ["a checkbox", "the saved change", field("input", "on", "checkbox")],
    ["a button", "the saved change", document.createElement("button")],
  ])("in %s undoes %s", (_name, undone, element) => {
    expect(undoesFrom(element)).toBe(undone === "the saved change");
  });
});
