// SPDX-License-Identifier: Apache-2.0

// The Releases page: a timeline of every release stream, above a table of them all, with how its
// cycles are made now and its releases, and the selected stream in a side panel at its own
// address, as the Lists page does with lists. The panel holds the stream's changes of cycles, its
// releases, and its cycles, worked out at least two years ahead, each with its share of the months
// it spans and a menu to change its length. Those who edit planning configuration add, rename,
// retire, and restore streams and change their cycles; those who edit the plan make releases from
// consecutive cycles, and write each release's note in a side panel above the stream's, opened from
// the release's name, a link once it has a note. Every change is a draft, shown in place with its
// mark, which its makers discard or resubmit, and Approvers approve or reject, here or on the
// Drafts page, from each record's menu.

import { RecordMenu, type RecordMenuActions } from "./record-menu.tsx";
import {
  type Cycle,
  type CyclePattern,
  type DraftKind,
  lastStartOf,
  type RecordDraft,
  type RecordRef,
  type Release,
  type ReleaseStream,
} from "@fathom/shared";
import {
  ActionIcon,
  Alert,
  Anchor,
  Button,
  FocusTrap,
  Group,
  Loader,
  Menu,
  Modal,
  Stack,
  Table,
  Text,
  VisuallyHidden,
} from "@mantine/core";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import {
  type MouseEvent,
  type ReactElement,
  type ReactNode,
  useEffect,
  useState,
} from "react";
import { describeProblem } from "./api.ts";
import { DecisionModal } from "./decision-dialog.tsx";
import { type Decision, decisionFor, noDrafts } from "./drafts.ts";
import { focusSoon } from "./focus.ts";
import { Icon } from "./icons.tsx";
import { NotePanel } from "./note-editor.tsx";
import { notifyFailure, notifySuccess } from "./notices.tsx";
import { PageHeader } from "./page-header.tsx";
import classes from "./pages.module.css";
import type { RecordNode } from "./record-drafts.ts";
import {
  CycleLengthDialog,
  CyclesUntilDialog,
  EndsDialog,
  PatternDialog,
  ReleaseDialog,
  StreamDialog,
} from "./release-dialogs.tsx";
import {
  discardRecordDraft,
  markedDraft,
  patternRowFields,
  releaseRowFields,
  slotDraft,
  streamRowFields,
  draftsById,
  streamsShown,
  recordNodes,
  includesCycle,
  keptReleases,
  releaseCycles,
  releaseDate,
  shipsOffCycle,
  shownColour,
  releaseStreamsQuery,
  removeFromStream,
  resubmitRecordDraft,
  type SavedStream,
  saveReleaseNote,
  setStreamRetired,
} from "./releases.ts";
import { Swatch } from "./colour-swatch.tsx";
import { actionsFor, MoreButton } from "./row-controls.tsx";
import { useNarrow } from "./side-panel.tsx";
import {
  focusRecordCell,
  noRecordActions,
  RecordGrid,
  undoDrafts,
} from "./record-grid.tsx";
import {
  DraftedItem,
  DraftedValue,
  EndedBox,
  FactBox,
  LiveRowMarks,
  LiveValue,
  RowMarks,
} from "./status-mark.tsx";
import { RowWithLive } from "./summary-row.tsx";
import { unpublishedQuery } from "./unpublished.tsx";
import { TimelineView } from "./timeline-view.tsx";
import { today } from "./today.ts";
import type { ChangeView, ViewChoice } from "./table-controls.tsx";
import { useSavedViews } from "./saved-views.tsx";
import { formatDay, type View } from "./table-view.ts";
import { TableTips } from "./table-tips.tsx";
import {
  patternWords,
  shownUnlessRetired,
  streamColumnOrder,
  type StreamRow,
  streamRows,
  streamTable,
} from "./stream-table.tsx";
import { planNodes, projectPlanQuery } from "./projects.ts";

type Dialog =
  | { kind: "stream"; stream?: ReleaseStream }
  | { kind: "pattern"; stream: ReleaseStream; pattern?: CyclePattern }
  | { kind: "cycles-until"; stream: ReleaseStream }
  | { kind: "ends"; stream: ReleaseStream }
  | { kind: "cycle-length"; stream: ReleaseStream; cycle: Cycle }
  | { kind: "release"; stream: ReleaseStream; release?: Release };

