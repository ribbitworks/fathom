// SPDX-License-Identifier: Apache-2.0

// A choice's menu in a list's panel: which one is open, the choice's draft, and how to edit, move,
// retire, remove or decide it.

import { type Choice, type List, meaningName } from "@fathom/shared";
import { Menu } from "@mantine/core";
import { type KeyboardEvent, useId, useState } from "react";
import { closesOnBlankClick } from "./app-menu.tsx";
import { actionsId, rowId } from "./choice-ids.ts";
import { lastKept, removedChoice } from "./choice-rules.ts";
import {
  approveTurnedOff,
  configDraftFields,
  draftLines,
  HeldNote,
  MenuDraftLines,
  MenuNote,
  MenuTitle,
  ReasonedItem,
  UnpublishedNote,
} from "./draft-details.tsx";
import { decidable, type DraftSelection, noDrafts } from "./drafts.ts";
import { focusSoon } from "./focus.ts";
import type { ListDraftActions } from "./list-drafts.tsx";
import { withRetiring } from "./lists.ts";
import { draftOffer, offersDraft } from "./menu-offer.ts";
import { shortcutsFor } from "./menu-shortcuts.ts";
import { actionsFor, MoreButton } from "./row-controls.tsx";

const shortcuts = shortcutsFor(navigator.userAgent);

// Which choice's menu is open, at most one at a time.
export function useChoiceMenus() {
  const [menuFor, setMenuFor] = useState<string>();

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

  return { menuFor, setMenuFor, closeMenuOnEscape };
}

export interface ChoiceMenuActions {
  edit: () => void;
  moveToTop: () => void;
  moveUp: () => void;
  moveDown: () => void;
  moveToBottom: () => void;
  retireOrRestore: () => void;
  remove: () => void;
}

export function ChoiceMenu({
  list,
  choice,
  index,
  offeredCount,
  amongRetired,
  opened,
  tabStop,
  mayEdit,
  canEdit,
  canMove,
  canApprove,
  waits,
  setOpened,
  actions,
  draftActions,
}: {
  list: List;
  choice: Choice;
  index: number;
  offeredCount: number;
  // Whether the choice shows among the retired, where it cannot be moved.
  amongRetired: boolean;
  opened: boolean;
  tabStop: boolean;
  mayEdit: boolean;
  canEdit: boolean;
  canMove: boolean;
  canApprove: boolean;
  waits: (selection: DraftSelection) => boolean;
  setOpened: (opened: boolean) => void;
  actions: ChoiceMenuActions;
  draftActions: ListDraftActions;
}) {
  const choiceDraft = choice.draft;
  // A choice added to a list whose addition was rejected waits for the list to be resubmitted.
  const choiceWaits = waits({ ...noDrafts(), choices: [choice.id] });
  const on = { kind: "choice" as const, list, choice };
  // A choice a draft removes offers only what can be done with the draft.
  const editable =
    canEdit && !removedChoice(choice) && choice.heldBy === undefined;
  const keptFor = lastKept(list, choice);
  const keptLineId = useId();
  const choiceOffer = draftOffer({
    hasDraft: choiceDraft !== undefined,
    rejected: choiceDraft?.state === "rejected",
    unpublished: choiceDraft?.unpublished === true,
    editsDraft: mayEdit && choice.heldBy === undefined,
    discardable: choiceDraft?.discardable === true,
    decides: canApprove && decidable(choice),
    publishes: false,
  });
  // Each item closes the menu and moves focus itself, so focus never stays on the menu's button.
  const act = (run: () => void) => () => {
    setOpened(false);
    run();
  };
  return (
    <Menu
      opened={opened}
      onChange={(next) => {
        setOpened(next);
        if (!next) focusSoon(rowId(choice));
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
          tabIndex={tabStop ? 0 : -1}
          label={actionsFor(choice.label)}
        />
      </Menu.Target>
      <Menu.Dropdown
        onClick={closesOnBlankClick(() => {
          setOpened(false);
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
            divider={offersDraft(choiceOffer)}
          />
        )}
        {editable && (
          <>
            <Menu.Item
              rightSection={<kbd>{shortcuts.edit}</kbd>}
              onClick={act(actions.edit)}
            >
              Edit
            </Menu.Item>
            {!amongRetired && canMove && (
              <>
                <Menu.Divider />
                <Menu.Item
                  disabled={index === 0}
                  onClick={act(actions.moveToTop)}
                >
                  Move to top
                </Menu.Item>
                <Menu.Item
                  disabled={index === 0}
                  rightSection={<kbd>{shortcuts.up}</kbd>}
                  onClick={act(actions.moveUp)}
                >
                  Move up
                </Menu.Item>
                <Menu.Item
                  disabled={index === offeredCount - 1}
                  rightSection={<kbd>{shortcuts.down}</kbd>}
                  onClick={act(actions.moveDown)}
                >
                  Move down
                </Menu.Item>
                <Menu.Item
                  disabled={index === offeredCount - 1}
                  onClick={act(actions.moveToBottom)}
                >
                  Move to bottom
                </Menu.Item>
              </>
            )}
            <Menu.Divider />
            <ReasonedItem
              describedBy={keptFor === undefined ? undefined : keptLineId}
              rightSection={<kbd>{shortcuts.retire}</kbd>}
              onClick={act(actions.retireOrRestore)}
            >
              {choice.retired ? "Restore" : "Retire"}
            </ReasonedItem>
            <ReasonedItem
              color="red"
              describedBy={keptFor === undefined ? undefined : keptLineId}
              rightSection={<kbd>{shortcuts.remove}</kbd>}
              onClick={act(actions.remove)}
            >
              Remove
            </ReasonedItem>
            {keptFor !== undefined && (
              <MenuNote id={keptLineId}>
                {keptFor === "any"
                  ? `${list.name} needs a choice`
                  : `Needed for ${meaningName(keptFor)}`}
              </MenuNote>
            )}
          </>
        )}
        {choiceDraft && (
          <>
            {editable && <Menu.Divider />}
            {choiceOffer.resubmit && (
              <Menu.Item
                onClick={act(() => {
                  draftActions.resubmit(on);
                })}
              >
                Resubmit
              </Menu.Item>
            )}
            {choiceOffer.discard && (
              <Menu.Item
                onClick={act(() => {
                  draftActions.discard(on);
                })}
              >
                Discard draft
              </Menu.Item>
            )}
            {choiceOffer.decide && (
              <>
                <ReasonedItem
                  reason={approveTurnedOff({
                    waits: choiceWaits,
                    othersApprove: choice.draft?.needsOtherApprover === true,
                  })}
                  onClick={act(() => {
                    draftActions.decide("approve", on);
                  })}
                >
                  Approve…
                </ReasonedItem>
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
}
