// SPDX-License-Identifier: Apache-2.0

// The Lists page: every list in one table, with its description and its choices in order, and the
// selected list in a side panel at its own address, where its choices are kept. Users who may edit
// planning configuration create, edit, retire, restore, and delete lists, and change choices from
// the keyboard. Every change is a draft, shown in place with its mark, which Approvers approve or
// reject here or on the Drafts page. Every change shows at once and saves in the background, one at
// a time in the order made. The latest change can be undone with Cmd+Z or Ctrl+Z, or from its
// notification when it took something out of view.

import {
  type Choice,
  type ChoiceRequest,
  type List,
  matchesWords,
  searchWords,
  type Show,
} from "@fathom/shared";
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
import { Fragment, type MouseEvent, type ReactNode, useState } from "react";
import { DecisionModal } from "./decision-dialog.tsx";
import {
  decidable,
  type Decision,
  decisionFor,
  type DraftSelection,
  draftTotal,
  noDrafts,
  waitsForRejected,
} from "./drafts.ts";
import { focusSoon } from "./focus.ts";
import { ListDialog } from "./list-dialog.tsx";
import {
  drafting,
  draftName,
  type DraftOn,
  draftRowClass,
  listMark,
  type ListDraftActions,
  selectionOf,
} from "./list-drafts.tsx";
import {
  type ChoiceActions,
  entryNameId,
  ListPanel,
  rowId,
  titleId,
} from "./list-panel.tsx";
import {
  addChoices,
  deleteChoice,
  deleteList,
  discardListDraft,
  draftedLists,
  type ListDraftTarget,
  listsQuery,
  liveLists,
  moveChoice,
  resubmitListDraft,
  retiredLive,
  setChoiceRetired,
  setListRetired,
  updateChoice,
} from "./lists.ts";
import { PageHeader } from "./page-header.tsx";
import classes from "./pages.module.css";
import { useSaving } from "./saving.ts";
import { count } from "./numbers.ts";
import {
  type DraftLike,
  DraftMark,
  HoldMarks,
  StatusMark,
} from "./status-mark.tsx";
import { DecideAllItems, DraftMenu, TableSearch } from "./table-controls.tsx";

const newListId = "list-new";

const linkId = (list: { id: string }) => `list-link-${list.id}`;

type Dialog = { kind: "new" } | { kind: "edit"; list: List };

// The drafts waiting for approval among the lists given: of lists, choices, and orders.
function waitingIn(lists: readonly List[]): {
  selection: DraftSelection;
  total: number;
} {
  const selection: DraftSelection = {
    ...noDrafts(),
    lists: lists.filter(decidable).map(({ id }) => id),
    choices: lists.flatMap((list) =>
      list.choices.filter(decidable).map(({ id }) => id),
    ),
    orders: lists
      .filter((list) =>
        decidable({ draft: list.orderDraft, heldBy: list.orderHeldBy }),
      )
      .map(({ id }) => id),
  };
  return { selection, total: draftTotal(selection) };
}

