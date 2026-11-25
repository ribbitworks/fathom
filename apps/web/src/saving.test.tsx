// SPDX-License-Identifier: Apache-2.0

// Tests for saving changes on a page: that only the latest change made offers Undo, even when an
// earlier one finishes saving after a later one was made, and which fields leave Cmd+Z to their own
// undo, and the words and undo of discarding and resubmitting a draft.

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { changeMade, notifySuccess, notifyUndoable } from "./notices.tsx";
import { type Change, draftSaving, isUndo, useSaving } from "./saving.ts";

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

describe("discarding and resubmitting a draft", () => {
  interface Data {
    items: string[];
  }
  const before: Data = { items: ["Atlas"] };

  // A page's saving that keeps the change asked for, so its saving can be played out.
  function pageSaving() {
    const saved: Change<Data>[] = [];
    const saving = {
      save: vi.fn((change: Change<Data>) => {
        saved.push(change);
      }),
      undoable: vi.fn(),
      done: vi.fn(),
    };
    const savedAs = (changeSetId: string | null) => {
      saved[0]?.onSaved?.(changeSetId, before);
    };
    return {
      drafts: draftSaving<Data>(saving),
      saving,
      saved,
      savedAs,
    };
  }

  const discardSave = () => Promise.resolve("change-set-1");

  it("names the record in a discard's failure, and leaves the data as it is unless told", () => {
    const { drafts, saved } = pageSaving();
    drafts.discard({ name: "Atlas", save: discardSave });
    expect(saved[0]?.failure).toBe(
      "Fathom could not discard the draft of Atlas.",
    );
    expect(saved[0]?.save).toBe(discardSave);
    expect(saved[0]?.next(before)).toBe(before);
  });

  it("shows the data as the change given has it", () => {
    const { drafts, saved } = pageSaving();
    const next = (data: Data) => ({ items: [...data.items, "Beacon"] });
    drafts.discard({ name: "Atlas", save: discardSave, next });
    expect(saved[0]?.next).toBe(next);
  });

  it("offers Undo by Cmd+Z alone for a discard without a notice", () => {
    const { drafts, saving, savedAs } = pageSaving();
    drafts.discard({ name: "Atlas", save: discardSave, notice: undefined });
    savedAs("change-set-1");
    expect(saving.undoable).toHaveBeenCalledWith("change-set-1", before);
    expect(saving.done).not.toHaveBeenCalled();
  });

  it.each([
    ["adding", "Discarded the draft adding Atlas."],
    ["of", "Discarded the draft of Atlas."],
  ] as const)(
    "says what a discard with the %s notice did",
    (notice, message) => {
      const { drafts, saving, savedAs } = pageSaving();
      drafts.discard({ name: "Atlas", save: discardSave, notice });
      savedAs("change-set-1");
      expect(saving.done).toHaveBeenCalledWith(
        message,
        "change-set-1",
        before,
        undefined,
        undefined,
      );
      expect(saving.undoable).not.toHaveBeenCalled();
    },
  );

  it("runs what a discard gives once it is undone", () => {
    const { drafts, saving, savedAs } = pageSaving();
    const onUndone = vi.fn();
    drafts.discard({
      name: "Atlas",
      save: discardSave,
      notice: "of",
      onUndone,
    });
    savedAs("change-set-1");
    expect(saving.done).toHaveBeenCalledWith(
      "Discarded the draft of Atlas.",
      "change-set-1",
      before,
      undefined,
      onUndone,
    );
  });

  it.each([
    ["Atlas", "Fathom could not send the draft of Atlas for approval again."],
    [undefined, "Fathom could not send the draft for approval again."],
  ])("names %s in a resubmit's failure", (name, failure) => {
    const { drafts, saved } = pageSaving();
    drafts.resubmit({
      ...(name === undefined ? {} : { name }),
      save: discardSave,
    });
    expect(saved[0]?.failure).toBe(failure);
    expect(saved[0]?.next(before)).toBe(before);
  });

  it("offers Undo for a resubmit once saved, and shows the data as the change given has it", () => {
    const { drafts, saving, saved, savedAs } = pageSaving();
    const next = (data: Data) => ({ items: [...data.items, "Beacon"] });
    drafts.resubmit({ name: "Atlas", save: discardSave, next });
    savedAs(null);
    expect(saved[0]?.next).toBe(next);
    expect(saving.undoable).toHaveBeenCalledWith(null, before);
  });
});
