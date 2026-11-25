// SPDX-License-Identifier: Apache-2.0

// One person's or planned hire's details in a side panel, beside People or the org chart, for those
// who see people: their name and position, who they report to and who reports to them, their
// details, and every added column People shows them, a planned hire's only where offered on hires.
// It shows only what People sends the reader, so each tier is kept as there, and reading it is
// recorded as reading People is. It follows the Draft menu of the page it is on: each drafted value
// beside the live one, the drafts applied, or the record as it is live. Choosing their manager or a
// report shows them instead. Those who may change people, and planned hires for a planned hire,
// change each value there as in its People cell, with the same editors and checks, each change a
// draft; the live values alone, and a record drafted to be removed or held by another's changes, are
// only read. Beside the org chart on an earlier day, only a person's manager changes, from that day,
// while their current line was already in force then.

import { type Person, type Show } from "@fathom/shared";
import { Alert, Button, Group, Loader, Text } from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import {
  type ComponentProps,
  type ReactNode,
  useEffect,
  useEffectEvent,
} from "react";
import { cellKinds } from "./cell-kinds.tsx";
import { listsQuery } from "./lists.ts";
import { PersonFeatureTeams } from "./person-feature-teams.tsx";
import { useTeamColours } from "./org-chart.ts";
import {
  columnsFor,
  type Column,
  datedKey,
  withTeamColours,
} from "./people-grid.tsx";
import {
  isHire,
  personKeyOf,
  rowName,
  type RowChange,
  personKind,
} from "./people-rows.ts";
import { RecordKey } from "./record-key.tsx";
import { changedFrom, managerChangesFrom } from "./person-change.ts";
import type { NoteOpening } from "./note-editing.tsx";
import { peopleQuery, peopleQueryOn } from "./people.ts";
import {
  personPanelId,
  type EditingContext,
  usePersonEditing,
  useShownId,
} from "./person-editing.tsx";
import classes from "./record-details.module.css";
import {
  RecordLink,
  RecordSection,
  Row,
  RecordPanel,
} from "./record-details.tsx";
import { onRow } from "./grid-columns.tsx";
import { heldBack } from "./grid-drafts.ts";
import { shownSchema } from "./live-records.ts";
import {
  besideLive,
  DraftedPartItem,
  leftWarning,
  MarkedItem,
} from "./status-mark.tsx";
import type { DraftLike } from "./draft-marks.ts";
import type { CellValue } from "./table-view.ts";
import { formatDay, plannedWords } from "./day-formats.ts";
import { TimelinePreview } from "./person-timeline.tsx";
import { today } from "./today.ts";
import { changesFromDay, livePeople, peopleAsShown } from "./people-live.ts";
import { recordProblem } from "./people-requests.ts";

export { personPanelId };
const titleId = "person-panel-title";

const byName = new Intl.Collator(undefined, { sensitivity: "base" });

// The columns each section shows, by key, in this order, each where its kind of record has it;
// added columns follow in People's order.
export const reportingKeys = ["managerId", "managerFrom", "team", "teamName"];
// A person's team and its name are their reporting team's, told apart from feature teams.
const reportingLabels = new Map([
  ["team", "Reporting team"],
  ["teamName", "Reporting team name"],
]);
const reportingLabel = <Labelled extends { key: string; label: string }>(
  column: Labelled,
): Labelled => ({
  ...column,
  label: reportingLabels.get(column.key) ?? column.label,
});
export const detailKeys = [
  "preferredName",
  "employeeId",
  "positionId",
  "stateId",
  "startDate",
  "endDate",
  "expected",
  "isManager",
];

const sameId = (person: Person, employeeId: string) =>
  person.employeeId.toLowerCase() === employeeId.toLowerCase();

