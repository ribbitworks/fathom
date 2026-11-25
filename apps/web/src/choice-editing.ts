// SPDX-License-Identifier: Apache-2.0

// The state and keys of a list panel's choice rows: which is selected or being edited, and how each
// is edited, moved, retired and removed.

import type { DropResult } from "@hello-pangea/dnd";
import {
  type Choice,
  type List,
  type Meaning,
  typedNumber,
  weightProblem,
} from "@fathom/shared";
import { type FocusEvent, type KeyboardEvent, useState } from "react";
import { editNameId, editWeightId, entryNameId, rowId } from "./choice-ids.ts";
import { type Draft, emptyDraft, type Field } from "./choice-fields.tsx";
import { droppedMove, followingAfterMove } from "./choice-drag.ts";
import type { ChoiceMenuActions } from "./choice-menu.tsx";
import {
  choiceNameProblem,
  lastKept,
  removedChoice as removed,
} from "./choice-rules.ts";
import { focusSoon } from "./focus.ts";
import type { ChoiceActions } from "./list-panel.tsx";
import { opensMenu } from "./row-controls.tsx";
import { composingWord } from "./composing.ts";

const typedWeight = (weight: number | undefined) =>
  weight === undefined ? "" : String(weight);

// A plain key on a row of choices, on the row itself: the arrows, Home and End select another, and
// Delete or Backspace takes it out, in a list's panel and among a new list's choices alike. Whether
// the key was one of them.
export function onRowsKey<Row, Item extends Row>(
  event: KeyboardEvent,
  rows: readonly Row[],
  row: Item,
  {
    select,
    remove,
  }: { select: (row: Row | undefined) => void; remove: (row: Item) => void },
): boolean {
  if (event.target !== event.currentTarget) return false;
  if (event.altKey || event.metaKey || event.ctrlKey) return false;
  const index = rows.indexOf(row);
  switch (event.key) {
    case "ArrowUp":
      event.preventDefault();
      select(rows[index - 1]);
      return true;
    case "ArrowDown":
      event.preventDefault();
      select(rows[index + 1]);
      return true;
    case "Home":
      event.preventDefault();
      select(rows[0]);
      return true;
    case "End":
      event.preventDefault();
      select(rows.at(-1));
      return true;
    case "Delete":
    case "Backspace":
      event.preventDefault();
      remove(row);
      return true;
    default:
      return false;
  }
}

export function useChoiceEditing({
  list,
  canMove,
  meanings,
  weighed,
  offered,
  first,
  retired,
  order,
  isRetired,
  actions,
  setMenuFor,
}: {
  list: List;
  canMove: boolean;
  meanings: readonly Meaning[];
  weighed: boolean;
  offered: Choice[];
  first: Choice | undefined;
  retired: Choice[];
  // The rows arrow keys move through, in order, with the empty row between offered and retired.
  order: (Choice | "entry")[];
  isRetired: (choice: Choice) => boolean;
  actions: Omit<ChoiceActions, "add">;
  // Opens a choice's menu, or closes the one open.
  setMenuFor: (choiceId: string | undefined) => void;
}) {
  const [selected, setSelected] = useState<string>();
  const [editing, setEditing] = useState<string>();
  const [draft, setDraft] = useState<Draft>(emptyDraft(meanings));
  const [editProblem, setEditProblem] = useState<string>();
  const [editWeightProblem, setEditWeightProblem] = useState<string>();

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

  // The last choice offered for a meaning, or in Positions, is kept offered.
  const kept = (choice: Choice) => lastKept(list, choice) !== undefined;

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

  const changeDraft = (next: Draft) => {
    setDraft(next);
    setEditProblem(undefined);
    setEditWeightProblem(undefined);
  };

  // Saves the choice being edited, leaving it open with its problem when its name will not do.
  const saveEdit = (choice: Choice) => {
    const problem = choiceNameProblem(list, draft.label, choice.id);
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

  const retireOrRestore = (choice: Choice) => {
    if (removed(choice) || kept(choice)) return;
    select(neighbourIn(isRetired(choice) ? retired : offered, choice));
    actions.setRetired(choice, !choice.retired);
  };

  const remove = (choice: Choice) => {
    if (removed(choice) || kept(choice)) return;
    select(neighbourIn(isRetired(choice) ? retired : offered, choice));
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
    if (isRetired(choice) || to < 0 || to >= offered.length) return;
    moveTo(choice, followingAfterMove(offered, index, to));
  };

  const menuActionsFor = (
    choice: Choice,
    index: number,
  ): ChoiceMenuActions => ({
    edit: () => {
      startEdit(choice);
    },
    moveToTop: () => {
      moveTo(choice, null);
    },
    moveUp: () => {
      moveBy(choice, -1);
    },
    moveDown: () => {
      moveBy(choice, 1);
    },
    moveToBottom: () => {
      moveTo(choice, followingAfterMove(offered, index, offered.length - 1));
    },
    retireOrRestore: () => {
      retireOrRestore(choice);
    },
    remove: () => {
      remove(choice);
    },
  });

  const onRowKey = (event: KeyboardEvent, choice: Choice) => {
    if (event.target !== event.currentTarget) return;
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
    } else if (onRowsKey(event, order, choice, { select, remove })) {
      return;
    } else if (plain && event.key === "Enter") {
      handled();
      startEdit(choice);
    } else if (plain && event.key.toLowerCase() === "r") {
      handled();
      retireOrRestore(choice);
    } else if (opensMenu(event)) {
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
    } else if (
      (event.key === "Enter" && !event.shiftKey && !composingWord(event)) ||
      leaving
    ) {
      event.preventDefault();
      saveEdit(choice);
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

  return {
    selected,
    editing,
    draft,
    editProblem,
    editWeightProblem,
    tabStop,
    select,
    setSelected,
    startEdit,
    changeDraft,
    menuActionsFor,
    onRowKey,
    onEditKey,
    onEditBlur,
    drop,
  };
}
