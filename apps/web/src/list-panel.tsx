// SPDX-License-Identifier: Apache-2.0

// The side panel for one list: its name, description, and choices in order. Opening it puts focus in
// it. Users who may edit lists work from the keyboard. An empty row at the end takes new choices: Tab
// moves to the description and Enter adds the choice and starts the next, and pasting several lines
// adds one choice for each. Arrow keys select a choice, Enter edits it in place, Alt+arrows move it,
// R retires or restores it, and Delete removes it, each also in the choice's menu. Choices can also
// be dragged by their grip. Esc closes an open menu, then the panel. Viewers see the same choices,
// read only.

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
} from "@fathom/shared";
import { ActionIcon, Button, Menu, Text } from "@mantine/core";
import {
  type ClipboardEvent,
  type FocusEvent,
  type KeyboardEvent,
  useEffect,
  useState,
} from "react";
import { focusSoon } from "./focus.ts";
import { Icon } from "./icons.tsx";
import { Count, nameProblem } from "./list-dialog.tsx";
import { sameName } from "./lists.ts";
import classes from "./pages.module.css";

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
    retire: "R",
    remove: mac ? "⌫" : "Del",
  };
}

const shortcuts = shortcutsFor(navigator.userAgent);

export const entryNameId = "choice-entry-name";
const editNameId = "choice-edit-name";
const titleId = "list-panel-title";
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
  const moved = items.slice(from, from + 1);
  const others = [...items.slice(0, from), ...items.slice(from + 1)];
  const ordered = [...others.slice(0, to), ...moved, ...others.slice(to)];
  return ordered.slice(0, to).at(-1)?.id ?? null;
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
}

const empty: Draft = { label: "", description: "" };

type Field = "label" | "description";

