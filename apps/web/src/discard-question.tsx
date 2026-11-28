// SPDX-License-Identifier: Apache-2.0

// Asking whether to discard what is being written before leaving it.

import type { KeyboardEvent } from "react";
import { useRemovalQuestion } from "./removal-question.tsx";

export const newRecordQuestion = (thing: string) => ({
  title: `Discard the new ${thing}?`,
  keep: "Keep adding",
});

export const changesQuestion = (thing: string) => ({
  title: `Discard changes to the ${thing}?`,
  keep: "Keep editing",
});

// Asking whether to discard what is being written before leaving it: a note changed, a record being
// added that holds something, or a dialog's changes. Discard goes on; the keep button, such as Keep
// writing, or closing the question, stays.

export function useDiscardQuestion() {
  const question = useRemovalQuestion();
  const ask = (
    asked: { title: string; keep: string } | undefined,
    go: () => void,
  ) => {
    if (asked === undefined) go();
    else question.ask({ ...asked, action: "Discard" }, go);
  };
  // Whether the question is showing, so a dialog under it leaves Esc to it.
  return { ask, dialog: question.dialog, asking: question.asking };
}

// Esc in a dialog that asks before it's left: it leaves, asking, unless something in the dialog that
// is open, a drop-down list or a menu, takes it to close that alone, a field has used it already, or
// the dialog is busy saving. The dialog's own Esc is turned off, so the question it may open doesn't
// take the same Esc as its own.
export const escapeLeaves =
  (leave: () => void, busy: boolean) => (event: KeyboardEvent) => {
    const inOpenList =
      event.target instanceof HTMLElement &&
      event.target.getAttribute("aria-expanded") === "true";
    if (
      event.key !== "Escape" ||
      busy ||
      inOpenList ||
      event.defaultPrevented
    ) {
      return;
    }
    event.stopPropagation();
    leave();
  };
