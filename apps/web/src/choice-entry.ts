// SPDX-License-Identifier: Apache-2.0

// The state and keys of the empty row where a list's new choices are typed or pasted.

import {
  type Choice,
  type ChoiceRequest,
  type List,
  type Meaning,
  typedNumber,
  weightProblem,
} from "@fathom/shared";
import { type ClipboardEvent, type KeyboardEvent, useState } from "react";
import { entryNameId, entryWeightId } from "./choice-ids.ts";
import { type Draft, emptyDraft, type Field } from "./choice-fields.tsx";
import {
  choiceNameProblem,
  pastedChoices,
  pasteProblem,
} from "./choice-rules.ts";
import { focusSoon } from "./focus.ts";
import type { ChoiceActions } from "./list-panel.tsx";

export function useChoiceEntry({
  list,
  meanings,
  weighed,
  add: addChoices,
  select,
  rowAbove,
  rowBelow,
}: {
  // The choices a new one is checked against.
  list: Pick<List, "choices">;
  meanings: readonly Meaning[];
  weighed: boolean;
  add: ChoiceActions["add"];
  select: (target: Choice | undefined) => void;
  // The rows the arrow keys move to from the name: the last choice offered, and the first retired
  // one shown.
  rowAbove: Choice | undefined;
  rowBelow: Choice | undefined;
}) {
  const empty = emptyDraft(meanings);
  const [entry, setEntry] = useState<Draft>(empty);
  const [entryProblem, setEntryProblem] = useState<string>();
  const [entryWeightProblem, setEntryWeightProblem] = useState<string>();

  const change = (next: Draft) => {
    setEntry(next);
    setEntryProblem(undefined);
    setEntryWeightProblem(undefined);
  };

  // Adds what was typed or pasted, giving it back to the empty row if it cannot be saved, and
  // keeps focus there unless it has left. Pasted choices take the meaning chosen and the weight typed
  // in the empty row.
  const add = (requests: ChoiceRequest[], typed: Draft, refocus = true) => {
    const weight = typedNumber(typed.weight);
    const given = {
      ...(typed.meaning === null ? {} : { meaning: typed.meaning }),
      ...(weight === undefined ? {} : { weight }),
    };
    addChoices(
      requests.map((request) => ({ ...request, ...given })),
      () => {
        setEntry(typed);
      },
    );
    // The meaning chosen stays for the next choice.
    setEntry({ ...empty, meaning: typed.meaning });
    setEntryProblem(undefined);
    setEntryWeightProblem(undefined);
    if (refocus) focusSoon(entryNameId);
  };

  const refusedWeight = (refocus: boolean) => {
    const weightWrong = weighed ? weightProblem(entry.weight) : undefined;
    if (weightWrong === undefined) return false;
    setEntryWeightProblem(weightWrong);
    if (refocus) focusSoon(entryWeightId);
    return true;
  };

  const addEntry = (refocus = true) => {
    if (
      entry.label.trim() === "" &&
      entry.description.trim() === "" &&
      entry.weight.trim() === ""
    ) {
      return;
    }
    const problem = choiceNameProblem(list, entry.label);
    if (problem !== undefined) {
      setEntryProblem(problem);
      if (refocus) focusSoon(entryNameId);
      return;
    }
    if (refusedWeight(refocus)) return;
    add(
      [{ label: entry.label.trim(), description: entry.description.trim() }],
      entry,
      refocus,
    );
  };

  // Pasting several lines, or a row copied from a spreadsheet, adds a choice for each line.
  const paste = (event: ClipboardEvent<HTMLInputElement>) => {
    const text = event.clipboardData.getData("text/plain");
    if (!/[\n\t]/.test(text.trim())) return;
    event.preventDefault();
    const choices = pastedChoices(text);
    const problem = pasteProblem(list, choices);
    if (problem !== undefined) {
      setEntryProblem(problem);
      return;
    }
    if (refusedWeight(true)) return;
    add(choices, entry);
  };

  const onEntryKey = (event: KeyboardEvent, field: Field) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      addEntry();
    } else if (event.key === "Escape") {
      if (
        entry.label === "" &&
        entry.description === "" &&
        entry.weight === ""
      ) {
        return;
      }
      event.preventDefault();
      setEntry({ ...empty, meaning: entry.meaning });
      setEntryProblem(undefined);
      setEntryWeightProblem(undefined);
    } else if (field === "label" && event.key === "ArrowUp" && !event.altKey) {
      event.preventDefault();
      select(rowAbove);
    } else if (
      field === "label" &&
      event.key === "ArrowDown" &&
      !event.altKey
    ) {
      event.preventDefault();
      select(rowBelow);
    }
  };

  return {
    entry,
    entryProblem,
    entryWeightProblem,
    change,
    addEntry,
    paste,
    onEntryKey,
  };
}
