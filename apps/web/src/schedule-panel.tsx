// SPDX-License-Identifier: Apache-2.0

// A schedule's details on the Schedules tab: the table's columns first, in its order, with its
// labels, values and draft marks, then its Name pattern, shown as typed since this is where it is
// set, each value a row with its own pencil for those who may change it; then its Cycles, from the
// current one, marked, and the next five, with Show more for more and Earlier cycles unfolding those
// before, each a draft changes marked. A cycle's Duration pencil asks whether the change is for that
// cycle only, or for it and every later cycle.

import type { Cycle, RecordDraft, ReleaseStream } from "@fathom/shared";
import { ActionIcon, Group, Menu, Table, Text } from "@mantine/core";
import { FoldedList } from "./folded-list.tsx";
import classes from "./pages.module.css";
import details from "./record-details.module.css";
import {
  changeButton,
  ColumnRows,
  RecordLink,
  RecordSection,
  Row,
} from "./record-details.tsx";
import { fieldColumn } from "./grid-columns.tsx";
import {
  currentCycle,
  durationWords,
  patternOn,
  startingCycle,
  unitOf,
} from "./schedules.ts";
import {
  DraftedItem,
  FactBox,
  LiveLine,
  useBesideLive,
} from "./status-mark.tsx";
import {
  type ScheduleRows,
  streamColumns,
  type StreamRow,
} from "./stream-table.tsx";
import { listingFeatures } from "./release-features.tsx";
import {
  drawnAs,
  type FeaturesAt,
  type PlannedFeatures,
  type ShowIn,
} from "./release-tabs.ts";
import { formatDay } from "./table-view.ts";

// What a schedule's details open to change it.
export type ScheduleChange =
  | { kind: "rename" }
  | { kind: "ends" }
  | { kind: "pattern"; from?: string }
  | { kind: "cycle-length"; cycle: Cycle };

const namePattern = fieldColumn<StreamRow, never>("naming", "text", {
  label: "Name pattern",
  required: false,
  multiple: false,
  choices: [],
});

const shownCycles = 6;

export function ScheduleDetails({
  rows: { shown, drafted, live, cyclesDraft },
  day,
  canEdit,
  onChange,
  planned,
  onFeatures,
  showIn,
}: {
  rows: ScheduleRows;
  day: string;
  canEdit: boolean;
  onChange: (change: ScheduleChange) => void;
  planned: PlannedFeatures | undefined;
  onFeatures: (at: FeaturesAt) => void;
  showIn: ShowIn;
}) {
  const { draft } = drafted;
  const pencil = (label: string, change: ScheduleChange) =>
    canEdit ? (
      <ActionIcon
        {...changeButton(label)}
        onClick={() => {
          onChange(change);
        }}
      />
    ) : undefined;
  const changes = new Map<string, ScheduleChange>([
    ["name", { kind: "rename" }],
    ...(shown.stream.patterns.length > 0
      ? [["endsOn", { kind: "ends" }] as const]
      : []),
  ]);
  const pattern = patternOn(shown.stream, day);
  const draftedNaming = patternOn(drafted.stream, day)?.naming ?? "";
  const liveNaming = patternOn(live.stream, day)?.naming ?? "";
  return (
    <RecordSection id="schedule-details" title="Details">
      <ColumnRows
        columns={listingFeatures(
          drawnAs(streamColumns(day, [shown, drafted, live], planned), {
            currentCycle: (row) => (
              <RecordLink
                name={row.currentCycle}
                onShow={() => {
                  showIn("cycles", row.currentCycleId);
                }}
              />
            ),
            nextRelease: (row) => (
              <RecordLink
                name={row.nextRelease}
                onShow={() => {
                  showIn("releases", row.nextReleaseId);
                }}
              />
            ),
          }),
          planned,
          {
            cyclesOf: ({ currentCycleId }) => [currentCycleId],
            at: (row) => ({
              filter: { key: "targetCycle", value: row.currentCycleId },
              board: { stream: row.stream.id, from: row.cycleStarts },
            }),
            onFeatures,
          },
        )}
        shown={shown}
        draft={draft}
        live={live}
        changeOf={(column) => {
          const change = changes.get(column.key);
          return canEdit && change !== undefined
            ? () => {
                onChange(change);
              }
            : undefined;
        }}
      />
      <Row
        column={namePattern}
        value={pattern?.naming ?? ""}
        changed={
          draftedNaming === liveNaming
            ? undefined
            : { live: liveNaming, draft: cyclesDraft }
        }
        action={pencil(namePattern.label, {
          kind: "pattern",
          ...(shown.cycleStarts === "" ? {} : { from: shown.cycleStarts }),
        })}
      >
        {pattern === undefined ? undefined : (
          <Text>
            <code>{pattern.naming}</code>
            {shown.currentCycle !== "" && (
              <Text span c="dimmed">
                {" "}
                (now {shown.currentCycle})
              </Text>
            )}
          </Text>
        )}
      </Row>
    </RecordSection>
  );
}