function Fields({
  idPrefix,
  draft,
  problem,
  label,
  onChange,
  onKeyDown,
  onFocus,
  onPaste,
}: {
  idPrefix: "choice-entry" | "choice-edit";
  draft: Draft;
  problem: string | undefined;
  label: string;
  onChange: (draft: Draft) => void;
  onKeyDown: (event: KeyboardEvent, field: Field) => void;
  onFocus?: () => void;
  onPaste?: (event: ClipboardEvent<HTMLInputElement>) => void;
}) {
  const entry = idPrefix === "choice-entry";
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
        {(problem ?? draft.label.length >= listLengths.choice - 5) && (
          <span className={classes.cellBelow}>
            {problem && (
              <span
                className={classes.problem}
                id={`${idPrefix}-problem`}
                role="alert"
              >
                {problem}
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
    </>
  );
}

export function ListPanel({
  list,
  canEdit,
  narrow,
  actions,
  onClose,
  onEditList,
}: {
  list: List;
  canEdit: boolean;
  narrow: boolean;
  actions: ChoiceActions;
  onClose: () => void;
  onEditList: () => void;
}) {
  const offered = list.choices.filter((choice) => !choice.retired);
  const retired = list.choices.filter((choice) => choice.retired);
  const [showRetired, setShowRetired] = useState(false);
  const [selected, setSelected] = useState<string>();
  const [editing, setEditing] = useState<string>();
  const [draft, setDraft] = useState<Draft>(empty);
  const [editProblem, setEditProblem] = useState<string>();
  const [entry, setEntry] = useState<Draft>(empty);
  const [entryProblem, setEntryProblem] = useState<string>();
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
    setSelected(choice.id);
    setEditing(choice.id);
    setDraft({ label: choice.label, description: choice.description });
    setEditProblem(undefined);
    setMenuFor(undefined);
    focusSoon(field === "label" ? editNameId : "choice-edit-description");
  };

  // Saves the choice being edited, leaving it open with its problem when its name will not do.
  const saveEdit = (choice: Choice) => {
    const problem = problemFor(draft.label, choice.id);
    if (problem !== undefined) {
      setEditProblem(problem);
      focusSoon(editNameId);
      return;
    }
    setEditing(undefined);
    const request = {
      label: draft.label.trim(),
      description: draft.description.trim(),
    };
    if (
      request.label !== choice.label ||
      request.description !== choice.description
    ) {
      actions.edit(choice, request);
    }
    focusSoon(rowId(choice));
  };

  const cancelEdit = (choice: Choice) => {
    setEditing(undefined);
    focusSoon(rowId(choice));
  };

  // Adds what was typed or pasted, giving it back to the empty row if it cannot be saved.
  const add = (requests: ChoiceRequest[], typed: Draft) => {
    actions.add(requests, () => {
      setEntry(typed);
    });
    setEntry(empty);
    setEntryProblem(undefined);
    focusSoon(entryNameId);
  };

  const addEntry = () => {
    if (entry.label.trim() === "" && entry.description.trim() === "") return;
    const problem = problemFor(entry.label);
    if (problem !== undefined) {
      setEntryProblem(problem);
      focusSoon(entryNameId);
      return;
    }
    add(
      [{ label: entry.label.trim(), description: entry.description.trim() }],
      entry,
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
    add(choices, entry);
  };

  const retireOrRestore = (choice: Choice) => {
    select(neighbourIn(choice.retired ? retired : offered, choice));
    actions.setRetired(choice, !choice.retired);
  };

  const remove = (choice: Choice) => {
    select(neighbourIn(choice.retired ? retired : offered, choice));
    actions.remove(choice);
  };

  const moveTo = (choice: Choice, after: string | null) => {
    actions.move(choice, after);
    focusSoon(rowId(choice));
  };

  const moveBy = (choice: Choice, step: -1 | 1) => {
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

  const onEditKey = (event: KeyboardEvent, field: Field, choice: Choice) => {
    const leaving =
      event.key === "Tab" &&
      (field === "description" ? !event.shiftKey : event.shiftKey);
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
      if (entry.label === "" && entry.description === "") return;
      event.preventDefault();
      setEntry(empty);
      setEntryProblem(undefined);
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
        width={220}
      >
        <Menu.Target>
          <ActionIcon
            id={actionsId(choice)}
            variant="subtle"
            color="gray"
            className={classes.rowAction}
            tabIndex={choice.id === tabStop ? 0 : -1}
            aria-label={`Actions for ${choice.label}`}
          >
            <Icon name="more" />
          </ActionIcon>
        </Menu.Target>
        <Menu.Dropdown>
          <Menu.Item
            rightSection={<kbd>{shortcuts.edit}</kbd>}
            onClick={act(() => {
              startEdit(choice);
            })}
          >
            Edit
          </Menu.Item>
          {!choice.retired && (
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
            rightSection={<kbd>{shortcuts.retire}</kbd>}
            onClick={act(() => {
              retireOrRestore(choice);
            })}
          >
            {choice.retired ? "Restore" : "Retire"}
          </Menu.Item>
          <Menu.Item
            color="red"
            rightSection={<kbd>{shortcuts.remove}</kbd>}
            onClick={act(() => {
              remove(choice);
            })}
          >
            Remove
          </Menu.Item>
        </Menu.Dropdown>
      </Menu>
    );
  };

  const row = (choice: Choice, index: number) => {
    const isEditing = editing === choice.id;
    const isSelected = selected === choice.id;
    const draggable = canEdit && !narrow && !choice.retired && !isEditing;
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
            onChange={(next) => {
              setDraft(next);
              setEditProblem(undefined);
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
              {choice.label}
            </span>
            <span
              className={classes.choiceDescription}
              role={cellRole}
              data-field="description"
            >
              {choice.description}
            </span>
          </>
        )}
        {canEdit && <span role="gridcell">{menu(choice, index)}</span>}
      </>
    );
    const rowProps = {
      id: rowId(choice),
      role: "row",
      "aria-selected": canEdit ? isSelected : undefined,
      className: [
        classes.choice,
        choice.retired ? classes.choiceRetired : "",
        isSelected || isEditing ? classes.choiceSelected : "",
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
              startEdit(
                choice,
                target.closest("[data-field='description']")
                  ? "description"
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

  const gridRole = canEdit ? "grid" : "table";

  return (
    <section
      className={narrow ? classes.panelNarrow : classes.panel}
      aria-labelledby={titleId}
      onKeyDown={(event) => {
        // Esc closes an open menu, then the panel, from anywhere in it, unless something inside, such
        // as a choice being edited, has used it already.
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
          <h2 id={titleId} className={classes.panelName} tabIndex={-1}>
            {list.name}
          </h2>
          {canEdit && (
            <Button
              variant="subtle"
              color="gray"
              size="compact-sm"
              onClick={onEditList}
            >
              Edit list
            </Button>
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
        {list.description && (
          <Text fz="sm" c="dimmed" mt={4}>
            {list.description}
          </Text>
        )}
      </div>
      <div className={classes.panelBody}>
        {offered.length === 0 && !canEdit && (
          <Text fz="sm" c="dimmed" p="md">
            No choices yet
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
                  {offered.map(row)}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>
          {canEdit && (
            <div
              role="row"
              className={[classes.choice, classes.entry].join(" ")}
            >
              <span className={classes.plus} aria-hidden>
                <Icon name="plus" size={14} />
              </span>
              <Fields
                idPrefix="choice-entry"
                draft={entry}
                problem={entryProblem}
                label="New choice "
                onChange={(next) => {
                  setEntry(next);
                  setEntryProblem(undefined);
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
              {shownRetired.map(row)}
            </div>
          </>
        )}
      </div>
      {retired.length > 0 && (
        <div className={classes.panelFoot}>
          <Button
            variant="subtle"
            color="gray"
            size="compact-sm"
            aria-pressed={showRetired}
            onClick={() => {
              setShowRetired(!showRetired);
            }}
          >
            {showRetired
              ? "Hide retired"
              : `Show retired (${String(retired.length)})`}
          </Button>
        </div>
      )}
    </section>
  );
}
