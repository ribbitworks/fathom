// SPDX-License-Identifier: Apache-2.0

// The Releases page: every release stream in one table, with how its cycles are made now and its
// releases, above a timeline of them all, and the selected stream in a side panel at its own
// address, as the Lists page does with lists. The panel holds the stream's changes of cycles, its
// releases, and its cycles, worked out at least two years ahead, each with its share of the months
// it spans. Those who edit planning configuration add, rename, retire, and restore streams and
// change their cycles; those who edit the plan make releases from consecutive cycles. Every change
// is a draft, shown in place with its mark, which its makers discard or resubmit, and Approvers
// approve or reject, here or on the Drafts page, from each record's menu.

import type {
  CyclePattern,
  RecordRef,
  Release,
  ReleaseStream,
} from "@fathom/shared";
import {
  ActionIcon,
  Alert,
  Button,
  FocusTrap,
  Group,
  Loader,
  Menu,
  Modal,
  Paper,
  Stack,
  Table,
  Text,
} from "@mantine/core";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { type MouseEvent, type ReactNode, useEffect, useState } from "react";
import { describeProblem } from "./api.ts";
import { closesOnBlankClick } from "./app-menu.tsx";
import { DecisionModal } from "./decision-dialog.tsx";
import {
  HeldNote,
  MenuDraftLines,
  MenuTitle,
  UnpublishedNote,
} from "./draft-details.tsx";
import {
  type Asking,
  decidable,
  type Decision,
  decisionFor,
  noDrafts,
  waitsForRejected,
} from "./drafts.ts";
import { focusSoon } from "./focus.ts";
import { Icon } from "./icons.tsx";
import { DraftItems, draftRowClass, madeVerb, makers } from "./list-drafts.tsx";
import { notifyFailure, notifySuccess } from "./notices.tsx";
import { PageHeader } from "./page-header.tsx";
import classes from "./pages.module.css";
import type { RecordNode } from "./record-drafts.ts";
import {
  CyclesUntilDialog,
  PatternDialog,
  ReleaseDialog,
  StreamDialog,
} from "./release-dialogs.tsx";
import {
  discardRecordDraft,
  recordNodes,
  releaseCycles,
  releaseDate,
  shipsOffCycle,
  releaseStreamsQuery,
  removeFromStream,
  resubmitRecordDraft,
  type SavedStream,
  setStreamRetired,
} from "./releases.ts";
import { ReleasesTimeline } from "./releases-timeline.tsx";
import { sidePanelScroll, useNarrow, WithSidePanel } from "./side-panel.tsx";
import { DraftMark, HoldMarks } from "./status-mark.tsx";
import { unpublishedQuery } from "./unpublished.tsx";
import { today } from "./today.ts";

type Dialog =
  | { kind: "stream"; stream?: ReleaseStream }
  | { kind: "pattern"; stream: ReleaseStream; pattern?: CyclePattern }
  | { kind: "cycles-until"; stream: ReleaseStream }
  | { kind: "release"; stream: ReleaseStream; release?: Release };

const panelId = "release-stream-panel";
const panelTitleId = "release-stream-panel-title";
const linkId = (stream: { id: string }) => `release-stream-link-${stream.id}`;