// A cycle's Duration pencil, asking whether the change is for that cycle only or for every cycle
// from it on, in a schedule's details and a cycle's.
export function DurationChange({
  cycle,
  onChange,
}: {
  cycle: Cycle;
  onChange: (change: ScheduleChange) => void;
}) {
  return (
    <Menu position="bottom-end">
      <Menu.Target>
        <ActionIcon {...changeButton(`Duration of ${cycle.name}`)} />
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Item
          onClick={() => {
            onChange({ kind: "cycle-length", cycle });
          }}
        >
          This cycle only…
        </Menu.Item>
        <Menu.Item
          onClick={() => {
            onChange({ kind: "pattern", from: cycle.startsOn });
          }}
        >
          This and later cycles…
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
}

// The same cycle, starting on the same day, in another version of the schedule, such as as it is
// live.
const twinIn = (stream: ReleaseStream, cycle: Cycle) =>
  stream.cycles.find(({ startsOn }) => startsOn === cycle.startsOn);

const sameCycle = (one: Cycle, other: Cycle | undefined) =>
  other !== undefined && one.endsOn === other.endsOn && one.name === other.name;

function CycleRow({
  cycle,
  stream,
  other,
  draft,
  day,
  current,
  canEdit,
  onChange,
}: {
  cycle: Cycle;
  stream: ReleaseStream;
  // The schedule the cycle is compared with: as it is live, or, under Live only, with its drafts.
  other: ReleaseStream;
  draft: RecordDraft | undefined;
  day: string;
  current: boolean;
  canEdit: boolean;
  onChange: (change: ScheduleChange) => void;
}) {
  const besideLive = useBesideLive();
  const twin = twinIn(other, cycle);
  const changed = !sameCycle(cycle, twin);
  const liveDuration =
    besideLive && changed && twin !== undefined
      ? durationWords(twin, unitOf(other, twin))
      : undefined;
  return (
    <Table.Tr className={cycle.endsOn < day ? details.pastRow : undefined}>
      <Table.Td>
        <DraftedItem draft={changed ? draft : undefined}>
          {cycle.name}
        </DraftedItem>
        {current && (
          <>
            {" "}
            <FactBox>Current</FactBox>
          </>
        )}
      </Table.Td>
      <Table.Td className={classes.figures}>
        {formatDay(cycle.startsOn)}
      </Table.Td>
      <Table.Td className={classes.figures}>{formatDay(cycle.endsOn)}</Table.Td>
      <Table.Td>
        <Group gap={4} wrap="nowrap" justify="space-between">
          {durationWords(cycle, unitOf(stream, cycle))}
          {canEdit && <DurationChange cycle={cycle} onChange={onChange} />}
        </Group>
        {liveDuration !== undefined && <LiveLine>{liveDuration}</LiveLine>}
      </Table.Td>
    </Table.Tr>
  );
}

export function ScheduleCycles({
  rows: { shown, drafted, live, cyclesDraft },
  day,
  canEdit,
  onChange,
}: {
  rows: ScheduleRows;
  day: string;
  canEdit: boolean;
  onChange: (change: ScheduleChange) => void;
}) {
  const { stream } = shown;
  const { cycles } = stream;
  const other = shown === drafted ? live.stream : drafted.stream;
  const current = currentCycle(stream, day)?.startsOn;
  return (
    <RecordSection
      id="schedule-cycles"
      title="Cycles"
      body={
        cycles.length === 0 ? (
          <Text c="dimmed">None</Text>
        ) : (
          <FoldedList
            items={cycles}
            start={startingCycle(cycles, day)}
            first={shownCycles}
            noun="cycles"
          >
            {(listed) => (
              <Table
                fz="md"
                verticalSpacing={4}
                horizontalSpacing="xs"
                className={details.panelTable}
              >
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Cycle</Table.Th>
                    <Table.Th>Starts</Table.Th>
                    <Table.Th>Ends</Table.Th>
                    <Table.Th>Duration</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {listed.map((cycle) => (
                    <CycleRow
                      key={cycle.startsOn}
                      cycle={cycle}
                      stream={stream}
                      other={other}
                      draft={cyclesDraft}
                      day={day}
                      current={cycle.startsOn === current}
                      canEdit={canEdit}
                      onChange={onChange}
                    />
                  ))}
                </Table.Tbody>
              </Table>
            )}
          </FoldedList>
        )
      }
    />
  );
}