const panelId = "release-stream-panel";
const panelTitleId = "release-stream-panel-title";
const noteId = "release-note";
const timelineZoomKey = "fathom-releases-timeline-zoom";
const noteButtonId = (release: { id: string }) =>
  `release-note-button-${release.id}`;
const menuId = (release: { id: string }) => `release-menu-${release.id}`;

// Puts focus on a release's name, when it opens its note, or otherwise its menu.
function focusRelease(release: { id: string }) {
  setTimeout(() => {
    (
      document.getElementById(noteButtonId(release)) ??
      document.querySelector<HTMLElement>(
        `[data-record-menu="${menuId(release)}"]`,
      )
    )?.focus();
  }, 0);
}

const dialogTitle = (dialog: Dialog): string => {
  if (dialog.kind === "stream") {
    return dialog.stream === undefined
      ? "New release stream"
      : `Rename ${dialog.stream.name}`;
  }
  if (dialog.kind === "cycles-until") {
    return `Change how far ahead ${dialog.stream.name}'s cycles are made`;
  }
  if (dialog.kind === "ends") {
    return `Change when ${dialog.stream.name} ends`;
  }
  if (dialog.kind === "cycle-length") {
    return `Change the length of ${dialog.cycle.name}`;
  }
  if (dialog.kind === "pattern") {
    return dialog.pattern === undefined
      ? dialog.stream.patterns.length === 0
        ? `Set up cycles for ${dialog.stream.name}`
        : `Change the length or names of ${dialog.stream.name}'s cycles`
      : `Cycles from ${formatDay(dialog.pattern.startsOn)}`;
  }
  return dialog.release === undefined
    ? `New release in ${dialog.stream.name}`
    : `Change ${dialog.release.name}`;
};

const monthFormat = new Intl.DateTimeFormat("en", {
  month: "short",
  timeZone: "UTC",
});

// A cycle's months, with the share of each it covers when that is not all of it, and the year on
// the first month and wherever it changes, such as "Dec 2027 90%, Jan 2028, Feb".
function monthsInWords(months: readonly { month: string; share: number }[]) {
  return months
    .map(({ month, share }, at) => {
      const year = month.slice(0, 4);
      const name = monthFormat.format(new Date(`${month}-01T00:00:00Z`));
      const named =
        at === 0 || months[at - 1]?.month.slice(0, 4) !== year
          ? `${name} ${year}`
          : name;
      return share >= 0.9995
        ? named
        : `${named} ${String(Math.round(share * 100))}%`;
    })
    .join(", ");
}

// The day a release ships, or None while its last cycle is not made, as an empty value in a panel
// reads.
const shipDay = (stream: ReleaseStream, release: Release) => {
  const day = releaseDate(stream, release);
  return day === undefined ? "None" : formatDay(day);
};

// What can be done on the page, for the menus to offer.
interface Actions extends RecordMenuActions {
  // A record's draft, whatever the view, which its marks are worked out from, so the Draft view
  // decides how they show.
  draftOf: (id: string) => RecordDraft | undefined;
  canEditStreams: boolean;
  canEditReleases: boolean;
  open: (dialog: Dialog) => void;
  openNote: (stream: ReleaseStream, release: Release) => void;
  run: (work: () => Promise<unknown>, done: string) => void;
}

const nodeOf = (
  actions: Actions,
  type: RecordRef["type"],
  id: string,
): RecordNode =>
  actions.nodes.find(
    ({ ref }) => ref.type === type && ref.id === id,
  ) as RecordNode;

// A row of a panel's section, with, beside live, the record as it is live in a row under it, while a
// draft changes it.
function PanelRow({
  draft,
  liveRow,
  children,
}: {
  draft: RecordDraft | undefined;
  liveRow: ReactElement | undefined;
  children: ReactNode;
}) {
  return (
    <RowWithLive
      className={classes.recordRow}
      liveClassName={classes.recordRow}
      tint={draft}
      liveCells={draft?.action === "changed" ? liveRow : undefined}
    >
      {children}
    </RowWithLive>
  );
}

