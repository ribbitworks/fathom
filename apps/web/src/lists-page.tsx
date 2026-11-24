// SPDX-License-Identifier: Apache-2.0

// The Lists page: every list in one table, and the selected list's choices in a side panel.

import { LoadProblem } from "./load-problem.tsx";
import {
  type Choice,
  type ChoiceRequest,
  type DraftKind,
  type List,
  type Permission,
  type Tier,
} from "@fathom/shared";
import { Button, Loader, Modal, Stack } from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { type MouseEvent, type ReactNode, useState } from "react";
import { DecisionModal } from "./decision-dialog.tsx";
import { approvesAll, waitsForRejected } from "./drafts.ts";
import { type Decision, decisionFor } from "./draft-decisions.ts";
import { focusSoon } from "./focus.ts";
import { ListDialog } from "./list-dialog.tsx";
import { useDialogState } from "./dialog-actions.tsx";
import { moveListClass } from "./data-classes.ts";
import {
  MoveClassModal,
  showMoved,
  useClassMove,
} from "./move-class-dialog.tsx";
import {
  drafting,
  draftName,
  type DraftOn,
  type ListDraftActions,
  selectionOf,
} from "./list-drafts.tsx";
import { entryNameId, rowId } from "./choice-ids.ts";
import { reordered, withList, withoutField } from "./list-changes.ts";
import { type ChoiceActions, ListPanel, titleId } from "./list-panel.tsx";
import {
  addChoices,
  deleteChoice,
  deleteList,
  discardListDraft,
  draftedLists,
  isKind,
  type ListDraftTarget,
  type ListKind,
  listKindName,
  listKindSchema,
  listsQuery,
  liveLists,
  unchangeableLists,
  listRefusal,
  retiredLive,
  updateList,
  moveChoice,
  resubmitListDraft,
  setChoiceRetired,
  setListRetired,
  updateChoice,
} from "./lists.ts";
import { peopleQuery } from "./people.ts";
import { PageHeader } from "./page-header.tsx";
import classes from "./pages.module.css";
import { useSaving } from "./saving.ts";
import { besideLive } from "./status-mark.tsx";
import {
  listColumnOrder,
  type ListChange,
  ListItems,
  type ListRow,
  listRows,
  listTable,
} from "./lists-table.tsx";
import { focusRecordCell } from "./grid-row.tsx";
import { ModeSwitch } from "./page-header.tsx";
import { RecordGrid } from "./record-grid.tsx";
import { noRecordActions } from "./record-table.ts";
import { hiddenUnlessShown, retiredChoice } from "./view-choices.ts";
import { useSavedViews } from "./saved-views.tsx";
import { TableTips } from "./table-tips.tsx";
import { type ChangeView } from "./table-controls.tsx";
import { searchFor, type View } from "./table-view.ts";
import { originalOf } from "./record-drafts.ts";

const newListId = "list-new";
const listPanelId = "list-panel";

type Dialog = { kind: "new" } | { kind: "edit"; list: List };

// The switch names each option's radio button after its own name, which is how closing a panel
// finds the option chosen.
const kindName = "list-kind";

// The kinds of draft decided on the page: lists, their choices, and the order of their choices.
const listKinds: readonly DraftKind[] = ["list", "list-item", "choice-order"];
const kindOptionId = (kind: ListKind) => `${kindName}-${kind}`;

