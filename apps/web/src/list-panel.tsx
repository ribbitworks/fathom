// SPDX-License-Identifier: Apache-2.0

// The side panel for one list: its name, description, and choices in order. Opening it puts focus
// in it. Users who may edit lists work from the keyboard. An empty row at the end takes new
// choices: Tab moves to the description and Enter adds the choice and starts the next, and pasting
// several lines adds one choice for each. Arrow keys select a choice, Enter edits it in place,
// Alt+arrows move it, R retires or restores it, and Delete removes it, each also in the choice's
// menu. Choices can also be dragged by their grip. Esc closes an open menu, then the panel. Viewers
// see the same choices, read only. Drafts are marked in place: the list's and its order's under its
// name, each choice's on its row, with what can be done with them in the list's menu beside its
// name and in each choice's menu. A list or choice a draft removes is struck through and read only.
// A built-in list is marked so. In a list with meanings, each choice shows its meaning, chosen
// when it is added or edited, and the last choice offered for a meaning cannot be retired, removed,
// or given another meaning. In feature sizes, each choice shows its weight, typed when it is added
// or edited; pasted choices take the weight typed in the empty row.

import { actionsFor, MoreButton } from "./row-controls.tsx";
import { movedItem } from "./table-view.ts";
import {
  DragDropContext,
  Draggable,
  Droppable,
  type DropResult,
} from "@hello-pangea/dnd";
import {
  type BuiltInList,
  type Choice,
  type ChoiceRequest,
  type Kept,
  keptOf,
  type List,
  listLengths,
  typedNumber,
  weighs,
  weightProblem,
  type Meaning,
  meaningName,
  meaningSchema,
  meaningsOf,
} from "@fathom/shared";
import {
  ActionIcon,
  Button,
  FocusTrap,
  Menu,
  Stack,
  Text,
  VisuallyHidden,
} from "@mantine/core";
import {
  type ClipboardEvent,
  type FocusEvent,
  type KeyboardEvent,
  Fragment,
  useEffect,
  useState,
} from "react";
import { focusSoon } from "./focus.ts";
import { Icon } from "./icons.tsx";
import { Count, nameProblem } from "./list-dialog.tsx";
import {
  ListDraftMenu,
  draftRowClass,
  type ListDraftActions,
  movedChoices,
  ordinal,
} from "./list-drafts.tsx";
import {
  configDraftFields,
  draftLines,
  HeldNote,
  MenuDraftLines,
  MenuTitle,
  UnpublishedNote,
  OtherApproverNote,
  WaitingNote,
} from "./draft-details.tsx";
import { originalOf } from "./record-drafts.ts";
import { decidable, type DraftSelection, noDrafts } from "./drafts.ts";
import {
  changedValue,
  DraftedItem,
  DraftedValue,
  emptiedWords,
  ClassMark,
  FactBox,
  LiveLine,
  LiveRowMarks,
  LiveValue,
  MarkRow,
  recordMark,
} from "./status-mark.tsx";
import { liveLists, retiredLive, sameName, withRetiring } from "./lists.ts";
import { closesOnBlankClick } from "./app-menu.tsx";
import classes from "./pages.module.css";
import { count, decimal } from "./numbers.ts";

export interface ChoiceActions {
  // Adds choices; if they cannot be saved, gives back what was typed.
  add: (requests: ChoiceRequest[], onFailed: () => void) => void;
  edit: (choice: Choice, request: ChoiceRequest) => void;
  // Moves a choice to just after another, or to the top when there is none.
  move: (choice: Choice, after: string | null) => void;
  setRetired: (choice: Choice, retired: boolean) => void;
  remove: (choice: Choice) => void;
}

// The keyboard shortcuts shown in menus, such as each choice's or each column's, as Macs and other
// computers name the keys.
export function shortcutsFor(userAgent: string) {
  const mac = /Mac|iPhone|iPad/.test(userAgent);
  return {
    edit: mac ? "↵" : "Enter",
    up: mac ? "⌥↑" : "Alt+↑",
    down: mac ? "⌥↓" : "Alt+↓",
    left: mac ? "⌥←" : "Alt+←",
    right: mac ? "⌥→" : "Alt+→",
    wider: mac ? "⇧⌥→" : "Shift+Alt+→",
    narrower: mac ? "⇧⌥←" : "Shift+Alt+←",
    retire: "R",
    remove: mac ? "⌫" : "Del",
  };
}

const shortcuts = shortcutsFor(navigator.userAgent);

export const entryNameId = "choice-entry-name";
const editNameId = "choice-edit-name";
const entryWeightId = "choice-entry-weight";
const editWeightId = "choice-edit-weight";
export const titleId = "list-panel-title";
const classHeldId = "list-panel-class-held";
export const rowId = (choice: { id: string }) => `choice-${choice.id}`;
const actionsId = (choice: { id: string }) => `choice-actions-${choice.id}`;
const duplicate = "Already in this list";
// The most choices one paste adds, as the server allows at once.
const pasteLimit = 1000;

// The choice a moved one should follow, or null for the top, once it moves from one place in the
// list to another.
export function followingAfterMove(
  items: readonly { id: string }[],
  from: number,
  to: number,
): string | null {
  return movedItem(items, from, to).slice(0, to).at(-1)?.id ?? null;
}