// A section of the panel: its heading, its rows, and the action that adds to it.
function Section({
  title,
  children,
  add,
}: {
  title: string;
  children: ReactNode;
  add?: { label: string; onClick: () => void } | undefined;
}) {
  return (
    <section className={classes.panelSection} aria-label={title}>
      <Text component="h3" fz="sm" fw={600} mb={4} mt={0}>
        {title}
      </Text>
      {children}
      {add && (
        <Button
          variant="default"
          size="compact-sm"
          mt={4}
          leftSection={<Icon name="plus" size={14} />}
          onClick={add.onClick}
        >
          {add.label}
        </Button>
      )}
    </section>
  );
}

function Patterns({
  stream,
  actions,
}: {
  stream: ReleaseStream;
  actions: Actions;
}) {
  const editable = actions.canEditStreams && stream.heldBy === undefined;
  return (
    <Section
      title="Cycle schedule"
      add={
        editable && stream.patterns.length === 0
          ? {
              label: "Set up cycles…",
              onClick: () => {
                actions.open({ kind: "pattern", stream });
              },
            }
          : undefined
      }
    >
      {stream.patterns.length === 0 && (
        <Text fz="sm" c="dimmed">
          None
        </Text>
      )}
      <div className={classes.recordRows}>
        {stream.patterns.map((pattern) => {
          const node = nodeOf(actions, "cycle-pattern", pattern.id);
          const changeable =
            actions.canEditStreams &&
            pattern.heldBy === undefined &&
            pattern.draft?.action !== "deleted";
          const draft = actions.draftOf(pattern.id);
          const slot = slotDraft(draft, patternRowFields);
          const [live] = undoDrafts([pattern], () => true);
          return (
            <PanelRow
              key={pattern.id}
              draft={pattern.draft}
              liveRow={
                live && (
                  <>
                    <span className={classes.figures}>
                      <LiveRowMarks marked={slot !== undefined}>
                        <LiveValue draft={pattern.draft} fields={["startsOn"]}>
                          From {formatDay(live.startsOn)}
                        </LiveValue>
                      </LiveRowMarks>
                    </span>
                    <span>
                      <LiveValue
                        draft={pattern.draft}
                        fields={["length", "unit", "naming"]}
                      >
                        {patternWords(live)}
                      </LiveValue>
                    </span>
                  </>
                )
              }
            >
              <span className={classes.figures}>
                <RowMarks mark={slot} heldBy={pattern.heldBy}>
                  <DraftedValue draft={draft} fields={["startsOn"]}>
                    From {formatDay(pattern.startsOn)}
                  </DraftedValue>
                </RowMarks>
              </span>
              <span>
                <DraftedValue
                  draft={draft}
                  fields={["length", "unit", "naming"]}
                >
                  {patternWords(pattern)}
                </DraftedValue>
              </span>
              <RecordMenu
                title={`Cycles from ${formatDay(pattern.startsOn)}`}
                node={node}
                canEditDraft={actions.canEditStreams}
                actions={actions}
              >
                {changeable ? (
                  <>
                    <Menu.Item
                      onClick={() => {
                        actions.open({ kind: "pattern", stream, pattern });
                      }}
                    >
                      Change…
                    </Menu.Item>
                    <Menu.Item
                      onClick={() => {
                        actions.run(
                          () =>
                            removeFromStream(stream.id, "patterns", pattern.id),
                          `Drafted removing the cycles from ${formatDay(pattern.startsOn)}.`,
                        );
                      }}
                    >
                      Remove
                    </Menu.Item>
                  </>
                ) : undefined}
              </RecordMenu>
            </PanelRow>
          );
        })}
      </div>
      <Group gap="xs" mih={36}>
        <Text fz="sm">
          {stream.endsOn === null ? "Cycles until" : "Ends"}{" "}
          <span className={classes.figures}>
            {formatDay(lastStartOf(stream))}
          </span>
        </Text>
      </Group>
      {editable && stream.patterns.length > 0 && (
        <Menu position="bottom-start">
          <Menu.Target>
            <Button variant="default" size="compact-sm" mt={4}>
              Change…
            </Button>
          </Menu.Target>
          <Menu.Dropdown>
            {stream.endsOn === null && (
              <Menu.Item
                onClick={() => {
                  actions.open({ kind: "cycles-until", stream });
                }}
              >
                Cycles until…
              </Menu.Item>
            )}
            <Menu.Item
              onClick={() => {
                actions.open({ kind: "ends", stream });
              }}
            >
              Ends…
            </Menu.Item>
            <Menu.Item
              onClick={() => {
                actions.open({ kind: "pattern", stream });
              }}
            >
              Length or names from a date…
            </Menu.Item>
          </Menu.Dropdown>
        </Menu>
      )}
    </Section>
  );
}

