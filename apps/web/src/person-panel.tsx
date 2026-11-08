// SPDX-License-Identifier: Apache-2.0

// One person's details in a side panel, beside People or the org chart, for those who see people:
// their name and position, who they report to and who reports to them, their details, and every
// added column People shows them, read only. It shows only what People sends the reader, so each
// tier is kept as there, and reading it is recorded as reading People is. It follows the Draft menu
// of the page it is on: each drafted value beside the live one, the drafts applied, or the person
// as they are live. Choosing their manager or a report shows that person instead.

import {
  type Link as WebLink,
  type PaletteColour,
  type Person,
  type Show,
} from "@fathom/shared";
import {
  Alert,
  Anchor,
  Button,
  Group,
  Loader,
  Stack,
  Text,
} from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import { type ReactNode, useEffect } from "react";
import { cellKinds } from "./cell-kinds.tsx";
import { Swatch } from "./colour-swatch.tsx";
import { focusSoon } from "./focus.ts";
import { LinkCell } from "./link-field.tsx";
import { liveLists, listsQuery } from "./lists.ts";
import { NoteView } from "./note-editor.tsx";
import { orgChartQuery } from "./org-chart.ts";
import {
  columnsFor,
  type Column,
  livePeople,
  peopleAsShown,
} from "./people-grid.tsx";
import { isHire } from "./people-rows.ts";
import { peopleQuery } from "./people.ts";
import classes from "./person-panel.module.css";
import { SidePanelFrame, sidePanelScroll } from "./side-panel.tsx";
import { DraftMark, StatusMark } from "./status-mark.tsx";
import { formatDay } from "./table-view.ts";
import { today } from "./today.ts";

export const personPanelId = "person-panel";
const titleId = "person-panel-title";

const byName = new Intl.Collator(undefined, { sensitivity: "base" });

// The columns each section shows, by key, in this order; added columns follow in People's order.
const reportingKeys = ["managerId", "managerFrom", "team", "teamName"];
const detailKeys = [
  "employeeId",
  "positionId",
  "stateId",
  "startDate",
  "endDate",
  "isManager",
];

const sameId = (person: Person, employeeId: string) =>
  person.employeeId.toLowerCase() === employeeId.toLowerCase();

// A value as the panel shows it: a note formatted, a web link as a link, and anything else in
// words, or what its column calls having none.
function Value({ column, value }: { column: Column; value: unknown }) {
  const kind = cellKinds[column.kind];
  if (column.kind === "note") {
    return value === "" ? (
      <Text c="dimmed">None</Text>
    ) : (
      <NoteView note={value as string} />
    );
  }
  if (column.kind === "link") {
    return value === null ? (
      <Text c="dimmed">None</Text>
    ) : (
      <LinkCell link={value as WebLink} />
    );
  }
  const words = kind.inWords(
    column,
    value as Parameters<typeof kind.inWords>[1],
  );
  return words === "" ? (
    <Text c="dimmed">{column.emptyLabel ?? "None"}</Text>
  ) : (
    <Text>{words}</Text>
  );
}

// Another person, whom choosing shows in the panel instead.
function PersonLink({
  person,
  onPerson,
}: {
  person: Person;
  onPerson: (employeeId: string) => void;
}) {
  return (
    <Anchor
      component="button"
      type="button"
      ta="start"
      onClick={() => {
        onPerson(person.employeeId);
      }}
    >
      {person.preferredName}
    </Anchor>
  );
}

function Row({
  column,
  person,
  show,
  children,
}: {
  column: Column;
  person: Person;
  show: Show;
  children?: ReactNode;
}) {
  const { draft } = person;
  // Beside live, a value a draft changes is marked, with the live value under it.
  const drafted =
    show === "both" &&
    draft?.action === "changed" &&
    draft.changed.includes(column.changesWith ?? column.key);
  return (
    <div className={classes.row}>
      <dt className={classes.label}>{column.label}</dt>
      <dd className={classes.value}>
        <Group gap={6} wrap="nowrap" align="baseline">
          {children ?? <Value column={column} value={column.value(person)} />}
          {drafted && <DraftMark draft={draft} />}
        </Group>
        {drafted && (
          <Group
            gap={6}
            wrap="nowrap"
            align="baseline"
            className={classes.live}
          >
            <Value column={column} value={column.live(draft)} />
            <StatusMark tone="live">Live</StatusMark>
          </Group>
        )}
      </dd>
    </div>
  );
}

