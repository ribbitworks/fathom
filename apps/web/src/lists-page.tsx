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
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { type MouseEvent, type ReactNode, useEffect, useState } from "react";
import { ApiError, describeProblem } from "./api.ts";
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
  createList,
  deleteChoice,
  deleteList,
  listsQuery,
  moveChoice,
  setChoiceRetired,
  setListRetired,
  updateChoice,
  updateList,
} from "./lists.ts";
import { closeUndoNotice, notifyFailure, notifyUndoable } from "./notices.tsx";
import { PageHeader } from "./page-header.tsx";
import classes from "./pages.module.css";

const notFound = 404;
const undoFailure = "Fathom could not undo the change. Try again in a moment.";
const newListId = "list-new";
const changeKey = ["lists", "change"];

const linkId = (list: { id: string }) => `list-link-${list.id}`;

type Dialog = { kind: "new" } | { kind: "edit"; list: List };

// A change that shows at once and saves in the background: how the lists will look, how to save,
// what to do once saved, and what to do if it fails.
interface Change {
  next: (lists: List[]) => List[];
  save: () => Promise<unknown>;
  failure: string;
  onSaved?: () => void;
  onFailed?: () => void;
}

// Changes are saved one at a time, in the order made. A failed change goes back to the lists as they
// were just before it, which briefly hides any later changes still waiting to save until the lists
// are reloaded. The lists are reloaded once no change is still saving, so rows do not flicker.
function useChange() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: changeKey,
    scope: { id: "lists" },
    mutationFn: ({ save }: Change) => save(),
    onMutate: async ({ next }) => {
      await queryClient.cancelQueries({ queryKey: listsQuery.queryKey });
      const before = queryClient.getQueryData(listsQuery.queryKey) as List[];
      queryClient.setQueryData(listsQuery.queryKey, next(before));
      return { before };
    },
    onError: (error, { failure, onFailed }, context) => {
      queryClient.setQueryData(
        listsQuery.queryKey,
        (context as { before: List[] }).before,
      );
      onFailed?.();
      notifyFailure(
        error instanceof ApiError && error.status === notFound
          ? "Someone else has removed this. The lists have been refreshed."
          : describeProblem(error, failure),
      );
    },
    onSuccess: (_result, { onSaved }) => {
      onSaved?.();
    },
    onSettled: async () => {
      if (queryClient.isMutating({ mutationKey: changeKey }) > 1) return;
      await queryClient.invalidateQueries({ queryKey: listsQuery.queryKey });
    },
  });
}

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

// The choice before this one in the list, which undoing a move, a restore, or a removal puts it after.
function previousOf(list: List, choice: Choice): string | null {
  return list.choices.slice(0, list.choices.indexOf(choice)).at(-1)?.id ?? null;
}

