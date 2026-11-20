// SPDX-License-Identifier: Apache-2.0

// The Lists page: every list in one table, and the selected list's choices in a side panel.

import { LoadProblem } from "./load-problem.tsx";
import {
  type Choice,
  type ChoiceRequest,
  type DraftKind,
  type List,
  matchesWords,
  type Permission,
  searchWords,
  type Show,
  type Tier,
  parseRecordKey,
} from "@fathom/shared";
import {
  Button,
  Group,
  Loader,
  Modal,
  Paper,
  SegmentedControl,
  Stack,
  Text,
} from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { type MouseEvent, type ReactNode, useState } from "react";
import { DecisionModal } from "./decision-dialog.tsx";
import {
  approvesAll,
  decidable,
  type DraftSelection,
  draftTotal,
  noDrafts,
  waitsForRejected,
} from "./drafts.ts";
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
  listMark,
  type ListDraftActions,
  selectionOf,
} from "./list-drafts.tsx";
import {
  ListFacts,
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
  isKind,
  type ListDraftTarget,
  builtInFirst,
  type ListKind,
  listKindName,
  listKindSchema,
  listsQuery,
  liveLists,
  listRefusal,
  moveChoice,
  resubmitListDraft,
  retiredLive,
  setChoiceRetired,
  setListRetired,
  updateChoice,
} from "./lists.ts";
import { peopleQuery } from "./people.ts";
import { PageHeader } from "./page-header.tsx";
import { sidePanelScroll, WithSidePanel } from "./side-panel.tsx";
import classes from "./pages.module.css";
import { useSaving } from "./saving.ts";
import { count } from "./numbers.ts";
import {
  besideLive,
  DraftedValue,
  DraftView,
  LiveValue,
  recordMark,
  useBesideLive,
} from "./status-mark.tsx";
import {
  LivePartsCell,
  LiveSummaryName,
  PartsCell,
  SummaryName,
  SummaryRow,
} from "./summary-row.tsx";
import { originalOf } from "./record-drafts.ts";
import { DecideAllItems, DraftMenu, TableSearch } from "./table-controls.tsx";

const newListId = "list-new";
const listPanelId = "list-panel";

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

// What a list's row shows of the list itself, each marked by its own dot where a draft changes it.
const listRowFields = new Set(["name", "description"]);

