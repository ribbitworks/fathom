// SPDX-License-Identifier: Apache-2.0

// A person's timeline beside People: its read, its changes in words, the preview ending their
// details, and its panel.

import {
  type Person,
  type TimelineChange,
  type TimelineDay,
  type TimelineField,
  type TimelineRecord,
  timelineSchema,
} from "@fathom/shared";
import { Anchor } from "@mantine/core";
import { queryOptions, useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { getJson } from "./api.ts";
import { emptiedWords, noneInSentence } from "./draft-marks.ts";
import { foldControl } from "./folded-note.tsx";
import { focusSoon } from "./focus.ts";
import { LoadProblem } from "./load-problem.tsx";
import { peopleQuery } from "./people.ts";
import { isHire } from "./people-rows.ts";
import type { Phrase } from "./phrase.tsx";
import classes from "./record-details.module.css";
import { RecordSection } from "./record-details.tsx";
import {
  type DayLink,
  RecordTimeline,
  TimelineDayRow,
  type TimelineDayShown,
} from "./record-timeline.tsx";
import { type SidePanel, SidePanelFrame } from "./side-panel.tsx";
import { today } from "./today.ts";

// Under the people's key, so whatever reloads the people reloads it.
export const personTimelineQuery = (personId: string) =>
  queryOptions({
    queryKey: [...peopleQuery.queryKey, personId, "timeline"],
    queryFn: () =>
      getJson(
        `/api/people/${encodeURIComponent(personId)}/timeline`,
        timelineSchema,
      ),
  });

// Every field named, and the kind of record each one's values are, which the compiler checks.
const fields: Record<
  TimelineField,
  { name: string; links?: keyof TimelineLinks }
> = {
  filled: { name: "Filled", links: "hire" },
  start: { name: "Start" },
  manager: { name: "Manager", links: "person" },
  featureTeams: { name: "Feature teams", links: "team" },
  leads: { name: "Leads", links: "team" },
  end: { name: "End" },
};

// How a change's records link: a person to their details, a team to the org chart, a planned hire
// by its key.
export interface TimelineLinks {
  person: (record: TimelineRecord) => (() => void) | undefined;
  team: (record: TimelineRecord) => (() => void) | undefined;
  hire: (record: TimelineRecord) => (() => void) | undefined;
}

const linkOf = (kind: keyof TimelineLinks, links: TimelineLinks) => {
  switch (kind) {
    case "person":
      return links.person;
    case "team":
      return links.team;
    case "hire":
      return links.hire;
  }
};

// A change in words: the field, the new value, then what it changed from; a first value alone; a
// list's part added or removed; Start and End alone.
export function timelineWords(
  change: TimelineChange,
  links: TimelineLinks,
): Phrase {
  const { name, links: kind } = fields[change.field];
  const value = (record: TimelineRecord) => {
    const onShow = kind === undefined ? undefined : linkOf(kind, links)(record);
    const shown = change.field === "filled" ? `#${record.name}` : record.name;
    return onShow === undefined ? { value: shown } : { value: shown, onShow };
  };
  if (change.value === undefined) return [{ strong: name }];
  const words: Phrase[number][] = [
    { strong: name },
    " ",
    change.value === null ? { value: emptiedWords(name) } : value(change.value),
  ];
  if (change.part !== undefined) words.push(` ${change.part}`);
  if (change.was !== undefined) {
    words.push(
      ...(change.was === null
        ? [` changed from ${noneInSentence(name)}`]
        : [" changed from ", value(change.was)]),
    );
  }
  if (change.others !== undefined) {
    words.push(
      `, with ${String(change.others)} ${change.others === 1 ? "other" : "others"}`,
    );
  }
  return words;
}

const inWords = (
  days: readonly TimelineDay[],
  links: TimelineLinks,
): TimelineDayShown[] =>
  days.map(({ day, changes }) => ({
    day,
    changes: changes.map((change) => timelineWords(change, links)),
  }));

const panelTitleId = "person-timeline-title";
export const timelinePanelId = "person-timeline-panel";
const showButtonId = "person-timeline-show";

// What a person's details and the timeline's panel need of the page.
interface TimelineContext {
  personId: string;
  shownOn: string | undefined;
  links: TimelineLinks;
  dayLink: DayLink | undefined;
}

// Opens the person's timeline, where focus goes back once it closes.
function ShowTimeline({ onOpen }: { onOpen: () => void }) {
  return (
    <Anchor
      id={showButtonId}
      component="button"
      type="button"
      className={foldControl}
      onClick={onOpen}
    >
      Show timeline
    </Anchor>
  );
}

// The end of a person's details: the next day of changes after the day shown and the latest on or
// before it, then Show timeline.
export function TimelinePreview({
  personId,
  shownOn,
  links,
  dayLink,
  onOpen,
}: TimelineContext & { onOpen: () => void }) {
  const query = useQuery(personTimelineQuery(personId));
  const now = today();
  const shown = shownOn ?? now;
  const days = inWords(query.data?.days ?? [], links);
  const next = days.find(({ day }) => day > shown);
  const last = days.findLast(({ day }) => day <= shown);
  return (
    <RecordSection
      id="person-timeline"
      title="Timeline"
      body={
        query.isError ? (
          <LoadProblem
            what="the timeline"
            onRetry={() => {
              void query.refetch();
            }}
          />
        ) : (
          <>
            <dl className={classes.list}>
              {[next, last].flatMap((day) =>
                day === undefined
                  ? []
                  : [
                      <TimelineDayRow
                        key={day.day}
                        day={day}
                        today={now}
                        marked={false}
                        dayLink={dayLink}
                      />,
                    ],
              )}
            </dl>
            <ShowTimeline onOpen={onOpen} />
          </>
        )
      }
    />
  );
}

function PersonTimelinePanel({
  personId,
  name,
  shownOn,
  links,
  dayLink,
  narrow,
  onClose,
}: TimelineContext & { name: string; narrow: boolean; onClose: () => void }) {
  const query = useQuery(personTimelineQuery(personId));
  const now = today();
  return (
    <SidePanelFrame
      id={timelinePanelId}
      titleId={panelTitleId}
      title="Timeline"
      subtitle={name}
      narrow={narrow}
      close={{ label: "Close timeline", onClose }}
    >
      {query.isError ? (
        <LoadProblem
          what="the timeline"
          onRetry={() => {
            void query.refetch();
          }}
        />
      ) : (
        <RecordTimeline
          days={inWords(query.data?.days ?? [], links)}
          today={now}
          shown={shownOn ?? now}
          dayLink={dayLink}
        />
      )}
    </SidePanelFrame>
  );
}

// A person's timeline on People: what its records open, which days move the page, the stack with
// its panel when it is open, and what the person's details need to show its preview. None for a
// planned hire, or a role that doesn't see start and end dates.
export function usePersonTimeline({
  people,
  shown,
  shownOn,
  opened,
  onShow,
  showDates,
  seesFeatureTeams,
  dates,
  leave,
  showRecord,
  open,
  narrow,
}: {
  people: readonly Person[] | undefined;
  shown: Person | undefined;
  shownOn: string | undefined;
  opened: boolean;
  onShow: (opened: boolean) => void;
  showDates: boolean;
  seesFeatureTeams: boolean;
  // Moving People to another day, and whether it shows later days too, for a role that sees others.
  dates:
    | { laterDays: boolean; onDay: (day: string | undefined) => void }
    | undefined;
  leave: (go: () => void) => void;
  showRecord: (employeeId: string) => void;
  open: string | undefined;
  narrow: boolean;
}): {
  stacked: (panels: SidePanel[]) => SidePanel[];
  details:
    | (Omit<TimelineContext, "personId" | "shownOn"> & { onOpen: () => void })
    | undefined;
} {
  const navigate = useNavigate();
  if (!showDates || shown === undefined || isHire(shown)) {
    return { stacked: (panels) => panels, details: undefined };
  }
  const links: TimelineLinks = {
    person: ({ id }) => {
      const employeeId = people?.find((one) => one.id === id)?.employeeId;
      return employeeId === undefined
        ? undefined
        : () => {
            showRecord(employeeId);
          };
    },
    team: ({ id }) =>
      seesFeatureTeams
        ? () => {
            leave(() => {
              void navigate({
                to: "/org-chart",
                search: { view: "feature-teams", featureTeam: id, open },
              });
            });
          }
        : undefined,
    hire: ({ keyNumber }) =>
      keyNumber === undefined
        ? undefined
        : () => {
            leave(() => {
              void navigate({
                to: "/go/$kind/$keyNumber",
                params: { kind: "hire", keyNumber: String(keyNumber) },
              });
            });
          },
  };
  const dayLink: DayLink | undefined =
    dates === undefined
      ? undefined
      : (day) =>
          day > today() && !dates.laterDays
            ? undefined
            : () => {
                leave(() => {
                  dates.onDay(day === today() ? undefined : day);
                });
              };
  const panel: SidePanel | undefined = opened
    ? {
        key: "person-timeline",
        id: timelinePanelId,
        name: "timeline",
        node: (
          <PersonTimelinePanel
            personId={shown.id}
            name={shown.preferredName}
            shownOn={shownOn}
            links={links}
            dayLink={dayLink}
            narrow={narrow}
            onClose={() => {
              onShow(false);
              focusSoon(showButtonId);
            }}
          />
        ),
      }
    : undefined;
  return {
    // The panels given are the details the timeline opens from. A narrow screen shows the panel
    // opened last, or the top one of those opened together, as from an address naming both, so
    // there it goes above.
    stacked: (panels) => {
      if (panel === undefined) return panels;
      const fitted = panels.map((details) => ({ ...details, fits: true }));
      return narrow ? [panel, ...fitted] : [...fitted, panel];
    },
    details: {
      links,
      dayLink,
      onOpen: () => {
        onShow(true);
        focusSoon(panelTitleId);
      },
    },
  };
}