const dialogTitle = (dialog: Dialog): string => {
  if (dialog.kind === "stream") {
    return dialog.stream === undefined
      ? "New release stream"
      : `Rename ${dialog.stream.name}`;
  }
  if (dialog.kind === "cycles-until") {
    return `Change when ${dialog.stream.name}'s cycles end`;
  }
  if (dialog.kind === "pattern") {
    return dialog.pattern === undefined
      ? dialog.stream.patterns.length === 0
        ? `Set up cycles for ${dialog.stream.name}`
        : `Change the length or names of ${dialog.stream.name}'s cycles`
      : `Cycles from ${dialog.pattern.startsOn}`;
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

const patternWords = (pattern: CyclePattern) =>
  `Every ${String(pattern.length)} ${pattern.unit === "weeks" ? "week" : "month"}${pattern.length === 1 ? "" : "s"}, named ${pattern.naming}`;

// The pattern in force today, or the first, when none has started yet.
function patternNow(stream: ReleaseStream): CyclePattern | undefined {
  const kept = stream.patterns.filter(
    ({ draft }) => draft?.action !== "deleted",
  );
  return kept.filter(({ startsOn }) => startsOn <= today()).at(-1) ?? kept[0];
}

// What can be done on the page, for the menus to offer.
interface Actions {
  canEditStreams: boolean;
  canEditReleases: boolean;
  canApprove: boolean;
  nodes: readonly RecordNode[];
  open: (dialog: Dialog) => void;
  decide: (asking: Asking, ref: RecordRef) => void;
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

// A record's menu: what may be done to it, then its draft, with who made it and what may be done
// with it. An empty space keeps the column when it would offer nothing.
function RecordMenu({
  title,
  node,
  canEditDraft,
  actions,
  children,
}: {
  title: string;
  node: RecordNode;
  // Whether the user may discard or resubmit the record's draft.
  canEditDraft: boolean;
  actions: Actions;
  children?: ReactNode;
}) {
  const [opened, setOpened] = useState(false);
  const { draft, heldBy, ref } = node;
  const act = (run: () => void) => () => {
    setOpened(false);
    run();
  };
  const waits =
    draft?.state === "waiting" &&
    waitsForRejected({ ...noDrafts(), records: [ref] }, [], {
      fields: [],
      records: actions.nodes,
    });
  if (children === undefined && draft === undefined) return <span />;
  return (
    <Menu
      opened={opened}
      onChange={setOpened}
      closeOnItemClick={false}
      position="bottom-end"
      width={260}
    >
      <Menu.Target>
        <ActionIcon
          variant="subtle"
          color="gray"
          aria-label={`Menu of ${title}`}
        >
          <Icon name="more" />
        </ActionIcon>
      </Menu.Target>
      <Menu.Dropdown
        onClick={closesOnBlankClick(() => {
          setOpened(false);
        })}
        // Esc closes the menu alone, not the panel around it too.
        onKeyDown={(event) => {
          if (event.key === "Escape") event.preventDefault();
        }}
      >
        <MenuTitle>{title}</MenuTitle>
        {children !== undefined && (
          <div
            onClickCapture={() => {
              setOpened(false);
            }}
          >
            {children}
          </div>
        )}
        {draft && (
          <>
            {children !== undefined && <Menu.Divider />}
            <MenuDraftLines
              draft={draft}
              lines={[[`${madeVerb(draft.action)} by ${makers(draft)}`]]}
              divider={false}
            />
            {heldBy !== undefined && <HeldNote by={heldBy} />}
            {draft.unpublished === true && <UnpublishedNote />}
            <DraftItems
              canEdit={canEditDraft && heldBy === undefined}
              canApprove={actions.canApprove && decidable(node)}
              rejected={draft.state === "rejected"}
              waits={waits}
              onApprove={act(() => {
                actions.decide("approve", ref);
              })}
              onReject={act(() => {
                actions.decide("reject", ref);
              })}
              onResubmit={act(() => {
                actions.run(
                  () => resubmitRecordDraft(ref),
                  "Resubmitted the draft.",
                );
              })}
              onDiscard={act(() => {
                actions.run(
                  () => discardRecordDraft(ref),
                  "Discarded the draft.",
                );
              })}
            />
          </>
        )}
      </Menu.Dropdown>
    </Menu>
  );
}

// A record's draft and hold marks, beside its name, saying when a stream's draft retires or
// restores it.
function Marks({ node, retired }: { node: RecordNode; retired?: boolean }) {
  const retiring =
    retired !== undefined &&
    node.draft?.state === "waiting" &&
    node.draft.action === "changed" &&
    node.draft.changed.length === 1 &&
    node.draft.changed[0] === "retired"
      ? { retiring: retired }
      : {};
  return (
    <>
      {node.draft && <DraftMark draft={{ ...node.draft, ...retiring }} />}
      <HoldMarks unpublished={false} heldBy={node.heldBy} />
    </>
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
          variant="subtle"
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
          No cycles yet.
        </Text>
      )}
      {stream.patterns.map((pattern) => {
        const node = nodeOf(actions, "cycle-pattern", pattern.id);
        const changeable =
          actions.canEditStreams &&
          pattern.heldBy === undefined &&
          pattern.draft?.action !== "deleted";
        return (
          <div
            key={pattern.id}
            className={[classes.recordRow, draftRowClass(pattern.draft)].join(
              " ",
            )}
          >
            <span className={classes.figures}>From {pattern.startsOn}</span>
            <span>
              {patternWords(pattern)}
              <Marks node={node} />
            </span>
            <RecordMenu
              title={`Cycles from ${pattern.startsOn}`}
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
                        `Drafted removing the cycles from ${pattern.startsOn}.`,
                      );
                    }}
                  >
                    Remove
                  </Menu.Item>
                </>
              ) : undefined}
            </RecordMenu>
          </div>
        );
      })}
      <Group gap="xs" mih={36}>
        <Text fz="sm">
          Cycles until{" "}
          <span className={classes.figures}>{stream.cyclesUntil}</span>
        </Text>
      </Group>
      {editable && stream.patterns.length > 0 && (
        <Menu position="bottom-start">
          <Menu.Target>
            <Button variant="subtle" size="compact-sm" mt={4}>
              Change…
            </Button>
          </Menu.Target>
          <Menu.Dropdown>
            <Menu.Item
              onClick={() => {
                actions.open({ kind: "cycles-until", stream });
              }}
            >
              End date…
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
          No releases yet.
        </Text>
      )}
      {stream.releases.map((release) => {
        const node = nodeOf(actions, "release", release.id);
        const changeable =
          actions.canEditReleases &&
          release.heldBy === undefined &&
          release.draft?.action !== "deleted";
        return (
          <div
            key={release.id}
            className={[classes.recordRow, draftRowClass(release.draft)].join(
              " ",
            )}
          >
            <span>
              {release.name}
              <Marks node={node} />
            </span>
            <span>
              {releaseCycles(stream, release)}
              <Text span c="dimmed" fz="sm" className={classes.figures}>
                {" "}
                · ships {releaseDate(stream, release) ?? ""}
                {shipsOffCycle(stream, release) !== undefined && (
                  <Text span inherit fw={700}>
                    , {shipsOffCycle(stream, release)}
                  </Text>
                )}
              </Text>
            </span>
            <RecordMenu
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
          </div>
        );
      })}
    </Section>
  );
}

