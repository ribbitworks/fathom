// SPDX-License-Identifier: Apache-2.0

// The side panel for one list: its name, description and choices in order, changed from the
// keyboard, by dragging and from each choice's menu.

import { actionsFor, MoreButton, opensMenu } from "./row-controls.tsx";
import { RecordKey } from "./record-key.tsx";
import {
  DragDropContext,
  Draggable,
  Droppable,
  type DropResult,
} from "@hello-pangea/dnd";
import {
  type Choice,
  type ChoiceRequest,
  type List,
  listLengths,
  typedNumber,
  weighs,
  weightProblem,
  type Meaning,
  meaningName,
  meaningsOf,
} from "@fathom/shared";
import {
  Button,
  Group,
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
import { nameProblem } from "./list-dialog.tsx";
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
import { SidePanelFrame, sidePanelScroll } from "./side-panel.tsx";
import { decidable, type DraftSelection, noDrafts } from "./drafts.ts";
import {
  DraftedItem,
  DraftedValue,
  LiveLine,
  LiveRowMarks,
  LiveValue,
  MarkRow,
} from "./status-mark.tsx";
import { changedValue, recordMark, emptiedWords } from "./draft-marks.ts";
import { liveLists, retiredLive, sameName, withRetiring } from "./lists.ts";
import { closesOnBlankClick } from "./app-menu.tsx";
import classes from "./pages.module.css";
import { count, decimal } from "./numbers.ts";
import { type Draft, type Field, Fields } from "./choice-fields.tsx";
import {
  droppedMove,
  followingAfterMove,
  liftedWhileDragging,
} from "./choice-drag.ts";
import {
  lastKept,
  meaningKeptBy,
  pastedChoices,
  removedChoice,
} from "./choice-rules.ts";
import { builtInNote, ListFacts } from "./list-facts.tsx";

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
const listFrameId = "list-panel-frame";
export const rowId = (choice: { id: string }) => `choice-${choice.id}`;
const actionsId = (choice: { id: string }) => `choice-actions-${choice.id}`;
const duplicate = "Already in this list";
// The most choices one paste adds, as the server allows at once.
const pasteLimit = 1000;

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
              {!isRetired(choice) && canMove && (
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
      !isRetired(choice) &&
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
    // Only rows inside the DragDropContext may be Draggables; beside live, a choice drafted to be
    // restored is still shown among the retired.
    if (isRetired(choice)) {
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

  // Prevented, so the frame's Esc leaves the panel open while it closes the menu.
  const closeMenuOnEscape = (event: KeyboardEvent) => {
    if (
      event.key !== "Escape" ||
      event.defaultPrevented ||
      menuFor === undefined
    ) {
      return;
    }
    event.preventDefault();
    setMenuFor(undefined);
    focusSoon(rowId({ id: menuFor }));
  };

  return (
    <SidePanelFrame
      id={listFrameId}
      titleId={titleId}
      narrow={narrow}
      close={{ label: "Close", onClose }}
      title={
        <span className={listRemoved ? classes.struck : undefined}>
          {list.name}
        </span>
      }
      marked={(heading) => (
        // The list's own mark, unless its draft only changes its name or description, each marked
        // before it; a new order is marked on each choice it moves.
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
            dataClass={list.visibility}
          >
            {heading}
          </DraftedValue>
        </DraftedItem>
      )}
      actions={
        <>
          {canEdit && (
            <Button variant="default" size="compact-sm" onClick={onEditList}>
              Edit list
            </Button>
          )}
          {onMoveClass &&
            (mayEdit || list.draft?.action !== "created") &&
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
        </>
      }
      subtitle={
        <>
          <div>
            <RecordKey record={{ kind: "list", keyNumber: list.keyNumber }} />
          </div>
          {list.description !== "" ||
          changedValue(original.draft, "description") !== undefined ? (
            <>
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
            </>
          ) : undefined}
        </>
      }
      foot={
        retired.length > 0 ? (
          <Group justify="flex-end">
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
          </Group>
        ) : undefined
      }
    >
      <div className={sidePanelScroll} onKeyDown={closeMenuOnEscape}>
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
    </SidePanelFrame>
  );
}
