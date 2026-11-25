// SPDX-License-Identifier: Apache-2.0

// The side panel for one list: its name, description and choices in order, changed from the
// keyboard, by dragging and from each choice's menu.

import { DragDropContext, Droppable } from "@hello-pangea/dnd";
import {
  type Choice,
  type ChoiceRequest,
  type List,
  meaningsOf,
  weighs,
} from "@fathom/shared";
import { Button, Group, Text } from "@mantine/core";
import { Fragment, useEffect, useState } from "react";
import { cellClasses, listClasses, recordTableClasses } from "./page-styles.ts";
import { useChoiceEditing } from "./choice-editing.ts";
import { useChoiceEntry } from "./choice-entry.ts";
import { Fields } from "./choice-fields.tsx";
import { entryNameId, rowId } from "./choice-ids.ts";
import { ChoiceMenu, useChoiceMenus } from "./choice-menu.tsx";
import { ChoiceCells, ChoiceRow, choiceShape } from "./choice-row.tsx";
import { meaningKeptBy, removedChoice as removed } from "./choice-rules.ts";
import type { DraftSelection } from "./drafts.ts";
import { focusSoon } from "./focus.ts";
import { Icon } from "./icons.tsx";
import { builtInNote } from "./list-facts.tsx";
import { type ListDraftActions, movedChoices } from "./list-drafts.tsx";
import { ListActions, ListHeading, ListSubtitle } from "./list-panel-head.tsx";
import { retiredLive } from "./lists.ts";
import { LiveChoiceRow, movedLiveAfter } from "./live-choice-row.tsx";
import { count } from "./numbers.ts";
import { originalOf } from "./record-drafts.ts";
import { SidePanelFrame, sidePanelScroll } from "./side-panel.tsx";

export interface ChoiceActions {
  // Adds choices; if they cannot be saved, gives back what was typed.
  add: (requests: ChoiceRequest[], onFailed: () => void) => void;
  edit: (choice: Choice, request: ChoiceRequest) => void;
  // Moves a choice to just after another, or to the top when there is none.
  move: (choice: Choice, after: string | null) => void;
  setRetired: (choice: Choice, retired: boolean) => void;
  remove: (choice: Choice) => void;
}