// The move a drop asks for, if the choice was dropped somewhere new.
export function droppedMove(
  offered: readonly Choice[],
  result: Pick<DropResult, "source" | "destination">,
): { choice: Choice; after: string | null } | undefined {
  const from = result.source.index;
  const to = result.destination?.index ?? from;
  const [choice] = offered.slice(from, from + 1);
  if (to === from || choice === undefined) return undefined;
  return { choice, after: followingAfterMove(offered, from, to) };
}

// A row's classes, lifted while it is being dragged.
export function liftedWhileDragging(base: string, dragging: boolean): string {
  return dragging ? `${base} ${String(classes.choiceLifted)}` : base;
}

// What a list Fathom builds in is for, shown under its choices; the organization's own description
// of it shows under its name, as for any list.
// Fathom filled the list in, so those who may change it are first told it is theirs to change.
function builtInNote(key: BuiltInList, mayChange: boolean): string {
  const invitation = mayChange
    ? "These can be renamed, added to, or retired.\n"
    : "";
  switch (key) {
    case "hiring-states":
      return `${invitation}Proposed: the request to hire is not yet approved.\nOpen: the request to hire is approved.\nHired: everyone in People who hasn't left. A planned hire is hired when someone fills it.\nLeft: everyone in People whose end date has passed.\nKeep at least one choice for each.`;
    case "positions":
      return `${invitation}Every person and planned hire has one of these positions.\nKeep at least one.`;
    case "proposal-statuses":
      return `${invitation}Every proposal has one of these statuses.\nKeep at least one.`;
    case "feature-statuses":
      return `${invitation}Possible: the feature may come, and needs no feature team yet.\nPlanned: the feature is planned, and needs a feature team.\nIn progress: work has started, and the feature needs a feature team.\nDone: the feature is finished.\nCancelled: the feature won't be built.\nKeep at least one choice for each.`;
    case "feature-priorities":
      return `${invitation}How much a feature matters to the organization, apart from its status, highest first.\nKeep at least one.`;
    case "feature-sizes":
      return `${invitation}A feature's rough size, before it is estimated, smallest first.\nKeep at least one.`;
    case "feature-risks":
      return `${invitation}How much could go wrong in building a feature, lowest first.\nKeep at least one.`;
  }
}

// The facts about a list: whether Fathom builds it in, so it cannot be retired or removed, and the
// class of the values chosen from it.
export function ListFacts({ list }: { list: List }) {
  return (
    <>
      {list.builtIn && <FactBox>Built in</FactBox>}
      <ClassMark dataClass={list.visibility} />
    </>
  );
}

// A choice's meaning in words, or nothing for one the server no longer knows, which it sends
// without one.
const meaningText = (meaning: Meaning | undefined) =>
  meaning === undefined ? "" : meaningName(meaning);

const weightText = (weight: number | undefined) =>
  weight === undefined ? "" : decimal(weight);

const typedWeight = (weight: number | undefined) =>
  weight === undefined ? "" : String(weight);

// What a list's panel shows of the list, each marked before it where a draft changes it.
const listFields = new Set(["name", "description"]);

// What a choice's row shows of the choice, each marked by its own dot where a draft changes it.
const choiceRowFields = new Set(["label", "description"]);