// Whether a key press asks to undo the latest change. In a text field with something typed, it
// undoes the typing instead.
function isUndo(event: KeyboardEvent): boolean {
  const target = event.target as HTMLInputElement;
  return (
    (event.metaKey || event.ctrlKey) &&
    !event.shiftKey &&
    event.key.toLowerCase() === "z" &&
    !(target.matches("input, textarea") && target.value !== "")
  );
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
  const change = useChange();
  // The dialog stays set while it closes, so its content does not vanish mid-animation.
  const [dialog, setDialog] = useState<Dialog>();
  const [opened, setOpened] = useState(false);
  const [busy, setBusy] = useState(false);
  const [undo, setUndo] = useState<() => void>();
  const lists = query.data ?? [];
  const open = lists.find((list) => list.id === listId);

  // Cmd+Z or Ctrl+Z undoes the latest change from anywhere on the page, but not behind a dialog.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (undo === undefined || opened || !isUndo(event)) return;
      event.preventDefault();
      undo();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
    };
  }, [undo, opened]);

  const openList = (list: List) => {
    void navigate({ to: "/lists/{-$listId}", params: { listId: list.id } });
  };
  // Closing the panel puts focus back on the list's row in the table.
  const closePanel = () => {
    if (open) focusSoon(linkId(open));
    void navigate({ to: "/lists/{-$listId}", params: { listId: undefined } });
  };

  // Makes a change undoable until the next change, putting focus on what the undo changes, and
  // returns the undo. A newer change closes an older change's notification.
  const undoable = (reverse: () => void, focus?: string) => {
    closeUndoNotice();
    const run = () => {
      setUndo(undefined);
      reverse();
      if (focus !== undefined) focusSoon(focus);
    };
    setUndo(() => run);
    return run;
  };

  // Says what was done when it took something out of view, offering Undo there too. Changes seen in
  // place, such as an added or moved choice, need no notification.
  const done = (message: string, reverse: () => void, focus?: string) => {
    notifyUndoable(message, undoable(reverse, focus));
  };

  const changeList = (
    list: List,
    next: (list: List) => List,
    save: () => Promise<unknown>,
    failure: string,
    onSaved?: () => void,
  ) => {
    change.mutate({
      next: (current) => withList(current, list.id, next),
      save,
      failure,
      ...(onSaved ? { onSaved } : {}),
    });
  };

  const choiceActions = (list: List): ChoiceActions => {
    const removeAll = (choices: Choice[]) => {
      const ids = choices.map(({ id }) => id);
      changeList(
        list,
        (current) => ({
          ...current,
          choices: current.choices.filter(({ id }) => !ids.includes(id)),
        }),
        async () => {
          for (const id of ids) await deleteChoice(list.id, id);
        },
        undoFailure,
      );
    };
    const move = (choice: Choice, after: string | null, quietly = false) => {
      const previous = previousOf(list, choice);
      changeList(
        list,
        (current) => ({
          ...current,
          choices: reordered(current.choices, choice, after),
        }),
        () => moveChoice(list.id, choice.id, after),
        `Fathom could not move ${choice.label}.`,
        () => {
          if (quietly) return;
          undoable(() => {
            move(choice, previous, true);
          }, rowId(choice));
        },
      );
    };
    const setRetired = (choice: Choice, retired: boolean) => {
      const previous = previousOf(list, choice);
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
        () => {
          done(
            `${retired ? "Retired" : "Restored"} ${choice.label}.`,
            () => {
              // Undoing puts the choice back where it was, offered or retired.
              changeList(
                list,
                (current) => ({
                  ...current,
                  choices: reordered(current.choices, choice, previous),
                }),
                async () => {
                  await setChoiceRetired(list.id, choice.id, !retired, true);
                  await moveChoice(list.id, choice.id, previous);
                },
                undoFailure,
              );
            },
            rowId(choice),
          );
        },
      );
    };
    return {
      add: (requests: ChoiceRequest[], onFailed: () => void) => {
        change.mutate({
          next: (current) => current,
          save: async () => {
            const added = await addChoices(list.id, requests);
            undoable(() => {
              removeAll(added);
            }, entryNameId);
          },
          failure: "Fathom could not add the choices. Try again in a moment.",
          onFailed,
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
          () => {
            undoable(() => {
              changeList(
                list,
                (current) => ({
                  ...current,
                  choices: current.choices.map((other) =>
                    other.id === choice.id ? choice : other,
                  ),
                }),
                () =>
                  updateChoice(list.id, choice.id, {
                    label: choice.label,
                    description: choice.description,
                  }),
                undoFailure,
              );
            }, rowId(choice));
          },
        );
      },
      move: (choice, after) => {
        move(choice, after);
      },
      setRetired,
      remove: (choice) => {
        const previous = previousOf(list, choice);
        changeList(
          list,
          (current) => ({
            ...current,
            choices: current.choices.filter((other) => other.id !== choice.id),
          }),
          () => deleteChoice(list.id, choice.id),
          `Fathom could not remove ${choice.label}.`,
          () => {
            done(`Removed ${choice.label}.`, () => {
              changeList(
                list,
                (current) => ({
                  ...current,
                  choices: reordered(current.choices, choice, previous),
                }),
                async () => {
                  const added = await addChoices(list.id, [
                    { label: choice.label, description: choice.description },
                  ]);
                  for (const { id } of added) {
                    await moveChoice(list.id, id, previous);
                    if (choice.retired) {
                      await setChoiceRetired(list.id, id, true);
                    }
                  }
                },
                undoFailure,
              );
            });
          },
        );
      },
    };
  };

  const retireList = (list: List) => {
    setOpened(false);
    const retired = !list.retired;
    changeList(
      list,
      (current) => ({ ...current, retired }),
      () => setListRetired(list.id, retired),
      `Fathom could not ${retired ? "retire" : "restore"} ${list.name}.`,
      () => {
        done(`${retired ? "Retired" : "Restored"} ${list.name}.`, () => {
          changeList(
            list,
            (current) => ({ ...current, retired: list.retired }),
            () => setListRetired(list.id, list.retired),
            undoFailure,
          );
        });
      },
    );
  };

  // Making a deleted list again, with its choices in order, as undoing the deletion does.
  const recreate = async (list: List) => {
    const again = await createList({
      name: list.name,
      description: list.description,
      visibility: list.visibility,
    });
    if (list.choices.length > 0) {
      const added = await addChoices(
        again.id,
        list.choices.map(({ label, description }) => ({ label, description })),
      );
      const retired = list.choices.flatMap((choice, index) =>
        choice.retired ? added.slice(index, index + 1) : [],
      );
      for (const { id } of retired) {
        await setChoiceRetired(again.id, id, true);
      }
    }
    if (list.retired) await setListRetired(again.id, true);
    openList(again);
  };

  const removeList = (list: List) => {
    setOpened(false);
    closePanel();
    focusSoon(newListId);
    // Undoing makes the list as it was when deleted, including changes saved since the dialog opened.
    let deleted = list;
    change.mutate({
      next: (current) => {
        deleted = [
          ...current.filter((other) => other.id === list.id),
          list,
        ][0] as List;
        return current.filter((other) => other.id !== list.id);
      },
      save: () => deleteList(list.id),
      failure: `Fathom could not delete ${list.name}.`,
      onSaved: () => {
        done(`Deleted ${list.name}.`, () => {
          change.mutate({
            next: (current) => current,
            save: () => recreate(deleted),
            failure: undoFailure,
          });
        });
      },
    });
  };

  const saved = (list: List, before?: List) => {
    setOpened(false);
    // The dialog saved the list itself, so the page shows it at once, then reloads the lists once no
    // other change is saving.
    change.mutate({
      next: (current) => [
        ...current.filter((other) => other.id !== list.id),
        list,
      ],
      save: () => Promise.resolve(),
      failure: "",
    });
    if (before === undefined) {
      undoable(() => {
        removeList(list);
      });
      openList(list);
      focusSoon(entryNameId);
      return;
    }
    undoable(() => {
      changeList(
        list,
        () => before,
        () =>
          updateList(list.id, {
            name: before.name,
            description: before.description,
            visibility: before.visibility,
          }),
        undoFailure,
      );
    });
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
      closePanel();
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
            onClose={closePanel}
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