function ListsTable({
  lists,
  selected,
  search: address,
  originalOf,
  onOpen,
}: {
  lists: List[];
  selected: string | undefined;
  // The page address's search, kept as lists are opened.
  search: { show?: Show; search?: string };
  // The list with every draft, whatever the view, which its marks are worked out from, so the Draft
  // view decides how they show.
  originalOf: (list: List) => List;
  onOpen: (list: List) => void;
}) {
  const [showRetired, setShowRetired] = useState(false);
  const showLive = useBesideLive();
  // Beside live, a list a draft retires or restores stays where it is live until approved, as one a
  // draft removes stays, struck through.
  const isRetired = (list: List) =>
    showLive ? retiredLive(list) : list.retired;
  const current = builtInFirst(lists.filter((list) => !isRetired(list)));
  const retired = builtInFirst(lists.filter(isRetired));
  // A choice drafted to be removed is struck through, as in the panel, and not counted.
  const removed = (choice: List["choices"][number]) =>
    choice.draft?.action === "deleted";
  const row = (list: List) => {
    const offered = list.choices.filter((choice) => !choice.retired);
    const original = originalOf(list);
    const mark = listMark(original);
    // The list as it is live, under a list whose draft, or whose choices' drafts, change it, as a
    // person's live row is under their draft row: every cell, so like is compared with like.
    const [live] = liveLists([list]);
    const liveOffered = (live?.choices ?? []).filter(
      (choice) => !choice.retired,
    );
    // The list's own draft, marked in the row's slot only where it changes what the row does not
    // show, such as retiring the list, and its choices' and order's drafts, marked before the
    // choices, so each mark is before what changed.
    const slotMark =
      recordMark(original.draft, listRowFields) === undefined
        ? undefined
        : listMark({
            ...original,
            orderDraft: undefined,
            choices: original.choices.map((choice) => ({
              ...choice,
              draft: undefined,
            })),
          });
    const choicesChanged = listMark({ ...original, draft: undefined });
    const choiceParts = offered.map((choice) => ({
      id: choice.id,
      name: choice.label,
      removed: removed(choice),
    }));
    return (
      <SummaryRow
        key={list.id}
        selected={list.id === selected}
        retired={list.retired}
        tint={
          mark === undefined ? undefined : (list.draft ?? { action: "changed" })
        }
        rowProps={{ "data-list-row": "" }}
        onOpen={() => {
          onOpen(list);
        }}
        liveCells={
          live !== undefined &&
          mark !== undefined &&
          list.draft?.action !== "deleted" ? (
            <>
              <LiveSummaryName
                marked={slotMark !== undefined}
                draft={list.draft}
              >
                {live.name}
              </LiveSummaryName>
              <span role="cell" className={classes.listCellDim}>
                <LiveValue
                  draft={list.draft}
                  fields={["description"]}
                  emptied={live.description === "" ? "Description" : undefined}
                >
                  {live.description}
                </LiveValue>
              </span>
              <LivePartsCell
                marked={choicesChanged !== undefined}
                names={liveOffered.map((choice) => choice.label)}
              />
            </>
          ) : undefined
        }
      >
        <SummaryName
          mark={
            slotMark && {
              ...slotMark,
              unpublished: original.draft?.unpublished,
            }
          }
          draft={original.draft}
          unpublished={mark === undefined && original.draft?.unpublished}
          heldBy={list.heldBy}
          dataClass={list.visibility}
          facts={<ListFacts list={list} />}
        >
          <Link
            id={linkId(list)}
            to="/lists/{-$listId}"
            params={{ listId: list.id }}
            search={address}
            className={classes.listLink}
          >
            {list.name}
          </Link>
        </SummaryName>
        <span role="cell" className={classes.listCellDim}>
          <DraftedValue
            draft={original.draft}
            fields={["description"]}
            named="Description"
            emptied={list.description === "" ? "Description" : undefined}
          >
            {list.description}
          </DraftedValue>
        </span>
        <PartsCell mark={choicesChanged} parts={choiceParts} />
      </SummaryRow>
    );
  };
  return (
    <Paper withBorder className={classes.tablePanel}>
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
        </div>
      )}
    </Paper>
  );
}

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
  show = "both",
  onShow,
  search = "",
  onSearch,
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
  // Which version of each list and choice shows: the draft beside the live one, the draft alone, or
  // the live one alone, which is read only.
  show?: Show;
  onShow?: (show: Show) => void;
  // Words a list's name, description, or choices must all hold to be shown, ignoring case and
  // accents, as on the People table.
  search?: string;
  onSearch?: (search: string, replace: boolean) => void;
  kind?: ListKind;
  onKind?: (kind: ListKind) => void;
  // The role's permissions, which decide whether and to which classes a list may be moved.
  permissions?: readonly Permission[];
}) {
  const canEdit = mayEdit && show !== "live";
  // What to show, the search, and which lists, stay in the address as lists are opened and closed.
  const showSearch = {
    ...(show === "both" ? {} : { show }),
    ...(search === "" ? {} : { search }),
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
    focusSoon(isKind(list, kind) ? linkId(list) : kindOptionId(kind));
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
  // its draft is approved.
  const removeList = (list: List) => {
    closeDialog();
    if (list.draft?.action !== "created") {
      changeList(
        list,
        (current) => drafting(current, [], "deleted"),
        () => deleteList(list.id),
        `Fathom could not remove ${list.name}.`,
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
        "[data-list-row], [data-list-panel], [data-side-panel], button, a",
      )
    ) {
      closePanel(open);
    }
  };

  // The lists of the kind chosen whose name, description, or choices hold every word searched for,
  // or, where the search is a list's key, that list.
  const words = searchWords(search);
  const searchedKey = parseRecordKey(search);
  const shownLists = lists.filter(
    (list) =>
      isKind(list, kind) &&
      (searchedKey === undefined
        ? matchesWords(
            [
              list.name,
              list.description,
              ...list.choices.map(
                ({ label, description }) => `${label} ${description}`,
              ),
            ].join(" "),
            words,
          )
        : searchedKey.kind === "list" &&
          searchedKey.keyNumber === list.keyNumber),
  );

  // Every draft waiting among the lists shown, which Approvers approve or reject all at once, with
  // the drafts that approving them uses, or that use them.
  const waiting = canApprove
    ? waitingIn(shownLists)
    : { selection: noDrafts(), total: 0 };
  const decideAll = (asking: "approve" | "reject") => {
    setDecision(
      decisionFor(asking, waiting.selection, approves, all, people.data, true),
    );
    setDeciding(true);
  };

  let content: ReactNode;
  if (query.isPending) {
    content = <Loader role="status" aria-label="Loading" />;
  } else if (query.isError) {
    content = (
      <LoadProblem what="the lists" onRetry={() => void query.refetch()} />
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
              // Leaving needs an empty search, but the switch can still leave no list to focus.
              onLeave={() => {
                const first = shownLists.at(0);
                if (first !== undefined) focusSoon(linkId(first));
              }}
            />
          )}
          {onKind && (
            <SegmentedControl
              aria-label="Which lists"
              name={kindName}
              value={kind}
              onChange={(chosen) => {
                onKind(listKindSchema.parse(chosen));
              }}
              data={listKindSchema.options.map((option) => ({
                value: option,
                label: listKindName(option),
              }))}
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
            {searchWords(search).length > 0 || kind !== "all"
              ? `${count(shownLists.length)} of ${count(lists.length)}`
              : `${count(lists.length)} ${lists.length === 1 ? "list" : "lists"}`}
          </Text>
        </Group>
        <div className={sidePanelScroll}>
          <ListsTable
            lists={shownLists}
            selected={listId}
            search={showSearch}
            originalOf={(list) => originalOf(drafted, list)}
            onOpen={openList}
          />
        </div>
      </>
    );
  }

  return (
    <Stack gap="md" className={classes.tablePage} onClick={onPageClick}>
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
      <DraftView show={show}>
        <WithSidePanel
          storageKey="fathom-record-panel-width"
          panels={
            open
              ? [
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
                          canEdit={canEdit}
                          canApprove={canApprove}
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
                ]
              : []
          }
        >
          {content}
        </WithSidePanel>
      </DraftView>
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