export const titleId = "list-panel-title";
const listFrameId = "list-panel-frame";

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
  unchangeable,
}: {
  list: List;
  canEdit: boolean;
  canApprove: boolean;
  // Why the role, which changes or decides lists, may not change this one or decide its drafts.
  unchangeable?: string | undefined;
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
  const weighed = weighs(list.builtIn);
  const shape = choiceShape(meanings, weighed);
  // The choices a draft of the order moves, with their live places.
  const moved = movedChoices(list);
  const original = drafted;
  const originalChoices = new Map(
    original.choices.map((choice) => [choice.id, choice]),
  );
  const movedInDraft = movedChoices(original);
  // Beside live, a choice a draft retires or restores stays where it is live until approved.
  const isRetired = (choice: Choice) =>
    showLive ? retiredLive(choice) : choice.retired;
  const offered = list.choices.filter((choice) => !isRetired(choice));
  const retired = list.choices.filter(isRetired);
  const [showRetired, setShowRetired] = useState(false);
  const shownRetired = showRetired ? retired : [];
  // The rows arrow keys move through, in order, with the empty row between offered and retired.
  const order: (Choice | "entry")[] = [
    ...offered,
    ...(canEdit ? (["entry"] as const) : []),
    ...shownRetired,
  ];
  const [first] = offered;
  const menus = useChoiceMenus();
  const editing = useChoiceEditing({
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
    setMenuFor: menus.setMenuFor,
  });
  const entry = useChoiceEntry({
    list,
    meanings,
    weighed,
    add: actions.add,
    select: editing.select,
    rowAbove: offered.at(-1),
    rowBelow: shownRetired[0],
  });
  // Where focus starts when the panel opens: the first choice, the empty row, or the list's name.
  const start = canEdit ? (first ? rowId(first) : entryNameId) : titleId;

  // Opening a list puts focus in its panel, which is drawn anew for each list.
  useEffect(() => {
    focusSoon(start);
    // Only when the panel opens, not after every change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cellRole = canEdit ? "gridcell" : "cell";

  const row = (choice: Choice, index: number) => {
    const isEditing = editing.editing === choice.id;
    const amongRetired = isRetired(choice);
    return (
      <ChoiceRow
        key={choice.id}
        choice={choice}
        index={index}
        shape={shape}
        canEdit={canEdit}
        selected={editing.selected === choice.id}
        editing={isEditing}
        tabStop={choice.id === editing.tabStop}
        draggable={
          canMove &&
          choice.heldBy === undefined &&
          !narrow &&
          !choice.retired &&
          !amongRetired &&
          !isEditing &&
          !removed(choice)
        }
        amongRetired={amongRetired}
        moved={moved.has(choice.id)}
        showLive={showLive}
        onKeyDown={(event) => {
          editing.onRowKey(event, choice);
        }}
        onSelect={() => {
          editing.setSelected(choice.id);
        }}
        onStartEdit={(field) => {
          editing.startEdit(choice, field);
        }}
        onLeave={(event) => {
          editing.onEditBlur(event, choice);
        }}
      >
        {isEditing ? (
          <Fields
            idPrefix="choice-edit"
            draft={editing.draft}
            problem={editing.editProblem}
            label=""
            meanings={meanings}
            meaningKept={meaningKeptBy(list, choice)}
            weighed={weighed}
            weightProblem={editing.editWeightProblem}
            onChange={editing.changeDraft}
            onKeyDown={(event, field) => {
              editing.onEditKey(event, field, choice);
            }}
          />
        ) : (
          <ChoiceCells
            choice={choice}
            original={originalOf(originalChoices, choice)}
            movedBy={
              movedInDraft.has(choice.id) ? original.orderDraft : undefined
            }
            livePlace={moved.get(choice.id)}
            meanings={meanings}
            weighed={weighed}
            cellRole={cellRole}
          />
        )}
        {(canEdit ||
          (choice.draft !== undefined && (canApprove || mayEdit))) && (
          <span role={cellRole}>
            <ChoiceMenu
              list={list}
              choice={choice}
              index={index}
              offeredCount={offered.length}
              amongRetired={amongRetired}
              opened={menus.menuFor === choice.id}
              tabStop={choice.id === editing.tabStop}
              mayEdit={mayEdit}
              canEdit={canEdit}
              canMove={canMove}
              canApprove={canApprove}
              waits={waits}
              setOpened={(opened) => {
                menus.setMenuFor(opened ? choice.id : undefined);
              }}
              actions={editing.menuActionsFor(choice, index)}
              draftActions={draftActions}
            />
          </span>
        )}
      </ChoiceRow>
    );
  };

  // A moved choice's live place, shown as the People table shows a person's live row: dimmed,
  // marked Live, read only, and skipped by the keyboard, just after the choice it followed in the
  // live order, or at the top. Assistive technology hears the live place with the moved choice
  // instead.
  const liveRow = (choice: Choice, key: string) => (
    <LiveChoiceRow
      key={key}
      choice={choice}
      moved={moved.has(choice.id)}
      shape={shape}
      meanings={meanings}
      weighed={weighed}
    />
  );
  const movedAfter = movedLiveAfter(
    showLive ? offered : [],
    list.orderDraft?.live ?? [],
    moved,
  );
  const liveRowsAfter = (previous: string | null) =>
    (movedAfter.get(previous) ?? []).map((choice) =>
      liveRow(choice, `live-place-${choice.id}`),
    );
  // A choice whose draft changes it shows its live row just under it, as a person's does.
  const liveUnder = (choice: Choice) =>
    showLive && choice.draft?.action === "changed" && !moved.has(choice.id)
      ? liveRow(choice, `live-${choice.id}`)
      : null;

  const gridRole = canEdit ? "grid" : "table";

  return (
    <SidePanelFrame
      id={listFrameId}
      titleId={titleId}
      narrow={narrow}
      close={{ label: "Close", onClose }}
      title={
        <span className={listRemoved ? recordTableClasses.struck : undefined}>
          {list.name}
        </span>
      }
      marked={(heading) => (
        <ListHeading list={list} original={original}>
          {heading}
        </ListHeading>
      )}
      actions={
        <ListActions
          list={list}
          canEdit={canEdit}
          mayEdit={mayEdit}
          canApprove={canApprove}
          waits={waits}
          draftActions={draftActions}
          onEditList={onEditList}
          onMoveClass={onMoveClass}
        />
      }
      subtitle={
        <ListSubtitle list={list} original={original} showLive={showLive} />
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
      <div className={sidePanelScroll} onKeyDown={menus.closeMenuOnEscape}>
        {offered.length === 0 && !canEdit && (
          <Text fz="sm" c="dimmed" p="md">
            None
          </Text>
        )}
        <div role={gridRole} aria-label="Choices">
          <DragDropContext onDragEnd={editing.drop}>
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
              className={[...shape, cellClasses.entry].join(" ")}
              // Leaving the empty row, by clicking or tabbing elsewhere, adds what was typed, as
              // leaving a choice being edited saves it.
              onBlur={(event) => {
                if (event.currentTarget.contains(event.relatedTarget)) return;
                entry.addEntry(false);
              }}
            >
              <span className={cellClasses.plus} aria-hidden>
                <Icon name="plus" size={14} />
              </span>
              <Fields
                idPrefix="choice-entry"
                draft={entry.entry}
                problem={entry.entryProblem}
                label="New choice "
                meanings={meanings}
                weighed={weighed}
                weightProblem={entry.entryWeightProblem}
                onChange={entry.change}
                onKeyDown={entry.onEntryKey}
                onFocus={() => {
                  editing.setSelected(undefined);
                }}
                onPaste={entry.paste}
              />
            </div>
          )}
        </div>
        {unchangeable !== undefined && (
          <Text fz="xs" c="dimmed" className={listClasses.builtInNote}>
            {`${unchangeable}, so it can't change this list.`}
          </Text>
        )}
        {list.builtIn && (
          <Text fz="xs" c="dimmed" className={listClasses.builtInNote}>
            {builtInNote(list.builtIn, mayEdit)}
          </Text>
        )}
        {shownRetired.length > 0 && (
          <>
            <Text
              id="list-panel-retired"
              className={cellClasses.retiredLabel}
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