const removedChoice = (choice: Choice) => choice.draft?.action === "deleted";

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
const meaningKeptBy = (list: List, choice: Choice): Meaning | undefined => {
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

interface Draft {
  label: string;
  description: string;
  // In a list with meanings; null in any other.
  meaning: Meaning | null;
  // As typed, in feature sizes; empty in any other list.
  weight: string;
}

type Field = "label" | "description" | "meaning" | "weight";

function Fields({
  idPrefix,
  draft,
  problem,
  label,
  meanings,
  meaningKept,
  weighed,
  weightProblem: weightWrong,
  onChange,
  onKeyDown,
  onFocus,
  onPaste,
}: {
  idPrefix: "choice-entry" | "choice-edit";
  draft: Draft;
  problem: string | undefined;
  label: string;
  // The list's meanings, none unless it is a list with meanings.
  meanings: readonly Meaning[];
  // The meaning a choice must keep, as the last one offered for it.
  meaningKept?: Meaning | undefined;
  weighed: boolean;
  weightProblem: string | undefined;
  onChange: (draft: Draft) => void;
  onKeyDown: (event: KeyboardEvent, field: Field) => void;
  onFocus?: () => void;
  onPaste?: (event: ClipboardEvent<HTMLInputElement>) => void;
}) {
  const entry = idPrefix === "choice-entry";
  // A refused weight's reason is under the row's first cell, as any refused value's is.
  const shownProblem = problem ?? weightWrong;
  return (
    <>
      <span className={classes.choiceName} role="gridcell">
        <input
          id={`${idPrefix}-name`}
          className={classes.cellInput}
          value={draft.label}
          aria-label={`${label}name`}
          aria-invalid={problem !== undefined}
          aria-describedby={problem ? `${idPrefix}-problem` : undefined}
          placeholder={entry ? "Name" : undefined}
          autoComplete="off"
          onChange={(event) => {
            onChange({ ...draft, label: event.currentTarget.value });
          }}
          onKeyDown={(event) => {
            onKeyDown(event, "label");
          }}
          onFocus={onFocus}
          onPaste={onPaste}
        />
        {(shownProblem ?? draft.label.length >= listLengths.choice - 5) && (
          <span className={classes.cellBelow}>
            {shownProblem && (
              <span
                className={classes.problem}
                id={`${idPrefix}-problem`}
                role="alert"
              >
                {shownProblem}
              </span>
            )}
            <Count
              length={draft.label.trim().length}
              maximum={listLengths.choice}
            />
          </span>
        )}
      </span>
      <span className={classes.choiceDescription} role="gridcell">
        <textarea
          id={`${idPrefix}-description`}
          className={classes.cellInput}
          rows={1}
          value={draft.description}
          aria-label={`${label}description`}
          placeholder={entry ? "Description" : undefined}
          onChange={(event) => {
            onChange({ ...draft, description: event.currentTarget.value });
          }}
          onKeyDown={(event) => {
            onKeyDown(event, "description");
          }}
          onFocus={onFocus}
        />
      </span>
      {meanings.length > 0 && (
        <span className={classes.choiceMeaning} role="gridcell">
          <select
            id={`${idPrefix}-meaning`}
            className={classes.cellInput}
            value={draft.meaning ?? ""}
            aria-label={`${label}meaning`}
            aria-describedby={
              meaningKept === undefined ? undefined : `${idPrefix}-meaning-kept`
            }
            disabled={meaningKept !== undefined}
            onChange={(event) => {
              onChange({
                ...draft,
                // The menu offers only the list's meanings.
                meaning: meaningSchema.parse(event.currentTarget.value),
              });
            }}
            onKeyDown={(event) => {
              onKeyDown(event, "meaning");
            }}
            onFocus={onFocus}
          >
            {draft.meaning === null && (
              <option value="" disabled>
                Choose a meaning
              </option>
            )}
            {meanings.map((meaning) => (
              <option key={meaning} value={meaning}>
                {meaningName(meaning)}
              </option>
            ))}
          </select>
          {meaningKept !== undefined && (
            <span className={classes.cellBelow} id={`${idPrefix}-meaning-kept`}>
              Needed for {meaningName(meaningKept)}
            </span>
          )}
        </span>
      )}
      {weighed && (
        <span className={classes.choiceWeight} role="gridcell">
          <input
            id={`${idPrefix}-weight`}
            className={classes.cellInput}
            value={draft.weight}
            inputMode="decimal"
            aria-label={`${label}weight`}
            aria-invalid={weightWrong !== undefined}
            aria-describedby={weightWrong ? `${idPrefix}-problem` : undefined}
            placeholder={entry ? "Weight" : undefined}
            autoComplete="off"
            onChange={(event) => {
              onChange({ ...draft, weight: event.currentTarget.value });
            }}
            onKeyDown={(event) => {
              onKeyDown(event, "weight");
            }}
            onFocus={onFocus}
          />
        </span>
      )}
    </>
  );
}

export function ListPanel({
  list,
  canEdit: mayEdit,
  canApprove,
  showLive = true,
  drafted,
  waits,
  narrow,
  actions,
  draftActions,
  onClose,
  onEditList,
  onMoveClass,
}: {
  list: List;
  canEdit: boolean;
  canApprove: boolean;
  // Whether a choice a draft changes or moves shows its live row too.
  showLive?: boolean;
  // The list with every draft, whatever the view, which the marks are worked out from, so the Draft
  // view decides how they show.
  drafted: List;
  // Whether drafts wait for a rejected draft they depend on, which takes every list to tell, as the
  // list shown may have its rejected drafts taken back.
  waits: (selection: DraftSelection) => boolean;
  narrow: boolean;
  actions: ChoiceActions;
  draftActions: ListDraftActions;
  onClose: () => void;
  onEditList: () => void;
  // Changes the list's class, for a role with Classify data, once the list is approved and while it
  // is not drafted to be removed.
  onMoveClass?: (() => void) | undefined;
}) {
  // A list a draft removes cannot be changed until the draft is discarded.
  const listRemoved = list.draft?.action === "deleted";
  // Nor can a list, a choice, or the order of the choices while someone else has unpublished
  // changes to it.
  const canEdit = mayEdit && !listRemoved && list.heldBy === undefined;
  const canMove = canEdit && list.orderHeldBy === undefined;
  const meanings = meaningsOf(list.builtIn);
  const [firstMeaning = null] = meanings;
  const weighed = weighs(list.builtIn);
  const shape = [
    classes.choice,
    meanings.length > 0 ? classes.choiceWithMeaning : "",
    weighed ? classes.choiceWithWeight : "",
  ];
  const empty: Draft = {
    label: "",
    description: "",
    meaning: firstMeaning,
    weight: "",
  };
  // The choices a draft of the order moves, with their live places.
  const moved = movedChoices(list);
  const original = drafted;
  // The list's description as it is live, which a list only drafted to be added has none of.
  const liveDescription = liveLists([original])[0]?.description ?? "";
  const originalChoices = new Map(
    original.choices.map((choice) => [choice.id, choice]),
  );
  const movedInDraft = movedChoices(original);
  // A choice a draft removes cannot be changed either.
  const removed = removedChoice;
  // Beside live, a choice a draft retires or restores stays where it is live until approved.
  const isRetired = (choice: Choice) =>
    showLive ? retiredLive(choice) : choice.retired;
  const offered = list.choices.filter((choice) => !isRetired(choice));
  const retired = list.choices.filter(isRetired);
  const [showRetired, setShowRetired] = useState(false);
  const [selected, setSelected] = useState<string>();
  const [editing, setEditing] = useState<string>();
  const [draft, setDraft] = useState<Draft>(empty);
  const [editProblem, setEditProblem] = useState<string>();
  const [editWeightProblem, setEditWeightProblem] = useState<string>();
  const [entry, setEntry] = useState<Draft>(empty);
  const [entryProblem, setEntryProblem] = useState<string>();
  const [entryWeightProblem, setEntryWeightProblem] = useState<string>();
  const [menuFor, setMenuFor] = useState<string>();
  const shownRetired = showRetired ? retired : [];
  // The rows arrow keys move through, in order, with the empty row between offered and retired.
  const order: (Choice | "entry")[] = [
    ...offered,
    ...(canEdit ? (["entry"] as const) : []),
    ...shownRetired,
  ];
  const [first] = offered;
  // Where focus starts when the panel opens: the first choice, the empty row, or the list's name.
  const start = canEdit ? (first ? rowId(first) : entryNameId) : titleId;

  // Opening a list puts focus in its panel, which is drawn anew for each list.
  useEffect(() => {
    focusSoon(start);
    // Only when the panel opens, not after every change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const select = (target: Choice | "entry" | undefined) => {
    if (target === undefined) return;
    if (target === "entry") {
      focusSoon(entryNameId);
      return;
    }
    setSelected(target.id);
    focusSoon(rowId(target));
  };

  // The row that takes the selection when a choice leaves its section.
  const neighbourIn = (section: Choice[], choice: Choice) => {
    const index = section.indexOf(choice);
    return section[index + 1] ?? section[index - 1] ?? "entry";
  };

  const problemFor = (label: string, except?: string) =>
    nameProblem(
      label,
      listLengths.choice,
      list.choices.some(
        (other) => other.id !== except && sameName(other.label, label),
      ),
      duplicate,
    );

  const startEdit = (choice: Choice, field: Field = "label") => {
    if (removed(choice)) return;
    setSelected(choice.id);
    setEditing(choice.id);
    setDraft({
      label: choice.label,
      description: choice.description,
      meaning: choice.meaning ?? null,
      weight: typedWeight(choice.weight),
    });
    setEditProblem(undefined);
    setEditWeightProblem(undefined);
    setMenuFor(undefined);
    // A meaning that cannot change takes no focus, so its name is edited instead.
    const editable = field === "meaning" && kept(choice) ? "label" : field;
    focusSoon(`choice-edit-${editable === "label" ? "name" : editable}`);
  };

  // Saves the choice being edited, leaving it open with its problem when its name will not do.
  const saveEdit = (choice: Choice) => {
    const problem = problemFor(draft.label, choice.id);
    if (problem !== undefined) {
      setEditProblem(problem);
      focusSoon(editNameId);
      return;
    }
    const weightWrong = weighed ? weightProblem(draft.weight) : undefined;
    if (weightWrong !== undefined) {
      setEditWeightProblem(weightWrong);
      focusSoon(editWeightId);
      return;
    }
    setEditing(undefined);
    const weight = typedNumber(draft.weight);
    const request = {
      label: draft.label.trim(),
      description: draft.description.trim(),
      ...(draft.meaning === null ? {} : { meaning: draft.meaning }),
      ...(weight === undefined ? {} : { weight }),
    };
    if (
      request.label !== choice.label ||
      request.description !== choice.description ||
      (draft.meaning ?? undefined) !== choice.meaning ||
      weight !== choice.weight
    ) {
      actions.edit(choice, request);
    }
    focusSoon(rowId(choice));
  };

  const cancelEdit = (choice: Choice) => {
    setEditing(undefined);
    focusSoon(rowId(choice));
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
    actions.add(
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
    const problem = problemFor(entry.label);
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
    if (choices.length > pasteLimit) {
      setEntryProblem(`Up to ${String(pasteLimit)} lines at once`);
      return;
    }
    const seen: string[] = [];
    for (const [index, choice] of choices.entries()) {
      const problem =
        problemFor(choice.label) ??
        (choice.description.length > listLengths.description
          ? "Description too long"
          : undefined) ??
        (seen.some((label) => sameName(label, choice.label))
          ? duplicate
          : undefined);
      if (problem !== undefined) {
        setEntryProblem(
          choices.length === 1
            ? problem
            : `Line ${String(index + 1)}: ${problem}`,
        );
        return;
      }
      seen.push(choice.label);
    }
    if (refusedWeight(true)) return;
    add(choices, entry);
  };

  // The last choice offered for a meaning, or in Positions, is kept offered.
  const kept = (choice: Choice) => lastKept(list, choice) !== undefined;

  const retireOrRestore = (choice: Choice) => {
    if (removed(choice) || kept(choice)) return;
    select(neighbourIn(choice.retired ? retired : offered, choice));
    actions.setRetired(choice, !choice.retired);
  };

  const remove = (choice: Choice) => {
    if (removed(choice) || kept(choice)) return;
    select(neighbourIn(choice.retired ? retired : offered, choice));
    actions.remove(choice);
  };

  const moveTo = (choice: Choice, after: string | null) => {
    actions.move(choice, after);
    focusSoon(rowId(choice));
  };

  const moveBy = (choice: Choice, step: -1 | 1) => {
    if (!canMove || removed(choice) || choice.heldBy !== undefined) return;
    const index = offered.indexOf(choice);
    const to = index + step;
    if (choice.retired || to < 0 || to >= offered.length) return;
    moveTo(choice, followingAfterMove(offered, index, to));
  };

  const onRowKey = (event: KeyboardEvent, choice: Choice) => {
    if (event.target !== event.currentTarget) return;
    const index = order.indexOf(choice);
    const plain = !event.altKey && !event.metaKey && !event.ctrlKey;
    const handled = () => {
      event.preventDefault();
    };
    if (event.altKey && event.key === "ArrowUp") {
      handled();
      moveBy(choice, -1);
    } else if (event.altKey && event.key === "ArrowDown") {
      handled();
      moveBy(choice, 1);
    } else if (plain && event.key === "ArrowUp") {
      handled();
      select(order[index - 1]);
    } else if (plain && event.key === "ArrowDown") {
      handled();
      select(order[index + 1]);
    } else if (plain && event.key === "Home") {
      handled();
      select(order[0]);
    } else if (plain && event.key === "End") {
      handled();
      select(order.at(-1));
    } else if (plain && event.key === "Enter") {
      handled();
      startEdit(choice);
    } else if (plain && event.key.toLowerCase() === "r") {
      handled();
      retireOrRestore(choice);
    } else if (plain && (event.key === "Delete" || event.key === "Backspace")) {
      handled();
      remove(choice);
    } else if (
      event.key === "ContextMenu" ||
      (event.key === "F10" && event.shiftKey)
    ) {
      handled();
      setMenuFor(choice.id);
    }
  };

  // The field Tab leaves a row from, forwards: the weight, in feature sizes, or the meaning, in a
  // list with meanings, unless it cannot change and so takes no focus.
  const lastField = (choice: Choice): Field => {
    if (weighed) return "weight";
    return meanings.length > 0 && !kept(choice) ? "meaning" : "description";
  };

  const onEditKey = (event: KeyboardEvent, field: Field, choice: Choice) => {
    const leaving =
      event.key === "Tab" &&
      (field === lastField(choice)
        ? !event.shiftKey
        : event.shiftKey && field === "label");
    if (event.key === "Escape") {
      event.preventDefault();
      cancelEdit(choice);
    } else if ((event.key === "Enter" && !event.shiftKey) || leaving) {
      event.preventDefault();
      saveEdit(choice);
    }
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
      select(offered.at(-1));
    } else if (
      field === "label" &&
      event.key === "ArrowDown" &&
      !event.altKey
    ) {
      event.preventDefault();
      select(shownRetired[0]);
    }
  };

  // Leaving a row being edited, by clicking or tabbing elsewhere, saves it.
  const onEditBlur = (event: FocusEvent, choice: Choice) => {
    if (event.currentTarget.contains(event.relatedTarget)) return;
    saveEdit(choice);
  };

  const drop = (result: DropResult) => {
    const moved = droppedMove(offered, result);
    if (moved === undefined) return;
    moveTo(moved.choice, moved.after);
  };

  // One choice at a time can be reached with Tab: the selected one, or else the first.
  const tabStop =
    list.choices.find((choice) => choice.id === selected)?.id ?? first?.id;
  const cellRole = canEdit ? "gridcell" : "cell";

  const menu = (choice: Choice, index: number) => {
    const choiceDraft = choice.draft;
    // A choice added to a list whose addition was rejected waits for the list to be resubmitted.
    const choiceWaits = waits({ ...noDrafts(), choices: [choice.id] });
    const on = { kind: "choice" as const, list, choice };
    // A choice a draft removes offers only what can be done with the draft.
    const editable = canEdit && !removed(choice) && choice.heldBy === undefined;
    const keptFor = lastKept(list, choice);
    // Each item closes the menu and moves focus itself, so focus never stays on the menu's button.
    const act = (run: () => void) => () => {
      setMenuFor(undefined);
      run();
    };
    return (
      <Menu
        opened={menuFor === choice.id}
        onChange={(opened) => {
          setMenuFor(opened ? choice.id : undefined);
          if (!opened) focusSoon(rowId(choice));
        }}
        returnFocus={false}
        closeOnItemClick={false}
        position="bottom-end"
        hideDetached={false}
        width={220}
      >
        <Menu.Target>
          <MoreButton
            id={actionsId(choice)}
            tabIndex={choice.id === tabStop ? 0 : -1}
            label={actionsFor(choice.label)}
          />
        </Menu.Target>
        <Menu.Dropdown
          onClick={closesOnBlankClick(() => {
            setMenuFor(undefined);
            focusSoon(rowId(choice));
          })}
        >
          {/* Names whose menu it is, and gives every menu somewhere to click that closes it. */}
          <MenuTitle>{choice.label}</MenuTitle>
          {choice.heldBy !== undefined && <HeldNote by={choice.heldBy} />}
          {choiceDraft?.unpublished === true && <UnpublishedNote />}
          {choiceDraft && (
            <MenuDraftLines
              draft={withRetiring({ ...choice, draft: choiceDraft })}
              lines={draftLines(
                choiceDraft,
                configDraftFields(choiceDraft, choice),
              )}
              // Set apart from the items after it, when any are offered.
              divider={
                (mayEdit && choice.heldBy === undefined) ||
                (canApprove && decidable(choice))
              }
            />
          )}
          {editable && (
            <>
              <Menu.Item
                rightSection={<kbd>{shortcuts.edit}</kbd>}
                onClick={act(() => {
                  startEdit(choice);
                })}
              >
                Edit
              </Menu.Item>
              {!choice.retired && canMove && (
                <>
                  <Menu.Divider />
                  <Menu.Item
                    disabled={index === 0}
                    onClick={act(() => {
                      moveTo(choice, null);
                    })}
                  >
                    Move to top
                  </Menu.Item>
                  <Menu.Item
                    disabled={index === 0}
                    rightSection={<kbd>{shortcuts.up}</kbd>}
                    onClick={act(() => {
                      moveBy(choice, -1);
                    })}
                  >
                    Move up
                  </Menu.Item>
                  <Menu.Item
                    disabled={index === offered.length - 1}
                    rightSection={<kbd>{shortcuts.down}</kbd>}
                    onClick={act(() => {
                      moveBy(choice, 1);
                    })}
                  >
                    Move down
                  </Menu.Item>
                  <Menu.Item
                    disabled={index === offered.length - 1}
                    onClick={act(() => {
                      moveTo(
                        choice,
                        followingAfterMove(offered, index, offered.length - 1),
                      );
                    })}
                  >
                    Move to bottom
                  </Menu.Item>
                </>
              )}
              <Menu.Divider />
              <Menu.Item
                disabled={keptFor !== undefined}
                rightSection={<kbd>{shortcuts.retire}</kbd>}
                onClick={act(() => {
                  retireOrRestore(choice);
                })}
              >
                {choice.retired ? "Restore" : "Retire"}
              </Menu.Item>
              <Menu.Item
                color="red"
                disabled={keptFor !== undefined}
                rightSection={<kbd>{shortcuts.remove}</kbd>}
                onClick={act(() => {
                  remove(choice);
                })}
              >
                Remove
              </Menu.Item>
              {keptFor !== undefined && (
                <Text fz="xs" c="dimmed" px="sm" py={4}>
                  {keptFor === "any"
                    ? `${list.name} needs a choice`
                    : `Needed for ${meaningName(keptFor)}`}
                </Text>
              )}
            </>
          )}
          {choiceDraft && (
            <>
              {editable && <Menu.Divider />}
              {editable && choiceDraft.state === "rejected" && (
                <Menu.Item
                  onClick={act(() => {
                    draftActions.resubmit(on);
                  })}
                >
                  Resubmit
                </Menu.Item>
              )}
              {mayEdit && choice.heldBy === undefined && (
                <Menu.Item
                  onClick={act(() => {
                    draftActions.discard(on);
                  })}
                >
                  Discard draft
                </Menu.Item>
              )}
              {canApprove && decidable(choice) && (
                <>
                  <Menu.Item
                    disabled={
                      choiceWaits || choice.draft?.needsOtherApprover === true
                    }
                    onClick={act(() => {
                      draftActions.decide("approve", on);
                    })}
                  >
                    Approve…
                  </Menu.Item>
                  {choiceWaits && <WaitingNote />}
                  {!choiceWaits &&
                    choice.draft?.needsOtherApprover === true && (
                      <OtherApproverNote />
                    )}
                  <Menu.Item
                    onClick={act(() => {
                      draftActions.decide("reject", on);
                    })}
                  >
                    Reject…
                  </Menu.Item>
                </>
              )}
            </>
          )}
        </Menu.Dropdown>
      </Menu>
    );
  };

  const row = (choice: Choice, index: number) => {
    const originalChoice = originalOf(originalChoices, choice);
    const isEditing = editing === choice.id;
    const isSelected = selected === choice.id;
    const draggable =
      canMove &&
      choice.heldBy === undefined &&
      !narrow &&
      !choice.retired &&
      !isEditing &&
      !removed(choice);
    const content = (handle?: object | null) => (
      <>
        {draggable && (
          <span {...handle} className={classes.grip} tabIndex={-1} aria-hidden>
            <Icon name="grip" size={14} />
          </span>
        )}
        {isEditing ? (
          <Fields
            idPrefix="choice-edit"
            draft={draft}
            problem={editProblem}
            label=""
            meanings={meanings}
            meaningKept={meaningKeptBy(list, choice)}
            weighed={weighed}
            weightProblem={editWeightProblem}
            onChange={(next) => {
              setDraft(next);
              setEditProblem(undefined);
              setEditWeightProblem(undefined);
            }}
            onKeyDown={(event, field) => {
              onEditKey(event, field, choice);
            }}
          />
        ) : (
          <>
            <span
              className={classes.choiceName}
              role={cellRole}
              data-field="label"
            >
              <DraftedItem
                // The choice's own draft where it changes what the row doesn't show; otherwise a
                // new order moving it, marked as the order's draft, whose state and reason it is.
                draft={
                  originalChoice.draft !== undefined &&
                  recordMark(originalChoice.draft, choiceRowFields) !==
                    undefined
                    ? withRetiring({
                        ...originalChoice,
                        draft: originalChoice.draft,
                      })
                    : movedInDraft.has(choice.id) && original.orderDraft
                      ? { ...original.orderDraft, moved: true }
                      : undefined
                }
                heldBy={choice.heldBy}
                slot
              >
                <DraftedValue
                  draft={originalChoice.draft}
                  fields={["label"]}
                  named="Name"
                >
                  {choice.label}
                </DraftedValue>
              </DraftedItem>
              {moved.has(choice.id) && (
                <VisuallyHidden>
                  , live place {ordinal(moved.get(choice.id) as number)}
                </VisuallyHidden>
              )}
            </span>
            <span
              className={classes.choiceDescription}
              role={cellRole}
              data-field="description"
            >
              <DraftedValue
                draft={originalChoice.draft}
                fields={["description"]}
                named="Description"
                emptied={choice.description === "" ? "Description" : undefined}
              >
                {choice.description}
              </DraftedValue>
            </span>
            {meanings.length > 0 && (
              <span
                className={classes.choiceMeaning}
                role={cellRole}
                data-field="meaning"
              >
                {meaningText(choice.meaning)}
              </span>
            )}
            {weighed && (
              <span
                className={classes.choiceWeight}
                role={cellRole}
                data-field="weight"
              >
                {weightText(choice.weight)}
              </span>
            )}
          </>
        )}
        {(canEdit ||
          (choice.draft !== undefined && (canApprove || mayEdit))) && (
          <span role={cellRole}>{menu(choice, index)}</span>
        )}
      </>
    );
    const rowProps = {
      id: rowId(choice),
      role: "row",
      "aria-selected": canEdit ? isSelected : undefined,
      className: [
        ...shape,
        choice.retired ? classes.choiceRetired : "",
        isSelected || isEditing ? classes.selectedRow : "",
        draftRowClass(
          choice.draft ??
            (moved.has(choice.id) ? { action: "changed" } : undefined),
          showLive,
        ),
      ].join(" "),
      ...(canEdit
        ? {
            tabIndex: choice.id === tabStop ? 0 : -1,
            onKeyDown: (event: KeyboardEvent) => {
              onRowKey(event, choice);
            },
            onFocus: () => {
              setSelected(choice.id);
            },
            onClick: (event: { target: EventTarget }) => {
              if (isEditing) return;
              const target = event.target as HTMLElement;
              if (target.closest("button")) return;
              const field = target
                .closest("[data-field]")
                ?.getAttribute("data-field");
              startEdit(
                choice,
                field === "description" ||
                  field === "meaning" ||
                  field === "weight"
                  ? field
                  : "label",
              );
            },
            onBlur: (event: FocusEvent) => {
              if (isEditing) onEditBlur(event, choice);
            },
          }
        : {}),
    };
    if (choice.retired) {
      return (
        <div key={choice.id} {...rowProps}>
          {content()}
        </div>
      );
    }
    return (
      <Draggable
        key={choice.id}
        draggableId={choice.id}
        index={index}
        isDragDisabled={!draggable}
      >
        {(provided, snapshot) => (
          <div
            {...rowProps}
            ref={provided.innerRef}
            {...provided.draggableProps}
            className={liftedWhileDragging(
              rowProps.className,
              snapshot.isDragging,
            )}
          >
            {content(provided.dragHandleProps)}
          </div>
        )}
      </Draggable>
    );
  };

  // A moved choice's live place, shown as the People table shows a person's live row: dimmed,
  // marked Live, read only, and skipped by the keyboard, just after the choice it followed in the
  // live order, or at the top. Assistive technology hears the live place with the moved choice
  // instead.
  const liveOffered = (list.orderDraft?.live ?? []).filter((id) =>
    offered.some((choice) => choice.id === id),
  );
  const liveRow = (choice: Choice, key: string) => {
    const liveMeaning = choice.draft?.live.meaning ?? choice.meaning;
    const liveWeight = choice.draft?.live.weight ?? choice.weight;
    return (
      <div
        key={key}
        className={[...shape, classes.choiceLive].join(" ")}
        aria-hidden="true"
      >
        <span className={classes.choiceName}>
          <LiveRowMarks
            marked={
              moved.has(choice.id) ||
              recordMark(choice.draft, choiceRowFields) !== undefined
            }
          >
            <LiveValue draft={choice.draft} fields={["label"]}>
              {choice.draft?.live.label ?? choice.label}
            </LiveValue>
          </LiveRowMarks>
        </span>
        <span className={classes.choiceDescription}>
          <LiveValue
            draft={choice.draft}
            fields={["description"]}
            emptied={
              (choice.draft?.live.description ?? choice.description) === ""
                ? "Description"
                : undefined
            }
          >
            {choice.draft?.live.description ?? choice.description}
          </LiveValue>
        </span>
        {meanings.length > 0 && (
          <span className={classes.choiceMeaning}>
            {meaningText(liveMeaning)}
          </span>
        )}
        {weighed && (
          <span className={classes.choiceWeight}>{weightText(liveWeight)}</span>
        )}
      </div>
    );
  };
  const liveRowsAfter = (previous: string | null) =>
    (showLive ? offered : [])
      .filter(
        ({ id }) =>
          moved.has(id) &&
          (liveOffered[liveOffered.indexOf(id) - 1] ?? null) === previous,
      )
      .map((choice) => liveRow(choice, `live-place-${choice.id}`));
  // A choice whose draft changes it shows its live row just under it, as a person's does.
  const liveUnder = (choice: Choice) =>
    showLive && choice.draft?.action === "changed" && !moved.has(choice.id)
      ? liveRow(choice, `live-${choice.id}`)
      : null;

  const gridRole = canEdit ? "grid" : "table";

  return (
    <FocusTrap active={narrow}>
      <section
        className={narrow ? classes.panelNarrow : classes.panel}
        aria-labelledby={titleId}
        // Covering the page on a narrow screen, it holds focus until it is closed.
        {...(narrow ? { role: "dialog", "aria-modal": true } : {})}
        onKeyDown={(event) => {
          // Esc closes an open menu, then the panel, from anywhere in it, unless something inside,
          // such as a choice being edited, has used it already.
          if (event.key !== "Escape" || event.defaultPrevented) return;
          if (menuFor === undefined) {
            onClose();
            return;
          }
          setMenuFor(undefined);
          focusSoon(rowId({ id: menuFor }));
        }}
      >
        <div className={classes.panelHead}>
          <div className={classes.panelTitle}>
            <div className={classes.panelNameBlock}>
              {/* The list's own mark, unless its draft only changes its name or description, each
                  marked before it; a new order is marked on each choice it moves. */}
              <DraftedItem
                draft={
                  recordMark(original.draft, listFields) === undefined
                    ? undefined
                    : withRetiring({
                        ...original,
                        draft: original.draft as NonNullable<List["draft"]>,
                      })
                }
                heldBy={list.heldBy ?? list.orderHeldBy}
                facts={<ListFacts list={list} />}
              >
                <DraftedValue
                  draft={original.draft}
                  fields={["name"]}
                  named="Name"
                >
                  <h2
                    id={titleId}
                    className={[
                      classes.panelName,
                      listRemoved ? classes.struck : "",
                    ].join(" ")}
                    tabIndex={-1}
                  >
                    {list.name}
                  </h2>
                </DraftedValue>
              </DraftedItem>
            </div>
            {canEdit && (
              <Button variant="default" size="compact-sm" onClick={onEditList}>
                Edit list
              </Button>
            )}
            {onMoveClass &&
              list.draft?.action !== "created" &&
              list.draft?.action !== "deleted" && (
                <Stack gap={2} align="flex-end">
                  <Button
                    variant="default"
                    size="compact-sm"
                    disabled={list.heldBy !== undefined}
                    aria-describedby={
                      list.heldBy === undefined ? undefined : classHeldId
                    }
                    onClick={onMoveClass}
                  >
                    Change class…
                  </Button>
                  {list.heldBy !== undefined && (
                    <Text id={classHeldId} fz="xs" c="dimmed" ta="right">
                      {list.heldBy} is changing this list
                    </Text>
                  )}
                </Stack>
              )}
            {(list.draft ?? list.orderDraft) && (
              <ListDraftMenu
                list={list}
                orderWaits={waits({ ...noDrafts(), orders: [list.id] })}
                canEdit={mayEdit}
                canApprove={canApprove}
                actions={draftActions}
              />
            )}
            <ActionIcon
              variant="subtle"
              color="gray"
              aria-label="Close"
              onClick={onClose}
            >
              <Icon name="close" />
            </ActionIcon>
          </div>
          {(list.description !== "" ||
            changedValue(original.draft, "description") !== undefined) && (
            <Text fz="sm" c="dimmed" mt={4} component="div">
              <MarkRow>
                <DraftedValue
                  draft={original.draft}
                  fields={["description"]}
                  named="Description"
                  emptied={list.description === "" ? "Description" : undefined}
                >
                  {list.description}
                </DraftedValue>
              </MarkRow>
              {showLive &&
                changedValue(list.draft, "description") !== undefined && (
                  <LiveLine>
                    {liveDescription === ""
                      ? emptiedWords("Description")
                      : liveDescription}
                  </LiveLine>
                )}
            </Text>
          )}
        </div>
        <div className={classes.panelBody}>
          {offered.length === 0 && !canEdit && (
            <Text fz="sm" c="dimmed" p="md">
              None
            </Text>
          )}
          <div role={gridRole} aria-label="Choices">
            <DragDropContext onDragEnd={drop}>
              <Droppable droppableId="choices">
                {(provided) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    role="rowgroup"
                  >
                    {offered.map((choice, index) => (
                      <Fragment key={choice.id}>
                        {index === 0 && liveRowsAfter(null)}
                        {row(choice, index)}
                        {liveUnder(choice)}
                        {liveRowsAfter(choice.id)}
                      </Fragment>
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </DragDropContext>
            {canEdit && (
              <div
                role="row"
                className={[...shape, classes.entry].join(" ")}
                // Leaving the empty row, by clicking or tabbing elsewhere, adds what was typed, as
                // leaving a choice being edited saves it.
                onBlur={(event) => {
                  if (event.currentTarget.contains(event.relatedTarget)) return;
                  addEntry(false);
                }}
              >
                <span className={classes.plus} aria-hidden>
                  <Icon name="plus" size={14} />
                </span>
                <Fields
                  idPrefix="choice-entry"
                  draft={entry}
                  problem={entryProblem}
                  label="New choice "
                  meanings={meanings}
                  weighed={weighed}
                  weightProblem={entryWeightProblem}
                  onChange={(next) => {
                    setEntry(next);
                    setEntryProblem(undefined);
                    setEntryWeightProblem(undefined);
                  }}
                  onKeyDown={onEntryKey}
                  onFocus={() => {
                    setSelected(undefined);
                  }}
                  onPaste={paste}
                />
              </div>
            )}
          </div>
          {list.builtIn && (
            <Text fz="xs" c="dimmed" className={classes.builtInNote}>
              {builtInNote(list.builtIn, mayEdit)}
            </Text>
          )}
          {shownRetired.length > 0 && (
            <>
              <Text
                id="list-panel-retired"
                className={classes.retiredLabel}
                fz="xs"
                fw={600}
              >
                Retired
              </Text>
              <div role={gridRole} aria-labelledby="list-panel-retired">
                {shownRetired.map((choice, index) => (
                  <Fragment key={choice.id}>
                    {row(choice, index)}
                    {liveUnder(choice)}
                  </Fragment>
                ))}
              </div>
            </>
          )}
        </div>
        {retired.length > 0 && (
          <div className={classes.panelFoot}>
            <Button
              variant={showRetired ? "light" : "default"}
              color="gray"
              size="compact-sm"
              aria-pressed={showRetired}
              onClick={() => {
                setShowRetired(!showRetired);
              }}
            >
              {showRetired
                ? "Hide retired"
                : `Show retired (${count(retired.length)})`}
            </Button>
          </div>
        )}
      </section>
    </FocusTrap>
  );
}