function Cycles({ stream }: { stream: ReleaseStream }) {
  if (stream.cycles.length === 0) return null;
  const releaseOf = (startsOn: string) =>
    stream.releases.find(
      (release) =>
        release.draft?.action !== "deleted" &&
        startsOn >= release.firstCycle &&
        startsOn <= release.lastCycle,
    )?.name ?? "";
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
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {stream.cycles.map((cycle) => (
              <Table.Tr key={cycle.startsOn}>
                <Table.Td className={classes.cycleCell}>{cycle.name}</Table.Td>
                <Table.Td
                  className={[classes.figures, classes.cycleCell].join(" ")}
                >
                  {cycle.startsOn}
                </Table.Td>
                <Table.Td
                  className={[classes.figures, classes.cycleCell].join(" ")}
                >
                  {cycle.endsOn}
                </Table.Td>
                <Table.Td className={classes.cycleCell}>
                  {releaseOf(cycle.startsOn)}
                </Table.Td>
                <Table.Td className={classes.monthsCell}>
                  {monthsInWords(cycle.months)}
                </Table.Td>
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
  actions,
  narrow,
  onClose,
}: {
  stream: ReleaseStream;
  actions: Actions;
  narrow: boolean;
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
              <h2 id={panelTitleId} className={classes.panelName} tabIndex={-1}>
                {stream.name}
              </h2>
              <span>
                {stream.retired && (
                  <Text span fz="xs" fw={600} c="dimmed" mr={6}>
                    Retired
                  </Text>
                )}
                <Marks node={node} retired={stream.retired} />
              </span>
            </div>
            {editable && (
              <>
                <Button
                  variant="subtle"
                  color="gray"
                  size="compact-sm"
                  onClick={() => {
                    actions.open({ kind: "stream", stream });
                  }}
                >
                  Rename
                </Button>
                <Button
                  variant="subtle"
                  color="gray"
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
          <Cycles stream={stream} />
        </div>
      </section>
    </FocusTrap>
  );
}

// Whether the stream, or any of its patterns or releases, has a draft.
const hasDrafts = (stream: ReleaseStream) =>
  stream.draft !== undefined ||
  [...stream.patterns, ...stream.releases].some(
    ({ draft }) => draft !== undefined,
  );

// Every stream: its name and marks, how its cycles are made now, and its releases, with retired
// streams after the rest.
function StreamTable({
  streams,
  actions,
  selected,
  onOpen,
}: {
  streams: readonly ReleaseStream[];
  actions: Actions;
  selected: string | undefined;
  onOpen: (stream: ReleaseStream) => void;
}) {
  const current = streams.filter(({ retired }) => !retired);
  const retired = streams.filter((stream) => stream.retired);
  const row = (stream: ReleaseStream) => {
    const node = nodeOf(actions, "release-stream", stream.id);
    const now = patternNow(stream);
    const releases = stream.releases.filter(
      ({ draft }) => draft?.action !== "deleted",
    );
    return (
      <div
        key={stream.id}
        role="row"
        aria-current={stream.id === selected ? "true" : undefined}
        className={[
          classes.listRow,
          stream.id === selected ? classes.listRowSelected : "",
          stream.retired ? classes.listRowRetired : "",
          hasDrafts(stream)
            ? draftRowClass(stream.draft ?? { action: "changed" })
            : "",
        ].join(" ")}
        onClick={() => {
          onOpen(stream);
        }}
      >
        <span role="cell" className={classes.listCellName}>
          <Link
            id={linkId(stream)}
            to="/releases/{-$streamId}"
            params={{ streamId: stream.id }}
            className={classes.listLink}
          >
            {stream.name}
          </Link>
          <Marks node={node} retired={stream.retired} />
        </span>
        <span role="cell" className={classes.listCellDim}>
          {now === undefined ? "No cycles yet" : patternWords(now)}
        </span>
        <span role="cell" className={classes.listCell}>
          <span className={classes.listCount}>({releases.length})</span>{" "}
          {releases.map(({ name }) => name).join(", ")}
        </span>
      </div>
    );
  };
  return (
    <Paper withBorder className={classes.tablePanel}>
      <div
        role="table"
        aria-label="Release streams"
        className={classes.listTable}
      >
        <div role="row" className={classes.listHead}>
          <span role="columnheader">Name</span>
          <span role="columnheader">Cycles now</span>
          <span role="columnheader">Releases</span>
        </div>
        {current.map(row)}
        {retired.length > 0 && (
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
    </Paper>
  );
}

export function ReleasesPage({
  streamId,
  canApprove,
}: {
  // The stream open in the side panel, if any.
  streamId?: string | undefined;
  canApprove: boolean;
}) {
  const queryClient = useQueryClient();
  const query = useQuery(releaseStreamsQuery);
  const narrow = useNarrow();
  const navigate = useNavigate();
  const [dialog, setDialog] = useState<Dialog>();
  const [busy, setBusy] = useState(false);
  const [decision, setDecision] = useState<Decision>();
  const [deciding, setDeciding] = useState(false);

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: releaseStreamsQuery.queryKey }),
      queryClient.invalidateQueries({ queryKey: unpublishedQuery.queryKey }),
      queryClient.invalidateQueries({ queryKey: ["changes"] }),
    ]);
  };
  const openStream = (stream: { id: string }) => {
    void navigate({
      to: "/releases/{-$streamId}",
      params: { streamId: stream.id },
    });
  };
  const closePanel = (stream: ReleaseStream) => {
    focusSoon(linkId(stream));
    void navigate({
      to: "/releases/{-$streamId}",
      params: { streamId: undefined },
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

  const { streams, canEditStreams, canEditReleases } = query.data;
  const nodes = recordNodes(streams);
  const open = streams.find(({ id }) => id === streamId);
  const actions: Actions = {
    canEditStreams,
    canEditReleases,
    canApprove,
    nodes,
    open: setDialog,
    decide: (asking, ref) => {
      setDecision(
        decisionFor(asking, { ...noDrafts(), records: [ref] }, [], {
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
      event.currentTarget.contains(target) &&
      !target.closest("[role=row], [data-side-panel], section, button, a")
    ) {
      closePanel(open);
    }
  };

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
      <WithSidePanel
        label="Resize the stream's panel"
        controls={panelId}
        storageKey="fathom-record-panel-width"
        panel={
          open && (
            <StreamPanel
              key={open.id}
              stream={open}
              actions={actions}
              narrow={narrow}
              onClose={() => {
                closePanel(open);
              }}
            />
          )
        }
      >
        {streams.length === 0 ? (
          <Text fz="sm" c="dimmed">
            No release streams yet.
          </Text>
        ) : (
          <Stack gap="lg" className={sidePanelScroll}>
            <StreamTable
              streams={streams}
              actions={actions}
              selected={open?.id}
              onOpen={openStream}
            />
            <ReleasesTimeline streams={streams} today={today()} />
          </Stack>
        )}
      </WithSidePanel>
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
            streams={streams}
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