// A record without one of its optional fields, such as its draft.
function without<Record extends object>(
  record: Record,
  field: keyof Record,
): Record {
  return Object.fromEntries(
    Object.entries(record).filter(([key]) => key !== field),
  ) as Record;
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

function ListsTable({
  lists,
  selected,
  showLive,
  search: address,
  markOf,
  onOpen,
}: {
  lists: List[];
  selected: string | undefined;
  // The page address's search, kept as lists are opened.
  search: { show?: Show; search?: string };
  // Whether a list a draft changes shows its live row under it.
  showLive: boolean;
  // The mark beside a list, worked out from its drafts before any are taken back or left out.
  markOf: (list: List) => DraftLike | undefined;
  onOpen: (list: List) => void;
}) {
  const [showRetired, setShowRetired] = useState(false);
  // Beside live, a list a draft retires or restores stays where it is live until approved, as one a
  // draft removes stays, struck through.
  const isRetired = (list: List) =>
    showLive ? retiredLive(list) : list.retired;
  const current = lists.filter((list) => !isRetired(list));
  const retired = lists.filter(isRetired);
  // A choice drafted to be removed is struck through, as in the panel, and not counted.
  const removed = (choice: List["choices"][number]) =>
    choice.draft?.action === "deleted";
  const row = (list: List) => {
    const offered = list.choices.filter((choice) => !choice.retired);
    const mark = markOf(list);
    // The list as it is live, under a list whose draft, or whose choices' drafts, change it, as a
    // person's live row is under their draft row: every cell, so like is compared with like.
    const [live] = liveLists([list]);
    const liveOffered = (live?.choices ?? []).filter(
      (choice) => !choice.retired,
    );
    const liveRow =
      showLive &&
      live !== undefined &&
      mark !== undefined &&
      list.draft?.action !== "deleted" ? (
        <div
          key={`live-${list.id}`}
          role="row"
          aria-hidden="true"
          className={[classes.listRow, classes.listLiveRow].join(" ")}
        >
          <span role="cell" className={classes.listCellName}>
            {live.name}
            <StatusMark tone="live" spaced>
              Live
            </StatusMark>
          </span>
          <span role="cell" className={classes.listCellDim}>
            {live.description}
          </span>
          <span role="cell" className={classes.listCell}>
            <span className={classes.listCount}>({liveOffered.length})</span>{" "}
            {liveOffered.map((choice) => choice.label).join(", ")}
          </span>
        </div>
      ) : null;
    return (
      <Fragment key={list.id}>
        <div
          key={list.id}
          role="row"
          data-list-row
          aria-current={list.id === selected ? "true" : undefined}
          className={[
            classes.listRow,
            list.id === selected ? classes.listRowSelected : "",
            list.retired ? classes.listRowRetired : "",
            mark === undefined
              ? ""
              : draftRowClass(list.draft ?? { action: "changed" }),
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
              search={address}
              className={classes.listLink}
            >
              {list.name}
            </Link>
            {/* The row's mark sums up the list and its choices, so it carries the list's own
                unpublished changes; without one, as when Drafts only leaves out a rejected
                draft, they are marked on their own. */}
            {mark && (
              <DraftMark
                draft={{ ...mark, unpublished: list.draft?.unpublished }}
              />
            )}
            <HoldMarks
              unpublished={mark === undefined && list.draft?.unpublished}
              heldBy={list.heldBy}
            />
          </span>
          <span role="cell" className={classes.listCellDim}>
            {list.description}
          </span>
          <span role="cell" className={classes.listCell}>
            <span className={classes.listCount}>
              ({offered.filter((choice) => !removed(choice)).length})
            </span>{" "}
            {offered.map((choice, index) => (
              <Fragment key={choice.id}>
                {index > 0 && ", "}
                {removed(choice) ? (
                  <span className={classes.struck}>{choice.label}</span>
                ) : (
                  choice.label
                )}
              </Fragment>
            ))}
          </span>
        </div>
        {liveRow}
      </Fragment>
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
        {lists.length === 0 && (
          <div role="row" className={classes.listGroup}>
            <span role="cell" aria-colspan={3}>
              No matching lists
            </span>
          </div>
        )}
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
              : `Show retired (${count(retired.length)})`}
          </Button>
        </div>
      )}
    </Paper>
  );
}

export function ListsPage({
  listId,
  canEdit: mayEdit,
  canApprove: mayApprove,
  show = "both",
  onShow,
  search = "",
  onSearch,
}: {
  listId: string | undefined;
  canEdit: boolean;
  canApprove: boolean;
  // Which version of each list and choice shows: the draft beside the live one, the draft alone, or
  // the live one alone, which is read only.
  show?: Show;
  onShow?: (show: Show) => void;
  // Words a list's name, description, or choices must all hold to be shown, ignoring case and
  // accents, as on the People table.
  search?: string;
  onSearch?: (search: string, replace: boolean) => void;
}) {
  const canEdit = mayEdit && show !== "live";
  // What to show, and the search, stay in the address as lists are opened and closed.
  const showSearch = {
    ...(show === "both" ? {} : { show }),
    ...(search === "" ? {} : { search }),
  };
  const canApprove = mayApprove && show !== "live";
  const query = useQuery(listsQuery);
  const narrow = useMediaQuery("(max-width: 48em)");
  const navigate = useNavigate();
  // The dialog stays set while it closes, so its content does not vanish mid-animation.
  const [dialog, setDialog] = useState<Dialog>();
  const [opened, setOpened] = useState(false);
  const [busy, setBusy] = useState(false);
  // Approving or rejecting drafts, which asks first.
  const [decision, setDecision] = useState<Decision>();
  const [deciding, setDeciding] = useState(false);
  const { save, undoable, done } = useSaving<List[]>({
    queryKey: listsQuery.queryKey,
    removed: "Someone else has removed this. The lists have been refreshed.",
    blocked: opened || deciding,
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

  const openList = (list: List) => {
    void navigate({
      to: "/lists/{-$listId}",
      params: { listId: list.id },
      search: showSearch,
    });
  };
  // Closing the panel puts focus back on the list's row in the table.
  const closePanel = (list: List) => {
    focusSoon(linkId(list));
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
          choices: current.choices.map((other) =>
            other.id === choice.id
              ? drafting({ ...other, ...request }, ["label", "description"])
              : other,
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

  const retireList = (list: List) => {
    setOpened(false);
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
  // its draft is approved.
  const removeList = (list: List) => {
    setOpened(false);
    if (list.draft?.action !== "created") {
      changeList(
        list,
        (current) => drafting(current, [], "deleted"),
        () => deleteList(list.id),
        `Fathom could not delete ${list.name}.`,
        { focus: titleId },
      );
      focusSoon(titleId);
      return;
    }
    closePanel(list);
    focusSoon(newListId);
    save({
      next: (current) => current.filter((other) => other.id !== list.id),
      save: () => deleteList(list.id),
      failure: `Fathom could not delete ${list.name}.`,
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
        : withList(current, what.list.id, (list) => without(list, "draft"));
    }
    return withList(current, what.list.id, (list) => {
      if (what.kind === "order") return without(list, "orderDraft");
      return {
        ...list,
        choices:
          what.choice.draft?.action === "created"
            ? list.choices.filter((other) => other.id !== what.choice.id)
            : list.choices.map((other) =>
                other.id === what.choice.id ? without(other, "draft") : other,
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
        onSaved: (changeSetId, before) => {
          undoable(changeSetId, before);
        },
      });
    },
    decide: (asking, what) => {
      // Every list, with its rejected drafts, whatever is shown, so a draft that depends on one waits.
      setDecision(decisionFor(asking, selectionOf(what), all));
      setDeciding(true);
    },
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

  // The lists whose name, description, or choices hold every word searched for.
  const words = searchWords(search);
  const shownLists = lists.filter((list) =>
    matchesWords(
      [
        list.name,
        list.description,
        ...list.choices.map(
          ({ label, description }) => `${label} ${description}`,
        ),
      ].join(" "),
      words,
    ),
  );

  // Every draft waiting among the lists shown, which Approvers approve or reject all at once, with
  // the drafts that approving them uses, or that use them.
  const waiting = canApprove
    ? waitingIn(shownLists)
    : { selection: noDrafts(), total: 0 };
  const decideAll = (asking: "approve" | "reject") => {
    setDecision(decisionFor(asking, waiting.selection, all));
    setDeciding(true);
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
    content = (
      <>
        {/* Laid out as the People table's bar: the search, the Draft button, then how many rows
            there are. */}
        <Group gap="sm">
          {onSearch && (
            <TableSearch
              label="Search lists"
              value={search}
              onChange={onSearch}
              // Leaving needs an empty search, which shows every list, and there is at least one.
              onLeave={() => {
                focusSoon(linkId(shownLists[0] as List));
              }}
            />
          )}
          {onShow && (
            <DraftMenu show={show} onShow={onShow}>
              {waiting.total > 0 && (
                <DecideAllItems
                  total={waiting.total}
                  everywhere={waitingIn(all).total}
                  onDecide={decideAll}
                />
              )}
            </DraftMenu>
          )}
          <Text fz="sm" c="dimmed" role="status">
            {searchWords(search).length > 0
              ? `${count(shownLists.length)} of ${count(lists.length)}`
              : `${count(lists.length)} ${lists.length === 1 ? "list" : "lists"}`}
          </Text>
        </Group>
        <ListsTable
          lists={shownLists}
          selected={listId}
          showLive={show === "both"}
          search={showSearch}
          markOf={(list) =>
            show === "live"
              ? undefined
              : listMark(drafted.get(list.id) as List, show === "drafts")
          }
          onOpen={openList}
        />
      </>
    );
  }

  return (
    <Stack gap="md" onClick={onPageClick}>
      <PageHeader
        title="Lists"
        action={
          <Group gap="xs">
            {canEdit && (
              <Button
                id={newListId}
                onClick={() => {
                  openDialog({ kind: "new" });
                }}
              >
                New list
              </Button>
            )}
          </Group>
        }
      />
      {content}
      {open && (
        <div data-list-panel>
          <ListPanel
            key={open.id}
            list={open}
            canEdit={canEdit}
            canApprove={canApprove}
            showLive={show === "both"}
            waits={(selection) => waitsForRejected(selection, all)}
            draftActions={draftActions}
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