export function ListsPage({
  listId,
  canEdit: mayEdit,
  approves,
  view,
  onView,
  applied,
  onApply,
  canShareViews = false,
  kind = "all",
  onKind,
  seesPeople = false,
  permissions = [],
}: {
  listId: string | undefined;
  canEdit: boolean;
  // The kinds of draft the user's role approves and rejects.
  approves: readonly DraftKind[];
  // Whether the user sees people, whose columns and drafts may use drafts of lists and choices, so
  // deciding those here includes them as the Drafts page does.
  seesPeople?: boolean;
  // The table's view, with which version of each list and choice shows: the draft beside the live
  // one, the draft alone, or the live one alone, which is read only.
  view: View;
  onView: ChangeView;
  // The saved view the address started from, if any.
  applied?: string | undefined;
  onApply: (view: View, id: string, replace?: boolean) => void;
  canShareViews?: boolean;
  kind?: ListKind;
  onKind?: (kind: ListKind) => void;
  // The role's permissions, which decide whether and to which classes a list may be moved.
  permissions?: readonly Permission[];
}) {
  const { show } = view;
  const canEdit = mayEdit && show !== "live";
  // The view and which lists stay in the address as lists are opened and closed.
  const showSearch = {
    ...searchFor(view),
    ...(applied === undefined ? {} : { view: applied }),
    ...(kind === "all" ? {} : { kind }),
  };
  const query = useQuery(listsQuery);
  const mayApprove = approvesAll(approves, listKinds);
  const readsPeople = seesPeople && mayApprove;
  const people = useQuery({ ...peopleQuery, enabled: readsPeople });
  // Deciding waits for the people, since rejecting must include the drafts of people that use a
  // list.
  const canApprove =
    mayApprove && show !== "live" && (!readsPeople || people.isSuccess);
  const narrow = useMediaQuery("(max-width: 48em)");
  const navigate = useNavigate();
  const {
    dialog,
    opened,
    open: openDialog,
    close: closeDialog,
  } = useDialogState<Dialog>();
  const [busy, setBusy] = useState(false);
  const classMove = useClassMove();
  // Approving or rejecting drafts, which asks first.
  const [decision, setDecision] = useState<Decision>();
  const [deciding, setDeciding] = useState(false);
  const { save, shown, undoable, done } = useSaving<List[]>({
    queryKey: listsQuery.queryKey,
    removed: "Someone else has removed this. The lists have been refreshed.",
    blocked: opened || classMove.opened || deciding,
  });
  const all = query.data ?? [];
  const lists =
    show === "live"
      ? liveLists(all)
      : show === "drafts"
        ? draftedLists(all)
        : all;
  const open = lists.find((list) => list.id === listId);
  // Each list with every draft, as marks are worked out before any are taken back or left out.
  const drafted = new Map(all.map((list) => [list.id, list]));
  const unchangeable = unchangeableLists(all, permissions);

  const openList = (list: List) => {
    void navigate({
      to: "/lists/{-$listId}",
      params: { listId: list.id },
      search: showSearch,
    });
  };
  // Closing the panel puts focus back on the list's row in the table, or, if the switch has since
  // hidden the list, on the switch, so focus is never lost.
  const closePanel = (list: List) => {
    if (isKind(list, kind)) focusRecordCell(list.id, "name");
    else focusSoon(kindOptionId(kind));
    void navigate({
      to: "/lists/{-$listId}",
      params: { listId: undefined },
      search: showSearch,
    });
  };

  // A change to one list, shown at once, which can be undone once saved, with focus put back where
  // given, or, when it took something out of view, from a notification saying what was done.
  const changeList = (
    list: List,
    next: (list: List) => List,
    saveChange: () => Promise<string | null>,
    failure: string,
    undo: { focus?: string; message?: string } = {},
  ) => {
    save({
      next: (current) => withList(current, list.id, next),
      save: saveChange,
      failure,
      onSaved: (changeSetId, before) => {
        if (undo.message === undefined) {
          undoable(changeSetId, before, undo.focus);
        } else {
          done(undo.message, changeSetId, before, undo.focus);
        }
      },
    });
  };

  const choiceActions = (list: List): ChoiceActions => ({
    add: (requests: ChoiceRequest[], onFailed: () => void) => {
      save({
        next: (current) => current,
        save: async () => (await addChoices(list.id, requests)).changeSetId,
        failure: "Fathom could not add the choices. Try again in a moment.",
        onFailed,
        onSaved: (changeSetId, before) => {
          undoable(changeSetId, before, entryNameId);
        },
      });
    },
    edit: (choice, request) => {
      changeList(
        list,
        (current) => ({
          ...current,
          choices: current.choices.map((other) => {
            if (other.id !== choice.id) return other;
            const { meaning, weight, ...details } = request;
            const given = {
              ...(meaning === undefined || meaning === null ? {} : { meaning }),
              ...(weight === undefined || weight === null ? {} : { weight }),
            };
            return drafting({ ...other, ...details, ...given }, [
              "label",
              "description",
              ...Object.keys(given),
            ]);
          }),
        }),
        () => updateChoice(list.id, choice.id, request),
        `Fathom could not save ${request.label}.`,
        { focus: rowId(choice) },
      );
    },
    move: (choice, after) => {
      changeList(
        list,
        (current) => ({
          ...current,
          choices: reordered(current.choices, choice, after),
          orderDraft: {
            live: current.orderDraft?.live ?? [],
            state: "waiting",
            madeBy: current.orderDraft?.madeBy ?? null,
            madeAt: current.orderDraft?.madeAt ?? null,
          },
        }),
        () => moveChoice(list.id, choice.id, after),
        `Fathom could not move ${choice.label}.`,
        { focus: rowId(choice) },
      );
    },
    setRetired: (choice: Choice, retired: boolean) => {
      const changed = drafting({ ...choice, retired }, ["retired"]);
      changeList(
        list,
        (current) => ({
          ...current,
          choices: current.choices.map((other) =>
            other.id === choice.id ? changed : other,
          ),
        }),
        () => setChoiceRetired(list.id, choice.id, retired),
        `Fathom could not ${retired ? "retire" : "restore"} ${choice.label}.`,
        {
          focus: rowId(choice),
          message: `Drafted ${retired ? "retiring" : "restoring"} ${choice.label}.`,
        },
      );
    },
    remove: (choice) => {
      // A choice only drafted to be added goes; a live one stays, struck through, until approved.
      const added = choice.draft?.action === "created";
      changeList(
        list,
        (current) => ({
          ...current,
          choices: added
            ? current.choices.filter((other) => other.id !== choice.id)
            : current.choices.map((other) =>
                other.id === choice.id ? drafting(other, [], "deleted") : other,
              ),
        }),
        () => deleteChoice(list.id, choice.id),
        `Fathom could not remove ${choice.label}.`,
        added
          ? { message: `Discarded ${choice.label}.` }
          : { focus: rowId(choice) },
      );
    },
  });

  const renameList = (row: ListRow, { name }: ListChange) => {
    const { list } = row;
    changeList(
      list,
      (current) => drafting({ ...current, name }, ["name"]),
      async () =>
        (
          await updateList(list.id, {
            name,
            description: list.description,
            visibility: list.visibility,
          })
        ).changeSetId,
      `Fathom could not rename ${list.name}.`,
    );
  };

  const retireList = (list: List) => {
    closeDialog();
    const retired = !list.retired;
    changeList(
      list,
      (current) => drafting({ ...current, retired }, ["retired"]),
      () => setListRetired(list.id, retired),
      `Fathom could not ${retired ? "retire" : "restore"} ${list.name}.`,
      {
        message: `Drafted ${retired ? "retiring" : "restoring"} ${list.name}.`,
      },
    );
  };

  // A list only drafted to be added goes, with its choices; a live one stays, struck through, until
  // its draft is approved, with focus kept in its panel, or on its row when removed from there.
  const removeList = (list: List, fromRow = false) => {
    closeDialog();
    if (list.draft?.action !== "created") {
      changeList(
        list,
        (current) => drafting(current, [], "deleted"),
        () => deleteList(list.id),
        `Fathom could not remove ${list.name}.`,
        fromRow ? {} : { focus: titleId },
      );
      if (fromRow) focusRecordCell(list.id, "name");
      else focusSoon(titleId);
      return;
    }
    closePanel(list);
    focusSoon(newListId);
    save({
      next: (current) => current.filter((other) => other.id !== list.id),
      save: () => deleteList(list.id),
      failure: `Fathom could not remove ${list.name}.`,
      onSaved: (changeSetId, before) => {
        // Undoing brings the list back as it was, and opens it again.
        done(`Discarded ${list.name}.`, changeSetId, before, undefined, () => {
          openList(list);
        });
      },
    });
  };

  const targetOf = (what: DraftOn): ListDraftTarget => {
    if (what.kind === "choice") {
      return { kind: "choice", listId: what.list.id, choiceId: what.choice.id };
    }
    return { kind: what.kind, listId: what.list.id };
  };

  // The lists as they will be once a draft is discarded, before the server says so: a record only
  // drafted to be added goes, and the rest lose their drafts until the lists are reloaded.
  const withoutDraft = (current: List[], what: DraftOn): List[] => {
    if (what.kind === "list") {
      return what.list.draft?.action === "created"
        ? current.filter((other) => other.id !== what.list.id)
        : withList(current, what.list.id, (list) =>
            withoutField(list, "draft"),
          );
    }
    return withList(current, what.list.id, (list) => {
      if (what.kind === "order") return withoutField(list, "orderDraft");
      return {
        ...list,
        choices:
          what.choice.draft?.action === "created"
            ? list.choices.filter((other) => other.id !== what.choice.id)
            : list.choices.map((other) =>
                other.id === what.choice.id
                  ? withoutField(other, "draft")
                  : other,
              ),
      };
    });
  };

  const draftActions: ListDraftActions = {
    discard: (what) => {
      const gone =
        what.kind === "list" && what.list.draft?.action === "created";
      if (gone) closePanel(what.list);
      save({
        next: (current) => withoutDraft(current, what),
        save: () => discardListDraft(targetOf(what)),
        failure: `Fathom could not discard the draft of ${draftName(what)}.`,
        onSaved: (changeSetId, before) => {
          done(
            `Discarded the draft of ${draftName(what)}.`,
            changeSetId,
            before,
            undefined,
            gone
              ? () => {
                  openList(what.list);
                }
              : undefined,
          );
        },
      });
    },
    resubmit: (what) => {
      save({
        next: (current) => current,
        save: () => resubmitListDraft(targetOf(what)),
        failure: `Fathom could not send the draft of ${draftName(what)} for approval again.`,
        onSaved: undoable,
      });
    },
    decide: (asking, what) => {
      // Every list, with its rejected drafts, whatever is shown, so a draft that depends on one
      // waits.
      setDecision(
        decisionFor(asking, selectionOf(what), approves, all, people.data),
      );
      setDeciding(true);
    },
  };

  // The dialog saved the list itself, so the page shows it at once, then reloads the lists once no
  // other change is saving. Undoing a new list deletes it again.
  const saved = (list: List, changeSetId: string | null) => {
    closeDialog();
    const created = !lists.some((other) => other.id === list.id);
    shown(
      (current) => [...current.filter((other) => other.id !== list.id), list],
      changeSetId,
      (_saved, before) => {
        undoable(changeSetId, before, created ? newListId : undefined);
      },
    );
    if (created) {
      openList(list);
      focusSoon(entryNameId);
    }
  };

  const movedClass = (
    list: List,
    visibility: Tier,
    changeSetId: string | null,
  ) => {
    showMoved(
      { shown, undoable },
      list,
      (current) =>
        current.map((other) =>
          other.id === list.id ? { ...other, visibility } : other,
        ),
      changeSetId,
    );
  };

  // Clicking the page outside the panel, the table's rows, and any control closes the panel. Menus
  // and dialogs are drawn outside the page, so clicks in them do not count.
  const onPageClick = (event: MouseEvent) => {
    const target = event.target as HTMLElement;
    if (
      open &&
      event.currentTarget.contains(target) &&
      !target.closest(
        "tr, [data-list-panel], [data-side-panel], section, button, a, input",
      )
    ) {
      closePanel(open);
    }
  };

  const openWhy = open === undefined ? undefined : unchangeable.get(open.id);

  const { rows: kept, choices } = hiddenUnlessShown({
    rows: all.filter((list) => isKind(list, kind)),
    hidden: retiredLive,
    choice: retiredChoice,
    label: "Show retired",
    records: "Retired lists",
    view,
  });
  const rows = listRows(kept, show);
  const table = listTable({
    lists: all,
    shown: kept,
    unchangeable,
    onOpen: openList,
    menuItems: (row) =>
      !row.live &&
      canEdit &&
      !unchangeable.has(row.id) &&
      row.list.heldBy === undefined && (
        <ListItems
          list={row.list}
          onRetire={retireList}
          onRemove={(list) => {
            removeList(list, true);
          }}
        />
      ),
  });
  const views = useSavedViews({
    table: "lists",
    within: listsQuery.queryKey,
    view,
    applied,
    onApply,
    canShare: canShareViews,
    blocked: opened || classMove.opened || deciding,
  });
  const panels =
    open === undefined
      ? []
      : [
          {
            key: "list",
            id: listPanelId,
            name: "the list's panel",
            node: (
              <div
                data-list-panel
                id={listPanelId}
                className={classes.panelSlot}
              >
                <ListPanel
                  key={open.id}
                  list={open}
                  canEdit={canEdit && openWhy === undefined}
                  canApprove={canApprove && openWhy === undefined}
                  unchangeable={mayEdit || mayApprove ? openWhy : undefined}
                  showLive={besideLive(show)}
                  drafted={originalOf(drafted, open)}
                  waits={(selection) =>
                    waitsForRejected(selection, all, people.data)
                  }
                  draftActions={draftActions}
                  narrow={narrow}
                  actions={choiceActions(open)}
                  onClose={() => {
                    closePanel(open);
                  }}
                  onEditList={() => {
                    openDialog({ kind: "edit", list: open });
                  }}
                  onMoveClass={
                    permissions.includes("data:classify")
                      ? () => {
                          classMove.open({
                            name: open.name,
                            from: open.visibility,
                            move: (to) => moveListClass(open.id, to),
                            refusal: listRefusal(open),
                            moved: (to, changeSetId) => {
                              movedClass(open, to, changeSetId);
                            },
                          });
                        }
                      : undefined
                  }
                />
              </div>
            ),
          },
        ];

  let content: ReactNode;
  if (query.isPending) {
    content = <Loader role="status" aria-label="Loading" />;
  } else if (query.isError) {
    content = (
      <LoadProblem what="the lists" onRetry={() => void query.refetch()} />
    );
  } else {
    content = (
      <TableTips>
        <RecordGrid
          records={rows}
          table={table}
          fields={[]}
          order={listColumnOrder}
          lists={[]}
          canEdit={canEdit}
          canAdd={false}
          rowActions={false}
          canEditDrafts={(row) => canEdit && !unchangeable.has(row.id)}
          approves={canApprove ? approves : []}
          canEditColumns={false}
          actions={{
            ...noRecordActions<ListRow, ListChange, undefined>(
              (asking, selection, every) => {
                setDecision(
                  decisionFor(
                    asking,
                    selection,
                    approves,
                    all,
                    people.data,
                    every,
                  ),
                );
                setDeciding(true);
              },
            ),
            update: renameList,
            discard: (row) => {
              draftActions.discard({ kind: "list", list: row.original });
            },
            resubmit: (row) => {
              draftActions.resubmit({ kind: "list", list: row.original });
            },
          }}
          view={view}
          onView={onView}
          saved={views.saved}
          panels={panels}
          viewChoices={choices}
          selected={open?.id}
        />
      </TableTips>
    );
  }

  return (
    <Stack gap="md" className={classes.tablePage} onClick={onPageClick}>
      <PageHeader
        title="Lists"
        beside={
          onKind && (
            <ModeSwitch<ListKind>
              label="Which lists"
              name={kindName}
              modes={listKindSchema.options.map((option) => ({
                value: option,
                label: listKindName(option),
              }))}
              mode={kind}
              onMode={onKind}
            />
          )
        }
        action={
          canEdit && (
            <Button
              id={newListId}
              onClick={() => {
                openDialog({ kind: "new" });
              }}
            >
              New list
            </Button>
          )
        }
      />
      {content}
      {views.dialogs}
      <DecisionModal
        decision={decision}
        opened={deciding}
        onClose={() => {
          setDeciding(false);
        }}
        onDone={() => {
          setDeciding(false);
        }}
      />
      <Modal
        opened={opened}
        onClose={closeDialog}
        closeOnEscape={!busy}
        closeOnClickOutside={!busy}
        withCloseButton={!busy}
        title={dialog?.kind === "edit" ? "Edit list" : "New list"}
      >
        {dialog && (
          <ListDialog
            {...(dialog.kind === "edit" ? { list: dialog.list } : {})}
            lists={lists}
            onSaved={saved}
            onRetire={retireList}
            onDelete={removeList}
            onCancel={closeDialog}
            onBusy={setBusy}
            permissions={permissions}
          />
        )}
      </Modal>
      <MoveClassModal
        moving={classMove.dialog}
        opened={classMove.opened}
        permissions={permissions}
        onClose={classMove.close}
      />
    </Stack>
  );
}
