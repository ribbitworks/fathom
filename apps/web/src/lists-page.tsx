// SPDX-License-Identifier: Apache-2.0

// The Lists page: every list in one table, with its description and its choices in order, and the
// selected list in a side panel at its own address, where its choices are kept. Users who may edit
// planning configuration create, edit, retire, restore, and delete lists, and change choices from
// the keyboard. Every change shows at once and saves in the background, one at a time in the order
// made. The latest change can be undone with Cmd+Z or Ctrl+Z, or from its notification when it took
// something out of view.

import type { Choice, ChoiceRequest, List } from "@fathom/shared";
import {
  Alert,
  Button,
  Group,
  Loader,
  Modal,
  Paper,
  Stack,
  Text,
} from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { type MouseEvent, type ReactNode, useState } from "react";
import { focusSoon } from "./focus.ts";
import { ListDialog } from "./list-dialog.tsx";
import {
  type ChoiceActions,
  entryNameId,
  ListPanel,
  rowId,
} from "./list-panel.tsx";
import {
  addChoices,
  deleteChoice,
  deleteList,
  listsQuery,
  moveChoice,
  setChoiceRetired,
  setListRetired,
  updateChoice,
} from "./lists.ts";
import { PageHeader } from "./page-header.tsx";
import classes from "./pages.module.css";
import { useSaving } from "./saving.ts";

const newListId = "list-new";

const linkId = (list: { id: string }) => `list-link-${list.id}`;

type Dialog = { kind: "new" } | { kind: "edit"; list: List };

// The lists with one list changed.
function withList(
  lists: List[],
  id: string,
  change: (list: List) => List,
): List[] {
  return lists.map((list) => (list.id === id ? change(list) : list));
}

// A list's choices with one taken out and put back just after another, or at the top.
function reordered(
  choices: readonly Choice[],
  choice: Choice,
  after: string | null,
): Choice[] {
  const others = choices.filter((other) => other.id !== choice.id);
  const at = others.findIndex((other) => other.id === after) + 1;
  return [...others.slice(0, at), choice, ...others.slice(at)];
}

