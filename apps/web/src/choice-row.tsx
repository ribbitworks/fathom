// SPDX-License-Identifier: Apache-2.0

// A choice's row in a list's panel: its cells, marked where drafts change them, and how the row is
// selected, edited and dragged.

import { Draggable } from "@hello-pangea/dnd";
import {
  type Choice,
  type List,
  type Meaning,
  meaningName,
} from "@fathom/shared";
import { VisuallyHidden } from "@mantine/core";
import type { FocusEvent, KeyboardEvent, ReactNode } from "react";
import { listClasses } from "./page-styles.ts";
import { liftedWhileDragging } from "./choice-drag.ts";
import type { Field } from "./choice-fields.tsx";
import { rowId } from "./choice-ids.ts";
import { Icon } from "./icons.tsx";
import { draftRowClass, ordinal } from "./list-drafts.tsx";
import { withRetiring } from "./lists.ts";
import { decimal } from "./numbers.ts";
import { recordMark } from "./draft-marks.ts";
import { DraftedItem, DraftedValue } from "./status-mark.tsx";

// A choice's meaning in words, or nothing for one the server no longer knows, which it sends
// without one.
export const meaningText = (meaning: Meaning | undefined) =>
  meaning === undefined ? "" : meaningName(meaning);

export const weightText = (weight: number | undefined) =>
  weight === undefined ? "" : decimal(weight);

// What a choice's row shows of the choice, each marked by its own dot where a draft changes it.
export const choiceRowFields = new Set(["label", "description"]);

export const choiceShape = (meanings: readonly Meaning[], weighed: boolean) => [
  listClasses.choice,
  meanings.length > 0 ? listClasses.choiceWithMeaning : "",
  weighed ? listClasses.choiceWithWeight : "",
];

export function ChoiceCells({
  choice,
  original,
  movedBy,
  livePlace,
  meanings,
  weighed,
  cellRole,
}: {
  choice: Choice;
  // The choice with every draft, which the marks are worked out from.
  original: Choice;
  // The draft of the list's order that moves the choice, if one does.
  movedBy: List["orderDraft"];
  // The choice's place in the live order, when the order shown moves it.
  livePlace: number | undefined;
  meanings: readonly Meaning[];
  weighed: boolean;
  cellRole: "gridcell" | "cell";
}) {
  return (
    <>
      <span
        className={listClasses.choiceName}
        role={cellRole}
        data-field="label"
      >
        <DraftedItem
          // The choice's own draft where it changes what the row doesn't show; otherwise a
          // new order moving it, marked as the order's draft, whose state and reason it is.
          draft={
            original.draft !== undefined &&
            recordMark(original.draft, choiceRowFields) !== undefined
              ? withRetiring({ ...original, draft: original.draft })
              : movedBy
                ? { ...movedBy, moved: true }
                : undefined
          }
          heldBy={choice.heldBy}
          slot
        >
          <DraftedValue draft={original.draft} fields={["label"]} named="Name">
            {choice.label}
          </DraftedValue>
        </DraftedItem>
        {livePlace !== undefined && (
          <VisuallyHidden>, live place {ordinal(livePlace)}</VisuallyHidden>
        )}
      </span>
      <span
        className={listClasses.choiceDescription}
        role={cellRole}
        data-field="description"
      >
        <DraftedValue
          draft={original.draft}
          fields={["description"]}
          named="Description"
          emptied={choice.description === "" ? "Description" : undefined}
        >
          {choice.description}
        </DraftedValue>
      </span>
      {meanings.length > 0 && (
        <span
          className={listClasses.choiceMeaning}
          role={cellRole}
          data-field="meaning"
        >
          {meaningText(choice.meaning)}
        </span>
      )}
      {weighed && (
        <span
          className={listClasses.choiceWeight}
          role={cellRole}
          data-field="weight"
        >
          {weightText(choice.weight)}
        </span>
      )}
    </>
  );
}

export function ChoiceRow({
  choice,
  index,
  shape,
  canEdit,
  selected,
  editing,
  tabStop,
  draggable,
  amongRetired,
  moved,
  showLive,
  onKeyDown,
  onSelect,
  onStartEdit,
  onLeave,
  children,
}: {
  choice: Choice;
  index: number;
  shape: readonly (string | undefined)[];
  canEdit: boolean;
  selected: boolean;
  editing: boolean;
  tabStop: boolean;
  draggable: boolean;
  // Whether the choice shows among the retired, outside the choices that can be dragged.
  amongRetired: boolean;
  // Whether the order shown moves the choice from its live place.
  moved: boolean;
  showLive: boolean;
  onKeyDown: (event: KeyboardEvent) => void;
  onSelect: () => void;
  onStartEdit: (field: Field) => void;
  onLeave: (event: FocusEvent) => void;
  children: ReactNode;
}) {
  const content = (handle?: object | null) => (
    <>
      {draggable && (
        <span
          {...handle}
          className={listClasses.grip}
          tabIndex={-1}
          aria-hidden
        >
          <Icon name="grip" size={14} />
        </span>
      )}
      {children}
    </>
  );
  const rowProps = {
    id: rowId(choice),
    role: "row",
    "aria-selected": canEdit ? selected : undefined,
    className: [
      ...shape,
      choice.retired ? listClasses.choiceRetired : "",
      selected || editing ? listClasses.selectedRow : "",
      draftRowClass(
        choice.draft ?? (moved ? { action: "changed" } : undefined),
        showLive,
      ),
    ].join(" "),
    ...(canEdit
      ? {
          tabIndex: tabStop ? 0 : -1,
          onKeyDown,
          onFocus: onSelect,
          onClick: (event: { target: EventTarget }) => {
            if (editing) return;
            const { target } = event;
            if (!(target instanceof Element) || target.closest("button")) {
              return;
            }
            const field = target
              .closest("[data-field]")
              ?.getAttribute("data-field");
            onStartEdit(
              field === "description" ||
                field === "meaning" ||
                field === "weight"
                ? field
                : "label",
            );
          },
          onBlur: (event: FocusEvent) => {
            if (editing) onLeave(event);
          },
        }
      : {}),
  };
  // Only rows inside the DragDropContext may be Draggables; beside live, a choice drafted to be
  // restored is still shown among the retired.
  if (amongRetired) {
    return <div {...rowProps}>{content()}</div>;
  }
  return (
    <Draggable
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
}