function Releases({
  stream,
  actions,
}: {
  stream: ReleaseStream;
  actions: Actions;
}) {
  return (
    <Section
      title="Releases"
      add={
        actions.canEditReleases && !stream.retired && stream.cycles.length > 0
          ? {
              label: "New release…",
              onClick: () => {
                actions.open({ kind: "release", stream });
              },
            }
          : undefined
      }
    >
      {stream.releases.length === 0 && (
        <Text fz="sm" c="dimmed">
          None
        </Text>
      )}
      <div className={classes.recordRows}>
        {stream.releases.map((release) => {
          const node = nodeOf(actions, "release", release.id);
          const changeable =
            actions.canEditReleases &&
            release.heldBy === undefined &&
            release.draft?.action !== "deleted";
          const draft = actions.draftOf(release.id);
          const slot = slotDraft(draft, releaseRowFields);
          const [live] = undoDrafts([release], () => true);
          const when = (shown: Release) => (
            <>
              {releaseCycles(stream, shown)}
              <Text span c="dimmed" fz="sm" className={classes.figures}>
                {" "}
                · ships {shipDay(stream, shown)}
                {shipsOffCycle(stream, shown) !== undefined && (
                  <Text span inherit fw={700}>
                    , {shipsOffCycle(stream, shown)}
                  </Text>
                )}
              </Text>
            </>
          );
          return (
            <PanelRow
              key={release.id}
              draft={release.draft}
              liveRow={
                live && (
                  <>
                    <span>
                      <LiveRowMarks marked={slot !== undefined}>
                        <LiveValue
                          draft={release.draft}
                          fields={["name", "colour"]}
                        >
                          <Swatch colour={shownColour(live.colour)} size={12} />
                          {live.name}
                        </LiveValue>
                      </LiveRowMarks>
                    </span>
                    <span>
                      <LiveValue
                        draft={release.draft}
                        fields={["firstCycle", "lastCycle", "shipsOn"]}
                      >
                        {when(live)}
                      </LiveValue>
                    </span>
                  </>
                )
              }
            >
              <span>
                <RowMarks mark={slot} heldBy={release.heldBy}>
                  <DraftedValue
                    draft={draft}
                    fields={["name", "colour"]}
                    named="Name"
                  >
                    <Swatch colour={shownColour(release.colour)} size={12} />
                    {release.note === null ? (
                      release.name
                    ) : (
                      <Anchor
                        component="button"
                        id={noteButtonId(release)}
                        className={classes.noteLink}
                        fz="inherit"
                        c="inherit"
                        aria-label={`${release.name} note`}
                        onClick={() => {
                          actions.openNote(stream, release);
                        }}
                      >
                        {release.name}
                      </Anchor>
                    )}
                  </DraftedValue>
                </RowMarks>
              </span>
              <span>
                <DraftedValue
                  draft={draft}
                  fields={["firstCycle", "lastCycle", "shipsOn"]}
                >
                  {when(release)}
                </DraftedValue>
              </span>
              <RecordMenu
                id={menuId(release)}
                title={release.name}
                node={node}
                canEditDraft={actions.canEditReleases}
                actions={actions}
              >
                {changeable ? (
                  <>
                    <Menu.Item
                      onClick={() => {
                        actions.open({ kind: "release", stream, release });
                      }}
                    >
                      Change…
                    </Menu.Item>
                    {release.note === null && (
                      <Menu.Item
                        onClick={() => {
                          actions.openNote(stream, release);
                        }}
                      >
                        Add note…
                      </Menu.Item>
                    )}
                    <Menu.Item
                      onClick={() => {
                        actions.run(
                          () =>
                            removeFromStream(stream.id, "releases", release.id),
                          `Drafted removing ${release.name}.`,
                        );
                      }}
                    >
                      Remove
                    </Menu.Item>
                  </>
                ) : undefined}
              </RecordMenu>
            </PanelRow>
          );
        })}
      </div>
    </Section>
  );
}