function ListsTable({
  lists,
  selected,
  onOpen,
}: {
  lists: List[];
  selected: string | undefined;
  onOpen: (list: List) => void;
}) {
  const [showRetired, setShowRetired] = useState(false);
  const current = lists.filter((list) => !list.retired);
  const retired = lists.filter((list) => list.retired);
  const row = (list: List) => {
    const offered = list.choices.filter((choice) => !choice.retired);
    return (
      <div
        key={list.id}
        role="row"
        data-list-row
        aria-current={list.id === selected ? "true" : undefined}
        className={[
          classes.listRow,
          list.id === selected ? classes.listRowSelected : "",
          list.retired ? classes.listRowRetired : "",
        ].join(" ")}
        onClick={() => {
          onOpen(list);
        }}
      >
        <span role="cell" className={classes.listCellName}>
          <Link
            id={linkId(list)}
            to="/lists/{-$listId}"
            params={{ listId: list.id }}
            className={classes.listLink}
          >
            {list.name}
          </Link>
        </span>
        <span role="cell" className={classes.listCellDim}>
          {list.description}
        </span>
        <span role="cell" className={classes.listCell}>
          <span className={classes.listCount}>({offered.length})</span>{" "}
          {offered.map((choice) => choice.label).join(", ")}
        </span>
      </div>
    );
  };
  return (
    <Paper withBorder>
      <div role="table" aria-label="Lists" className={classes.listTable}>
        <div role="row" className={classes.listHead}>
          <span role="columnheader">Name</span>
          <span role="columnheader">Description</span>
          <span role="columnheader">Choices</span>
        </div>
        {current.map(row)}
        {showRetired && (
          <>
            <div role="row" className={classes.listGroup}>
              <span role="cell" aria-colspan={3}>
                Retired
              </span>
            </div>
            {retired.map(row)}
          </>
        )}
      </div>
      {retired.length > 0 && (
        <div className={classes.listFoot}>
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
    </Paper>
  );
}

export function ListsPage({
  listId,
  canEdit,
}: {
  listId: string | undefined;
  canEdit: boolean;
}) {
  const query = useQuery(listsQuery);
  const narrow = useMediaQuery("(max-width: 48em)");
  const navigate = useNavigate();
  // The dialog stays set while it closes, so its content does not vanish mid-animation.
  const [dialog, setDialog] = useState<Dialog>();
  const [opened, setOpened] = useState(false);
  const [busy, setBusy] = useState(false);
  const { save, undoable, done } = useSaving<List[]>({
    queryKey: listsQuery.queryKey,
    removed: "Someone else has removed this. The lists have been refreshed.",
    blocked: opened,
  });
  const lists = query.data ?? [];
  const open = lists.find((list) => list.id === listId);

  const openList = (list: List) => {
    void navigate({ to: "/lists/{-$listId}", params: { listId: list.id } });
  };
  // Closing the panel puts focus back on the list's row in the table.
  const closePanel = (list: List) => {
    focusSoon(linkId(list));
    void navigate({ to: "/lists/{-$listId}", params: { listId: undefined } });
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
          choices: current.choices.map((other) =>
            other.id === choice.id ? { ...other, ...request } : other,
          ),
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
        }),
        () => moveChoice(list.id, choice.id, after),
        `Fathom could not move ${choice.label}.`,
        { focus: rowId(choice) },
      );
    },
    setRetired: (choice: Choice, retired: boolean) => {
      const changed = { ...choice, retired };
      changeList(
        list,
        (current) => ({
          ...current,
          choices: retired
            ? current.choices.map((other) =>
                other.id === choice.id ? changed : other,
              )
            : [
                ...current.choices.filter((other) => other.id !== choice.id),
                changed,
              ],
        }),
        () => setChoiceRetired(list.id, choice.id, retired),
        `Fathom could not ${retired ? "retire" : "restore"} ${choice.label}.`,
        {
          focus: rowId(choice),
          message: `${retired ? "Retired" : "Restored"} ${choice.label}.`,
        },
      );
    },
    remove: (choice) => {
      changeList(
        list,
        (current) => ({
          ...current,
          choices: current.choices.filter((other) => other.id !== choice.id),
        }),
        () => deleteChoice(list.id, choice.id),
        `Fathom could not remove ${choice.label}.`,
        { message: `Removed ${choice.label}.` },
      );
    },
  });

  const retireList = (list: List) => {
    setOpened(false);
    const retired = !list.retired;
    changeList(
      list,
      (current) => ({ ...current, retired }),
      () => setListRetired(list.id, retired),
      `Fathom could not ${retired ? "retire" : "restore"} ${list.name}.`,
      { message: `${retired ? "Retired" : "Restored"} ${list.name}.` },
    );
  };

  const removeList = (list: List) => {
    setOpened(false);
    closePanel(list);
    focusSoon(newListId);
    save({
      next: (current) => current.filter((other) => other.id !== list.id),
      save: () => deleteList(list.id),
      failure: `Fathom could not delete ${list.name}.`,
      onSaved: (changeSetId, before) => {
        // Undoing brings the list back as it was, and opens it again.
        done(`Deleted ${list.name}.`, changeSetId, before, undefined, () => {
          openList(list);
        });
      },
    });
  };

  // The dialog saved the list itself, so the page shows it at once, then reloads the lists once no
  // other change is saving. Undoing a new list deletes it again.
  const saved = (list: List, changeSetId: string | null) => {
    setOpened(false);
    const created = !lists.some((other) => other.id === list.id);
    save({
      next: (current) => [
        ...current.filter((other) => other.id !== list.id),
        list,
      ],
      save: () => Promise.resolve(changeSetId),
      failure: "",
      onSaved: (_saved, before) => {
        undoable(changeSetId, before, created ? newListId : undefined);
      },
    });
    if (created) {
      openList(list);
      focusSoon(entryNameId);
    }
  };

  const openDialog = (next: Dialog) => {
    setDialog(next);
    setOpened(true);
  };

  // Clicking the page outside the panel, the table's rows, and any control closes the panel. Menus and
  // dialogs are drawn outside the page, so clicks in them do not count.
  const onPageClick = (event: MouseEvent) => {
    const target = event.target as HTMLElement;
    if (
      open &&
      event.currentTarget.contains(target) &&
      !target.closest("[data-list-row], [data-list-panel], button, a")
    ) {
      closePanel(open);
    }
  };

  let content: ReactNode;
  if (query.isPending) {
    content = <Loader role="status" aria-label="Loading" />;
  } else if (query.isError) {
    content = (
      <Alert color="red" role="alert">
        <Group justify="space-between">
          <Text fz="sm">Fathom could not load the lists.</Text>
          <Button
            size="compact-sm"
            variant="light"
            color="red"
            onClick={() => void query.refetch()}
          >
            Try again
          </Button>
        </Group>
      </Alert>
    );
  } else if (lists.length === 0) {
    content = (
      <Paper withBorder p="xl">
        <Text fz="sm" c="dimmed" ta="center">
          No lists yet
        </Text>
      </Paper>
    );
  } else {
    content = <ListsTable lists={lists} selected={listId} onOpen={openList} />;
  }

  return (
    <Stack gap="md" onClick={onPageClick}>
      <PageHeader
        title="Lists"
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
      {open && (
        <div data-list-panel>
          <ListPanel
            key={open.id}
            list={open}
            canEdit={canEdit}
            narrow={narrow}
            actions={choiceActions(open)}
            onClose={() => {
              closePanel(open);
            }}
            onEditList={() => {
              openDialog({ kind: "edit", list: open });
            }}
          />
        </div>
      )}
      <Modal
        opened={opened}
        onClose={() => {
          setOpened(false);
        }}
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
            onCancel={() => {
              setOpened(false);
            }}
            onBusy={setBusy}
          />
        )}
      </Modal>
    </Stack>
  );
}