export function PersonPanel({
  employeeId,
  show,
  showDates,
  showHireDates = showDates,
  canEditHires = false,
  seesFeatureTeams = true,
  teams = "reporting",
  narrow,
  elsewhere,
  onPerson,
  onFollow,
  onClose,
  onChange,
  changesFrom,
  notes,
  hireFill,
  shownOn,
  timeline,
}: {
  // The person's timeline at the end of their details, for a role that sees start and end dates.
  timeline?:
    | Omit<ComponentProps<typeof TimelinePreview>, "personId" | "shownOn">
    | undefined;
  // The day the page beside it shows, or none for today.
  shownOn?: string | undefined;
  // The earlier day the page beside shows, from which only a change of manager is made.
  changesFrom?: string | undefined;
  employeeId: string;
  // What the Draft menu of the page beside it shows.
  show: Show;
  showDates: boolean;
  // Whether the reader sees planned hires' target dates, which come with the hiring plan.
  showHireDates?: boolean;
  // Whether the reader may change planned hires, as well as people.
  canEditHires?: boolean;
  // Whether the reader sees feature teams, listed in the person's details.
  seesFeatureTeams?: boolean;
  // Which teams the person is shown in: their reporting line, or, beside the feature team chart,
  // their feature teams in its place.
  teams?: "reporting" | "feature-teams";
  narrow: boolean;
  // A link to the record on the other page that shows it, such as the org chart from People.
  elsewhere: (person: Person) => ReactNode;
  onPerson: (employeeId: string) => void;
  // Puts the person shown in the address again, under their new ID, in place of their old one.
  onFollow: (employeeId: string) => void;
  onClose: () => void;
  // Saves a change to the record, for those who may change people.
  onChange?: ((person: Person, change: RowChange) => void) | undefined;
  // Opens a note, which the page holds, since a note is written in a panel of its own.
  notes: NoteOpening;
  // For a planned hire, what filling it adds: an action under its heading, or a form in place of its
  // details while it is being filled.
  hireFill?:
    | ((
        hire: Person,
        people: readonly Person[],
        columns: readonly Column[],
      ) => { action?: ReactNode; form?: ReactNode })
    | undefined;
}) {
  const query = useQuery(peopleQueryOn(shownOn));
  const lists = useQuery(listsQuery);
  const teamColourOf = useTeamColours();
  const { closeStale, editingOf } = usePersonEditing(notes);
  const people = query.data?.people ?? [];
  const found = people.find((one) => sameId(one, employeeId));
  // Today's people, while another day is shown: to judge a change from it by the line today, and
  // to name someone not employed then.
  const todays = useQuery({
    ...peopleQuery,
    enabled:
      shownOn !== undefined &&
      (changesFrom !== undefined ||
        (query.data !== undefined && found === undefined)),
  });
  const shownId = useShownId(employeeId, query.data?.people);
  const drafted = people.find(({ id }) => id === shownId);
  const renamed = found === undefined ? drafted?.employeeId : undefined;
  const follow = useEffectEvent(onFollow);
  useEffect(() => {
    if (renamed !== undefined) follow(renamed);
  }, [renamed]);
  const shown = drafted?.id ?? employeeId;
  const frame = (
    title: string,
    content: ReactNode,
    draft?: DraftLike,
    // The line under the title, such as the record's key.
    subtitle?: ReactNode,
  ) => (
    <RecordPanel
      id={personPanelId}
      titleId={titleId}
      recordId={shown}
      title={title}
      subtitle={subtitle}
      narrow={narrow}
      draft={draft}
      onClose={onClose}
    >
      {content}
    </RecordPanel>
  );
  if (query.isPending || lists.isPending) {
    return frame("Details", <Loader role="status" aria-label="Loading" />);
  }
  if (query.isError || lists.isError) {
    return frame(
      "Details",
      <Alert color="red" role="alert">
        <Group justify="space-between">
          Fathom could not load this person.
          <Button
            variant="light"
            color="red"
            size="xs"
            onClick={() => {
              void query.refetch();
              void lists.refetch();
            }}
          >
            Try again
          </Button>
        </Group>
      </Alert>,
    );
  }
  const asShown = peopleAsShown(query.data.people, show);
  const person = asShown.find(({ id }) => id === drafted?.id);
  if (person === undefined) {
    if (drafted === undefined) {
      const today = todays.data?.people.find((one) => sameId(one, employeeId));
      return frame(
        "Details",
        <Text>
          {shownOn === undefined
            ? `Nobody in People has the ID ${employeeId}.`
            : `${today === undefined ? employeeId : rowName(today, lists.data)} isn't employed on ${formatDay(shownOn)}.`}
        </Text>,
      );
    }
    const name = rowName(drafted, lists.data);
    return frame(
      name,
      <Text>
        {drafted.draft?.action === "deleted"
          ? `${name} is drafted to be removed.`
          : drafted.draft?.state === "rejected"
            ? `Adding ${name} was rejected.`
            : `${name} is only drafted to be added, so is not live yet.`}
      </Text>,
    );
  }
  const kind = person.kind ?? personKind;
  const schema = shownSchema(show, query.data.fields, lists.data);
  const allColumns = withTeamColours(
    columnsFor(
      schema.fields,
      schema.lists,
      query.data.order,
      showDates,
      asShown,
      query.data.positionHidden !== true,
      showHireDates,
    ),
    teamColourOf,
  );
  const columns = allColumns
    .filter((column) => column.offeredOn?.(kind) ?? true)
    .map((column) => onRow(column, person, kind));
  const byKey = new Map(columns.map((column) => [column.key, column]));
  const section = (keys: readonly string[]) =>
    keys.flatMap((key) => {
      const column = byKey.get(key);
      return column === undefined ? [] : [column];
    });
  const added = columns.filter((column) => column.field !== undefined);
  const manager = asShown.find(({ id }) => id === person.manager?.id);
  const nameOf = (one: Person) => rowName(one, lists.data);
  // Today's reports, and those who have not started yet, by name; those who have left are not. A
  // person's planned reports are on People, beside them; a planned manager's are its only reports.
  const day = shownOn ?? today();
  const reportsAmong = (among: readonly Person[]) =>
    among.filter(
      (one) =>
        (isHire(person) || !isHire(one)) &&
        one.manager?.id === person.id &&
        (typeof one.endDate !== "string" || one.endDate >= day),
    );
  const shownIds = new Set(reportsAmong(asShown).map(({ id }) => id));
  // Beside live, a report drafted in is marked as a draft, and one drafted away stays, dimmed and
  // marked Live, as a drafted value is.
  const allLiveReports = reportsAmong(livePeople(query.data.people));
  const liveReports = besideLive(show) ? allLiveReports : [];
  const liveIds = new Set(allLiveReports.map(({ id }) => id));
  const draftedIds = new Set(
    reportsAmong(query.data.people).map(({ id }) => id),
  );
  // A report a draft brings in, or takes away to another manager, as a part of the person a draft
  // adds or removes, in any Draft view, which decides how it shows.
  const draftOf = new Map(
    query.data.people.map(({ id, draft }) => [id, draft]),
  );
  const partOf = (id: string) =>
    !draftedIds.has(id)
      ? ("removed" as const)
      : !liveIds.has(id)
        ? ("added" as const)
        : undefined;
  const reports = [
    ...reportsAmong(asShown),
    ...liveReports.filter(({ id }) => !shownIds.has(id)),
  ].sort((a, b) => byName.compare(nameOf(a), nameOf(b)));
  const left = typeof person.endDate === "string" && person.endDate < day;
  const position = byKey.get("positionId");
  const valuesOf = (one: Person): Record<string, CellValue> =>
    Object.fromEntries(
      allColumns.map((column) => [column.key, column.value(one)]),
    );
  // The live values alone are only read, as on People, since every change makes a draft; so is a
  // record drafted to be removed or held by another's changes, and a planned hire to those who may
  // not change planned hires. Its values are checked beside everyone else's, as People shows them.
  const live = livePeople(query.data.people).find(({ id }) => id === person.id);
  // How a change is sent: as made, or, from an earlier day, dated, while the person's line today
  // can change from it.
  const from = changesFromDay(changesFrom, todays.data?.people);
  const sent: ((change: RowChange) => RowChange) | undefined =
    from === undefined
      ? (change) => change
      : !isHire(person) && managerChangesFrom(person.id, from)
        ? (change) => changedFrom(change, person.id, from)
        : undefined;
  const context: EditingContext = {
    id: person.id,
    kind,
    name: nameOf(person),
    values: valuesOf(person),
    save:
      onChange === undefined ||
      show === "live" ||
      heldBack(person) ||
      (isHire(person) && !canEditHires) ||
      sent === undefined
        ? undefined
        : (change) => {
            onChange(person, sent(change));
          },
    others: () => asShown.filter(({ id }) => id !== person.id).map(valuesOf),
    recordProblem,
  };
  closeStale(context);
  const editing = editingOf(context);
  // The person's draft, whatever the view, which marks them and the values it changes, so the Draft
  // view decides how they show.
  // The person shown is found by the drafted person's id, so is always one.
  const ownDraft = (drafted as Person).draft;
  const rowOf = (column: Column) => {
    const special =
      column.key === "managerId" && manager !== undefined ? (
        <>
          <MarkedItem
            tone={person.managerLeft === true ? "warning" : undefined}
            words={leftWarning.words}
            spoken={leftWarning.spoken}
          >
            <RecordLink
              name={nameOf(manager)}
              onShow={() => {
                onPerson(manager.employeeId);
              }}
            />
          </MarkedItem>
        </>
      ) : undefined;
    const draft =
      ownDraft?.action === "changed" &&
      ownDraft.changed.includes(column.changesWith ?? column.key)
        ? ownDraft
        : undefined;
    return (
      <Row
        key={column.key}
        column={column}
        value={column.value(person)}
        colour={column.colour?.(person) ?? null}
        changed={
          draft === undefined
            ? undefined
            : {
                live: column.live(draft),
                // Only a record drafted to be added has no live copy, and its draft changes no value.
                liveColour: column.colour?.({ ...person, ...live }) ?? null,
                draft,
                warning:
                  column.key === "managerId" && live?.managerLeft === true
                    ? leftWarning
                    : undefined,
              }
        }
        editing={
          changesFrom === undefined || column.key === datedKey
            ? editing(column)
            : undefined
        }
      >
        {special}
      </Row>
    );
  };
  const fill = isHire(person)
    ? hireFill?.(person, asShown, allColumns)
    : undefined;
  return frame(
    nameOf(person),
    <>
      <div>
        <Group gap={0} align="baseline">
          <MarkedItem
            tone={
              left
                ? "warning"
                : person.expected === undefined
                  ? undefined
                  : "planned"
            }
            words={
              left
                ? leftWarning.words
                : person.expected === undefined
                  ? undefined
                  : plannedWords({
                      expected: person.expected,
                      undated: person.undated,
                    })
            }
            spoken={left ? leftWarning.spoken : undefined}
          >
            {position !== undefined && (
              <Text c="dimmed">
                {cellKinds.choice.inWords(position, position.value(person))}
              </Text>
            )}
          </MarkedItem>
        </Group>
        {elsewhere(person)}
        {fill?.action}
      </div>
      {fill?.form ?? (
        <>
          {teams === "feature-teams" && (
            <RecordSection id="person-reporting" title="Reporting">
              {section(["managerId"]).map(rowOf)}
            </RecordSection>
          )}
          {teams === "reporting" && (
            <RecordSection id="person-reporting" title="Reporting">
              {section(reportingKeys).map(reportingLabel).map(rowOf)}
              <div className={classes.row}>
                <dt className={classes.label}>Direct reports</dt>
                <dd className={classes.value}>
                  {reports.length === 0 ? (
                    <Text c="dimmed">None</Text>
                  ) : (
                    <ul className={classes.reports}>
                      {reports.map((report) => (
                        <li key={report.id}>
                          <DraftedPartItem
                            draft={draftOf.get(report.id)}
                            part={partOf(report.id)}
                          >
                            <RecordLink
                              name={nameOf(report)}
                              onShow={() => {
                                onPerson(report.employeeId);
                              }}
                            />
                          </DraftedPartItem>
                          {typeof report.startDate === "string" &&
                            report.startDate > day && (
                              <Text span c="dimmed" size="sm" ml={8}>
                                Starts {formatDay(report.startDate)}
                              </Text>
                            )}
                        </li>
                      ))}
                    </ul>
                  )}
                </dd>
              </div>
            </RecordSection>
          )}
          {!isHire(person) && (
            <PersonFeatureTeams
              shownOn={shownOn}
              personId={person.id}
              employeeId={person.employeeId}
              seesFeatureTeams={seesFeatureTeams}
            />
          )}
          <RecordSection id="person-details" title="Details">
            {section(detailKeys).map(rowOf)}
          </RecordSection>
          {added.length > 0 && (
            <RecordSection id="person-columns" title="Columns">
              {added.map(rowOf)}
            </RecordSection>
          )}
          {timeline !== undefined && !isHire(person) && (
            <TimelinePreview
              personId={person.id}
              shownOn={shownOn}
              {...timeline}
            />
          )}
        </>
      )}
    </>,
    ownDraft?.action === "changed" ? undefined : ownDraft,
    <RecordKey
      record={personKeyOf({
        keyNumber: person.keyNumber,
        hire: isHire(person),
      })}
    />,
  );
}