function Cycles({
  stream,
  actions,
}: {
  stream: ReleaseStream;
  actions: Actions;
}) {
  if (stream.cycles.length === 0) return null;
  const editable =
    actions.canEditStreams &&
    stream.heldBy === undefined &&
    stream.draft?.action !== "deleted";
  const kept = keptReleases(stream);
  const releaseOf = (startsOn: string) =>
    kept.find((release) => includesCycle(release, startsOn))?.name ?? "";
  return (
    <Section title={`Cycles (${String(stream.cycles.length)})`}>
      <Table.ScrollContainer minWidth={520} type="native">
        <Table fz="sm" verticalSpacing={4} horizontalSpacing="xs">
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Name</Table.Th>
              <Table.Th>Starts</Table.Th>
              <Table.Th>Ends</Table.Th>
              <Table.Th>Release</Table.Th>
              <Table.Th>Months</Table.Th>
              {editable && (
                <Table.Th>
                  <VisuallyHidden>Actions</VisuallyHidden>
                </Table.Th>
              )}
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {stream.cycles.map((cycle) => (
              <Table.Tr key={cycle.startsOn}>
                <Table.Td className={classes.cycleCell}>{cycle.name}</Table.Td>
                <Table.Td
                  className={[classes.figures, classes.cycleCell].join(" ")}
                >
                  {formatDay(cycle.startsOn)}
                </Table.Td>
                <Table.Td
                  className={[classes.figures, classes.cycleCell].join(" ")}
                >
                  {formatDay(cycle.endsOn)}
                </Table.Td>
                <Table.Td className={classes.cycleCell}>
                  {releaseOf(cycle.startsOn)}
                </Table.Td>
                <Table.Td className={classes.monthsCell}>
                  {monthsInWords(cycle.months)}
                </Table.Td>
                {editable && (
                  <Table.Td className={classes.cycleCell}>
                    <Menu position="bottom-end">
                      <Menu.Target>
                        <MoreButton size="sm" label={actionsFor(cycle.name)} />
                      </Menu.Target>
                      <Menu.Dropdown>
                        <Menu.Item
                          onClick={() => {
                            actions.open({
                              kind: "cycle-length",
                              stream,
                              cycle,
                            });
                          }}
                        >
                          Change length…
                        </Menu.Item>
                      </Menu.Dropdown>
                    </Menu>
                  </Table.Td>
                )}
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>
    </Section>
  );
}

// The selected stream, beside the table, as the Lists page shows a list.
function StreamPanel({
  stream,
  day,
  actions,
  narrow,
  waiting,
  onClose,
}: {
  stream: ReleaseStream;
  // Today, for whether the stream has ended.
  day: string;
  actions: Actions;
  narrow: boolean;
  // While a release's note is being changed, nothing in the stream changes, so nothing written is
  // lost.
  waiting: boolean;
  onClose: () => void;
}) {
  const node = nodeOf(actions, "release-stream", stream.id);
  // Opening a stream puts focus on its name in the panel.
  useEffect(() => {
    focusSoon(panelTitleId);
  }, [stream.id]);
  const editable =
    actions.canEditStreams &&
    stream.heldBy === undefined &&
    stream.draft?.action !== "deleted";
  return (
    <FocusTrap active={narrow}>
      <section
        id={panelId}
        inert={waiting}
        className={narrow ? classes.panelNarrow : classes.panel}
        aria-labelledby={panelTitleId}
        // Covering the page on a narrow screen, it holds focus until it is closed.
        {...(narrow ? { role: "dialog", "aria-modal": true } : {})}
        onKeyDown={(event) => {
          if (event.key === "Escape" && !event.defaultPrevented) onClose();
        }}
      >
        <div className={classes.panelHead}>
          <div className={classes.panelTitle}>
            <div className={classes.panelNameBlock}>
              <DraftedItem
                draft={slotDraft(
                  actions.draftOf(stream.id),
                  streamRowFields,
                  stream.retired,
                )}
                heldBy={stream.heldBy}
              >
                <DraftedValue
                  draft={actions.draftOf(stream.id)}
                  fields={["name"]}
                  named="Name"
                >
                  <h2
                    id={panelTitleId}
                    className={classes.panelName}
                    tabIndex={-1}
                  >
                    {stream.name}
                  </h2>
                </DraftedValue>
              </DraftedItem>
              {/* A draft retiring the stream says so in its own box. */}
              {stream.retired &&
                markedDraft(stream.draft, stream.retired)?.retiring ===
                  undefined && <FactBox>Retired</FactBox>}
              <EndedBox stream={stream} day={day} />
            </div>
            {editable && (
              <>
                <Button
                  variant="default"
                  size="compact-sm"
                  onClick={() => {
                    actions.open({ kind: "stream", stream });
                  }}
                >
                  Rename
                </Button>
                <Button
                  variant="default"
                  size="compact-sm"
                  onClick={() => {
                    actions.run(
                      () => setStreamRetired(stream.id, !stream.retired),
                      `Drafted ${stream.retired ? "restoring" : "retiring"} ${stream.name}.`,
                    );
                  }}
                >
                  {stream.retired ? "Restore" : "Retire"}
                </Button>
              </>
            )}
            {stream.draft && (
              <RecordMenu
                title={stream.name}
                node={node}
                canEditDraft={actions.canEditStreams}
                actions={actions}
              />
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
        </div>
        <div className={classes.panelBody}>
          <Patterns stream={stream} actions={actions} />
          <Releases stream={stream} actions={actions} />
          <Cycles stream={stream} actions={actions} />
        </div>
      </section>
    </FocusTrap>
  );
}

export function ReleasesPage({
  streamId,
  approves,
  view,
  onView,
  applied,
  onApply,
  canShareViews,
}: {
  // The stream open in the side panel, if any.
  streamId?: string | undefined;
  // The kinds of draft the user's role approves and rejects.
  approves: readonly DraftKind[];
  view: View;
  onView: ChangeView;
  // The saved view the view started from, as the address names it.
  applied: string | undefined;
  onApply: (view: View, id: string, replace?: boolean) => void;
  canShareViews: boolean;
}) {
  const { show } = view;
  const queryClient = useQueryClient();
  const query = useQuery(releaseStreamsQuery);
  // Drafts of features move with cycles; those who see only configuration are sent none.
  const plan = useQuery(projectPlanQuery);
  const narrow = useNarrow();
  const navigate = useNavigate();
  const [dialog, setDialog] = useState<Dialog>();
  const [busy, setBusy] = useState(false);
  const [decision, setDecision] = useState<Decision>();
  const [deciding, setDeciding] = useState(false);
  const views = useSavedViews({
    table: "release-streams",
    within: releaseStreamsQuery.queryKey,
    applied,
    onApply,
    canShare: canShareViews,
    blocked: dialog !== undefined || deciding,
  });
  // The release whose note is open above the stream's panel, whether it is being changed, and why
  // the note last saved was refused.
  // Whether the note may be changed is decided as it opens, so a refresh never takes away what is
  // being written; the server refuses it if it can no longer be saved.
  const [noteOf, setNoteOf] = useState<{
    streamId: string;
    id: string;
    canEdit: boolean;
  }>();
  const [writingNote, setWriting] = useState(false);
  const [refused, setRefused] = useState<string>();

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: releaseStreamsQuery.queryKey }),
      queryClient.invalidateQueries({ queryKey: unpublishedQuery.queryKey }),
      queryClient.invalidateQueries({ queryKey: ["changes"] }),
    ]);
  };
  const openStream = (stream: { id: string }) => {
    // While a note is being changed, nothing in the stream changes, so nothing written is lost.
    if (writingNote) return;
    void navigate({
      to: "/releases/{-$streamId}",
      params: { streamId: stream.id },
      search: true,
    });
  };
  const closePanel = (stream: ReleaseStream) => {
    focusRecordCell(stream.id, "name");
    void navigate({
      to: "/releases/{-$streamId}",
      params: { streamId: undefined },
      search: true,
    });
  };

  if (query.isPending) return <Loader role="status" aria-label="Loading" />;
  if (query.isError) {
    return (
      <Alert color="red" role="alert">
        <Group justify="space-between">
          Fathom could not load the release streams.
          <Button
            variant="light"
            color="red"
            size="xs"
            onClick={() => {
              void query.refetch();
            }}
          >
            Try again
          </Button>
        </Group>
      </Alert>
    );
  }

  const { streams: all, canEditStreams, canEditReleases } = query.data;
  const day = today();
  const kept = view.retired === true ? all : all.filter(shownUnlessRetired);
  const retiredCount = all.length - all.filter(shownUnlessRetired).length;
  const rows = streamRows(kept, show, day);
  const table = streamTable({ streams: kept, day, onOpen: openStream });
  const choices: ViewChoice[] =
    retiredCount > 0 || view.retired === true
      ? [
          {
            label: "Show retired",
            count: retiredCount,
            on: (shown) => shown.retired === true,
            turned: (shown, on) => ({
              ...shown,
              retired: on ? true : undefined,
            }),
            part: { name: "Show", value: "Retired streams" },
          },
        ]
      : [];
  const drafts = draftsById(all);
  const nodes = [
    ...recordNodes(all),
    ...(plan.data === undefined ? [] : planNodes(plan.data)),
  ];
  // A stream named in the address opens even while retired streams are hidden, such as from a
  // release's link on Features.
  const open = streamsShown(all, show).find(({ id }) => id === streamId);
  // A note belongs to the stream open beside it, so opening another stream closes it.
  const noted =
    noteOf?.streamId === open?.id
      ? open?.releases.find(({ id }) => id === noteOf?.id)
      : undefined;
  const writing = writingNote && noted !== undefined;
  const actions: Actions = {
    draftOf: (id) => drafts.get(id),
    canEditStreams: canEditStreams && show !== "live",
    canEditReleases: canEditReleases && show !== "live",
    approves,
    nodes,
    open: setDialog,
    openNote: (stream, release) => {
      if (writing) return;
      setRefused(undefined);
      setNoteOf({
        streamId: stream.id,
        id: release.id,
        canEdit:
          canEditReleases &&
          release.heldBy === undefined &&
          release.draft?.action !== "deleted",
      });
    },
    resubmit: (ref) => {
      actions.run(() => resubmitRecordDraft(ref), "Resubmitted the draft.");
    },
    discard: (ref) => {
      actions.run(() => discardRecordDraft(ref), "Discarded the draft.");
    },
    decide: (asking, ref) => {
      setDecision(
        decisionFor(asking, { ...noDrafts(), records: [ref] }, approves, [], {
          fields: [],
          records: nodes,
        }),
      );
      setDeciding(true);
    },
    run: (work, done) => {
      work()
        .then(async () => {
          notifySuccess(done);
          await refresh();
        })
        .catch((error: unknown) => {
          notifyFailure(
            describeProblem(
              error as Error,
              "Fathom could not make this change. Try again in a moment.",
            ),
          );
        });
    },
  };
  // Closes the dialog once its change is saved, saying so, and opens a stream just added.
  const saved =
    (message: string, opens = false) =>
    ({ stream }: SavedStream) => {
      setDialog(undefined);
      notifySuccess(message);
      if (opens) openStream(stream);
      void refresh();
    };
  const savingProps = {
    onCancel: () => {
      setDialog(undefined);
    },
    onBusy: setBusy,
  };

  // Clicking the page outside the panel, the table's rows, and any control closes the panel, as on
  // the Lists page. Menus and dialogs are drawn outside the page, so clicks in them do not count.
  const onPageClick = (event: MouseEvent) => {
    const target = event.target as HTMLElement;
    if (
      open &&
      !writing &&
      event.currentTarget.contains(target) &&
      !target.closest("tr, [data-side-panel], section, button, a, input")
    ) {
      closePanel(open);
    }
  };

  const closeNote = () => {
    setNoteOf(undefined);
    setWriting(false);
    setRefused(undefined);
  };
  const notePanel =
    open === undefined || noted === undefined
      ? []
      : [
          {
            key: "note",
            id: `${noteId}-panel`,
            name: "the note",
            node: (
              <NotePanel
                key={noted.id}
                id={noteId}
                title={noted.name}
                note={noted.note ?? ""}
                refused={refused}
                canEdit={noteOf?.canEdit === true}
                onWriting={setWriting}
                onSave={(note) => {
                  saveReleaseNote(open.id, noted.id, note)
                    .then(async () => {
                      notifySuccess(
                        note === ""
                          ? `Drafted removing the note on ${noted.name}.`
                          : `Drafted the note on ${noted.name}.`,
                      );
                      closeNote();
                      // Focus goes to the release once it is drawn as saved, with its note or
                      // without one.
                      await refresh();
                      focusRelease(noted);
                    })
                    .catch((error: unknown) => {
                      // The panel stays open, with what was written and why it was refused.
                      setRefused(
                        describeProblem(
                          error as Error,
                          "Fathom could not save the note. Try again in a moment.",
                        ),
                      );
                    });
                }}
                onClose={() => {
                  closeNote();
                  focusRelease(noted);
                }}
              />
            ),
          },
        ];

  const panels = open
    ? [
        {
          key: "stream",
          id: panelId,
          name: "the stream's panel",
          node: (
            <StreamPanel
              key={open.id}
              stream={open}
              day={day}
              actions={actions}
              narrow={narrow}
              waiting={writing}
              onClose={() => {
                closePanel(open);
              }}
            />
          ),
        },
        ...notePanel,
      ]
    : [];
  const gridActions = noRecordActions<StreamRow, never, undefined>(
    (asking, selection) => {
      setDecision(
        decisionFor(asking, selection, approves, [], {
          fields: [],
          records: nodes,
        }),
      );
      setDeciding(true);
    },
  );

  return (
    <Stack gap="md" className={classes.tablePage} onClick={onPageClick}>
      <PageHeader
        title="Releases"
        action={
          canEditStreams && (
            <Button
              onClick={() => {
                setDialog({ kind: "stream" });
              }}
            >
              New release stream
            </Button>
          )
        }
      />
      {all.length === 0 ? (
        <Text fz="sm" c="dimmed">
          No release streams yet.
        </Text>
      ) : (
        <TableTips>
          <RecordGrid
            records={rows}
            table={table}
            fields={[]}
            order={streamColumnOrder}
            lists={[]}
            canEdit={false}
            canAdd={false}
            rowActions={false}
            approves={approves}
            canEditColumns={false}
            actions={gridActions}
            view={view}
            onView={onView}
            panels={panels}
            above={(shown) => {
              const listed = new Set(shown.map(({ id }) => id));
              return (
                // While a note is being changed, the timeline waits, as the streams do.
                <div className={classes.releasesTimeline} inert={writing}>
                  <TimelineView
                    title="Timeline"
                    zoomKey={timelineZoomKey}
                    releaseStreams={kept.filter(({ id }) => listed.has(id))}
                    today={day}
                  />
                </div>
              );
            }}
            viewChoices={choices}
            saved={views.saved}
          />
        </TableTips>
      )}
      {views.dialogs}
      <Modal
        opened={dialog !== undefined}
        onClose={() => {
          setDialog(undefined);
        }}
        closeOnEscape={!busy}
        closeOnClickOutside={!busy}
        withCloseButton={!busy}
        title={dialog === undefined ? "" : dialogTitle(dialog)}
      >
        {dialog?.kind === "stream" && (
          <StreamDialog
            stream={dialog.stream}
            streams={all}
            onSaved={
              dialog.stream === undefined
                ? saved("Drafted the new release stream.", true)
                : saved("Drafted the new name.")
            }
            {...savingProps}
          />
        )}
        {dialog?.kind === "pattern" && (
          <PatternDialog
            stream={dialog.stream}
            pattern={dialog.pattern}
            onSaved={saved(
              dialog.stream.patterns.length === 0
                ? "Drafted the cycles."
                : "Drafted the change to the cycles.",
            )}
            {...savingProps}
          />
        )}
        {dialog?.kind === "cycles-until" && (
          <CyclesUntilDialog
            stream={dialog.stream}
            onSaved={saved("Drafted the change to the cycles.")}
            {...savingProps}
          />
        )}
        {dialog?.kind === "ends" && (
          <EndsDialog
            stream={dialog.stream}
            onSaved={saved("Drafted the change to the cycles.")}
            {...savingProps}
          />
        )}
        {dialog?.kind === "cycle-length" && (
          <CycleLengthDialog
            stream={dialog.stream}
            cycle={dialog.cycle}
            onSaved={saved("Drafted the new length.")}
            {...savingProps}
          />
        )}
        {dialog?.kind === "release" && (
          <ReleaseDialog
            stream={dialog.stream}
            release={dialog.release}
            onSaved={saved(
              dialog.release === undefined
                ? "Drafted the new release."
                : "Drafted the change to the release.",
            )}
            {...savingProps}
          />
        )}
      </Modal>
      <DecisionModal
        decision={decision}
        opened={deciding}
        onClose={() => {
          setDeciding(false);
        }}
        onDone={() => {
          setDeciding(false);
          void refresh();
        }}
      />
    </Stack>
  );
}