export function PersonPanel({
  employeeId,
  show,
  showDates,
  seesChart = true,
  narrow,
  elsewhere,
  onPerson,
  onClose,
}: {
  employeeId: string;
  // What the Draft menu of the page beside it shows.
  show: Show;
  showDates: boolean;
  // Whether the reader sees the org chart, which gives each team's colour.
  seesChart?: boolean;
  narrow: boolean;
  // A link to the person on the other page that shows people, such as the org chart from People.
  elsewhere: (person: Person) => ReactNode;
  onPerson: (employeeId: string) => void;
  onClose: () => void;
}) {
  const query = useQuery(peopleQuery);
  const lists = useQuery(listsQuery);
  const chart = useQuery({ ...orgChartQuery, enabled: seesChart });
  useEffect(() => {
    focusSoon(titleId);
  }, [employeeId]);
  const frame = (title: string, content: ReactNode) => (
    <SidePanelFrame
      id={personPanelId}
      titleId={titleId}
      title={title}
      narrow={narrow}
      close={{ label: "Close details", onClose }}
    >
      <div className={sidePanelScroll}>{content}</div>
    </SidePanelFrame>
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
  const everyone = peopleAsShown(query.data.people, show).filter(
    (person) => !isHire(person),
  );
  const person = everyone.find((one) => sameId(one, employeeId));
  const drafted = query.data.people.find(
    (one) => !isHire(one) && sameId(one, employeeId),
  );
  if (person === undefined) {
    return frame(
      drafted?.preferredName ?? "Details",
      <Text>
        {drafted === undefined
          ? `Nobody in People has the ID ${employeeId}.`
          : drafted.draft?.action === "deleted"
            ? `${drafted.preferredName} is drafted to be removed.`
            : drafted.draft?.state === "rejected"
              ? `Adding ${drafted.preferredName} was rejected.`
              : `${drafted.preferredName} is only drafted to be added, so is not live yet.`}
      </Text>,
    );
  }
  const columns = columnsFor(
    query.data.fields,
    show === "live" ? liveLists(lists.data) : lists.data,
    query.data.order,
    showDates,
    everyone,
    query.data.positionHidden !== true,
  ).filter((column) => column.offeredOn?.("person") ?? true);
  const byKey = new Map(columns.map((column) => [column.key, column]));
  const section = (keys: readonly string[]) =>
    keys.flatMap((key) => {
      const column = byKey.get(key);
      return column === undefined ? [] : [column];
    });
  const added = columns.filter((column) => column.field !== undefined);
  const manager = everyone.find(({ id }) => id === person.manager?.id);
  // Today's reports, and those who have not started yet, by name; those who have left are not.
  const day = today();
  const reportsAmong = (people: readonly Person[]) =>
    people.filter(
      (one) =>
        !isHire(one) &&
        one.manager?.id === person.id &&
        (typeof one.endDate !== "string" || one.endDate >= day),
    );
  const shownIds = new Set(reportsAmong(everyone).map(({ id }) => id));
  // Beside live, a report drafted in is marked as a draft, and one drafted away stays, dimmed and
  // marked Live, as a drafted value is.
  const liveReports =
    show === "both" ? reportsAmong(livePeople(query.data.people)) : [];
  const liveIds = new Set(liveReports.map(({ id }) => id));
  const reports = [
    ...reportsAmong(everyone),
    ...liveReports.filter(({ id }) => !shownIds.has(id)),
  ].sort((a, b) => byName.compare(a.preferredName, b.preferredName));
  const colour: PaletteColour | null =
    chart.data?.people.find(({ id }) => id === person.id)?.teamColour ?? null;
  const left = typeof person.endDate === "string" && person.endDate < day;
  const position = byKey.get("positionId");
  const rowOf = (column: Column) => {
    const special =
      column.key === "managerId" && manager !== undefined ? (
        <>
          <PersonLink person={manager} onPerson={onPerson} />
          {person.managerLeft === true && (
            <StatusMark tone="warning" spaced>
              Left
            </StatusMark>
          )}
        </>
      ) : column.key === "teamName" &&
        colour !== null &&
        typeof person.teamName === "string" ? (
        <Group gap={6} wrap="nowrap">
          <Swatch colour={colour} size={8} />
          <Text>{person.teamName}</Text>
        </Group>
      ) : undefined;
    return (
      <Row key={column.key} column={column} person={person} show={show}>
        {special}
      </Row>
    );
  };
  return frame(
    person.preferredName,
    <Stack gap="lg">
      <div>
        <Group gap={0} align="baseline">
          {position !== undefined && (
            <Text c="dimmed">
              {cellKinds.choice.inWords(position, position.value(person))}
            </Text>
          )}
          {show === "both" &&
            person.draft !== undefined &&
            person.draft.action !== "changed" && (
              <DraftMark draft={person.draft} />
            )}
          {left && (
            <StatusMark tone="warning" spaced>
              Left
            </StatusMark>
          )}
        </Group>
        {elsewhere(person)}
      </div>
      <section aria-labelledby="person-reporting">
        <h3 className={classes.heading} id="person-reporting">
          Reporting
        </h3>
        <dl className={classes.list}>
          {section(reportingKeys).map(rowOf)}
          <div className={classes.row}>
            <dt className={classes.label}>Direct reports</dt>
            <dd className={classes.value}>
              {reports.length === 0 ? (
                <Text c="dimmed">None</Text>
              ) : (
                <ul className={classes.reports}>
                  {reports.map((report) => (
                    <li
                      key={report.id}
                      className={
                        shownIds.has(report.id) ? undefined : classes.live
                      }
                    >
                      <PersonLink person={report} onPerson={onPerson} />
                      {typeof report.startDate === "string" &&
                        report.startDate > day && (
                          <Text span c="dimmed" size="sm" ml={8}>
                            Starts {formatDay(report.startDate)}
                          </Text>
                        )}
                      {show === "both" &&
                        !liveIds.has(report.id) &&
                        report.draft !== undefined && (
                          <DraftMark draft={report.draft} />
                        )}
                      {!shownIds.has(report.id) && (
                        <StatusMark tone="live" spaced>
                          Live
                        </StatusMark>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </dd>
          </div>
        </dl>
      </section>
      <section aria-labelledby="person-details">
        <h3 className={classes.heading} id="person-details">
          Details
        </h3>
        <dl className={classes.list}>{section(detailKeys).map(rowOf)}</dl>
      </section>
      {added.length > 0 && (
        <section aria-labelledby="person-columns">
          <h3 className={classes.heading} id="person-columns">
            Columns
          </h3>
          <dl className={classes.list}>{added.map(rowOf)}</dl>
        </section>
      )}
    </Stack>,
  );
}
