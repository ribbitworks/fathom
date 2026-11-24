// SPDX-License-Identifier: Apache-2.0

// Rules about a list's choices: which must stay offered, which names will do, and how pasted lines
// become choices.

import {
  type Choice,
  type ChoiceRequest,
  type Kept,
  keptOf,
  type List,
  listLengths,
  type Meaning,
  sameName,
} from "@fathom/shared";
import { nameProblem } from "./lists.ts";

const duplicate = "Already in this list";
// The most choices one paste adds, as the server allows at once.
const pasteLimit = 1000;

export const removedChoice = (choice: Choice) =>
  choice.draft?.action === "deleted";

const offers = (choice: Choice, kept: Kept) =>
  !choice.retired &&
  !removedChoice(choice) &&
  (kept === "any" || choice.meaning === kept);

// What a choice is the last one offered for, as the list's drafts make it, if anything: a meaning
// it keeps, or, in Positions, the list's last choice. It is not retired or removed, and keeps its
// meaning, so a built-in list always has a choice to offer.
export function lastKept(list: List, choice: Choice): Kept | undefined {
  return keptOf(list.builtIn).find(
    (kept) =>
      offers(choice, kept) &&
      !list.choices.some(
        (other) => other.id !== choice.id && offers(other, kept),
      ),
  );
}

// The meaning a choice must keep, as the last one offered for it.
export const meaningKeptBy = (
  list: List,
  choice: Choice,
): Meaning | undefined => {
  const kept = lastKept(list, choice);
  return kept === "any" ? undefined : kept;
};

// The choices pasted as lines, each a name, then a tab and a description when copied from a
// spreadsheet.
export function pastedChoices(text: string): ChoiceRequest[] {
  return text
    .split(/\r?\n/)
    .filter((line) => line.trim() !== "")
    .map((line) => {
      const [label = "", ...rest] = line.split("\t");
      return { label: label.trim(), description: rest.join(" ").trim() };
    });
}

// Why a choice's name will not do, if it won't; a choice being renamed may keep its own name.
export const choiceNameProblem = (list: List, label: string, except?: string) =>
  nameProblem(
    label,
    listLengths.choice,
    list.choices.some(
      (other) => other.id !== except && sameName(other.label, label),
    ),
    duplicate,
  );

// Why pasted choices cannot be added, if they can't, naming the line when there are several.
export function pasteProblem(
  list: List,
  pasted: readonly ChoiceRequest[],
): string | undefined {
  if (pasted.length > pasteLimit) {
    return `Up to ${String(pasteLimit)} lines at once`;
  }
  const seen: string[] = [];
  for (const [index, choice] of pasted.entries()) {
    const problem =
      choiceNameProblem(list, choice.label) ??
      (choice.description.length > listLengths.description
        ? "Description too long"
        : undefined) ??
      (seen.some((label) => sameName(label, choice.label))
        ? duplicate
        : undefined);
    if (problem !== undefined) {
      return pasted.length === 1
        ? problem
        : `Line ${String(index + 1)}: ${problem}`;
    }
    seen.push(choice.label);
  }
  return undefined;
}
