// SPDX-License-Identifier: Apache-2.0

// The Org chart page: the reporting lines, each person under their manager, as of today or another
// day, with drafts drawn beside the live chart, and a person's details beside it.

import {
  allChartLevels,
  type FeatureTeams,
  mayDateLineChange,
  mayDateChange,
} from "@fathom/shared";
import { Anchor, Box, Button, Group, Text } from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ReactFlowProvider } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useMemo, useState } from "react";
import { useFeatureTeamActions } from "./feature-team-actions.ts";
import {
  type FeatureTeamEdits,
  FeatureTeamPanel,
  featureTeamPanelId,
  noFeatureTeamEdits,
} from "./feature-team-panel.tsx";
import { FeatureTeamsList } from "./feature-teams-list.tsx";
import { featureTeamPeople, featureTeamsQueryOn } from "./feature-teams.ts";
import { Loading, LoadProblem } from "./load-problem.tsx";
import { Chart } from "./org-chart-canvas.tsx";
import { cardLinkId } from "./org-chart-cards.tsx";
import { DateControl } from "./date-control.tsx";
import {
  chartPeople,
  chartAddressOf,
  chartChoiceKeys,
  type ChartSearch,
  chartViewSearch,
  chartDays,
  leadOf,
  findFieldId,
  type OrgTree,
  orgChartQuery,
  orgChartQueryOn,
  reportColours,
  teamOf,
  treeOf,
} from "./org-chart.ts";
import { focusSoon } from "./focus.ts";
import { ModeSwitch, PageHeader } from "./page-header.tsx";
import { personUpdate } from "./person-change.ts";
import { noteQuestion } from "./note-editing.tsx";
import { usePersonNotes, useShownId } from "./person-editing.tsx";
import { useDiscardQuestion } from "./discard-question.tsx";
import { PersonPanel, personPanelId } from "./person-panel.tsx";
import { type PeopleData, peopleQuery } from "./people.ts";
import { useSaving } from "./saving.ts";
import { useNarrow, WithSidePanel } from "./side-panel.tsx";
import { DraftView } from "./status-mark.tsx";
import { useSavedViews } from "./saved-views.tsx";
import { emptyView, viewProps } from "./table-view.ts";
import { type PageParts, ViewsMenu } from "./table-controls.tsx";
import { today } from "./today.ts";

// What a view keeps of the chart's own choices, as the Save view dialog names them, the team shown
// alone by its manager, found on the whole chart.
const chartParts =
  (everyone: OrgTree): PageParts =>
  ({ choices = {} }) => {
    const { teams, levels, team } = choices;
    const lead = leadOf(everyone, typeof team === "string" ? team : undefined);
    return [
      ...(teams === "feature"
        ? [{ name: "Teams", value: "Feature teams" }]
        : []),
      ...(typeof levels === "string"
        ? [
            {
              name: "Levels",
              value: levels === allChartLevels ? "All" : levels,
            },
          ]
        : []),
      ...(lead === undefined
        ? []
        : [
            { name: "Shown alone", value: `The team of ${lead.preferredName}` },
          ]),
    ];
  };

// On another day, only what takes effect from it is changed: renaming, colouring and removing a team
// do not.
const undatedChangesLeftOut = (edits: FeatureTeamEdits): FeatureTeamEdits => ({
  ...edits,
  undated: false,
});

const chartModes = [
  { value: "reporting", label: "Reporting teams" },
  { value: "feature-teams", label: "Feature teams" },
] as const;

export function OrgChartPage({
  search,
  onSearch,
  showDates = false,
  otherDates = true,
  futureDates = true,
  canEdit = false,
  changesDates = false,
  featureTeamEdits = noFeatureTeamEdits,
  canShareViews = false,
}: {
  featureTeamEdits?: FeatureTeamEdits;
  canShareViews?: boolean;
  search: ChartSearch;
  // Whether the reader may change people, in a person's details, and their teams' names and colours.
  canEdit?: boolean;
  // Whether the reader may change Personal details, which dating a change earlier needs.
  changesDates?: boolean;
  // Whether the reader sees Personal details, such as dates, in a person's details.
  showDates?: boolean;
  // Whether the role sees the chart on other dates, and on future ones, which need classes of data
  // beyond General.
  otherDates?: boolean;
  futureDates?: boolean;
  onSearch: (search: ChartSearch, replace: boolean) => void;
}) {
  const featureView = search.teams === "feature";
  const { day, peopleDay } = chartDays(search.day, {
    otherDates,
    futureLines: futureDates,
    featureTeams: featureView,
  });
  // Feature teams and reporting lines change from the day shown for those who may date changes
  // then; people's other details change only today.
  const dated = day !== undefined;
  const linesChangeOnDay =
    day !== undefined &&
    canEdit &&
    mayDateLineChange(changesDates, day, today());
  const changesOnDay =
    day !== undefined &&
    (featureView
      ? featureTeamEdits.members &&
        mayDateChange(featureTeamEdits.dates, day, today())
      : linesChangeOnDay);
  const fixedDay = dated && !changesOnDay;
  const query = useQuery(orgChartQueryOn(peopleDay));
  const narrow = useNarrow();
  // A person's details and a note of theirs being written, beside the chart.
  const notes = usePersonNotes();
  const people = useQuery(peopleQuery);
  const shownId = useShownId(search.open, people.data?.people);
  const note = notes.note(shownId);
  const question = useDiscardQuestion();
  // Showing someone else's details, or none, while a note has been changed asks first.
  const go = (next: ChartSearch, replace: boolean) => {
    question.ask(
      notes.changing && next.open !== search.open ? noteQuestion : undefined,
      () => {
        notes.discard();
        onSearch(next, replace);
      },
    );
  };
  const teamsQuery = useQuery({
    ...featureTeamsQueryOn(day),
    enabled: featureView,
  });
  // Also read only for the moment another day's data stays on screen while today's loads.
  const readOnly =
    fixedDay || query.isPlaceholderData || teamsQuery.isPlaceholderData;
  const show = readOnly ? "live" : (search.show ?? "both");
  const [creating, setCreating] = useState(false);
  const everyone = useMemo(() => {
    if (query.data === undefined) return undefined;
    if (!featureView) {
      return treeOf(chartPeople(query.data, show, day ?? today()));
    }
    return teamsQuery.data === undefined
      ? undefined
      : treeOf(
          featureTeamPeople(teamsQuery.data.teams, query.data.people, show),
        );
  }, [query.data, show, featureView, teamsQuery.data, day]);
  const lead =
    everyone === undefined ? undefined : leadOf(everyone, search.team);
  // The chart's view, from the address, as any page's is; what isn't part of it stays as it is.
  const { view, applied, onView, onApply } = viewProps(
    // A team shown alone is kept in a view by its lead's own ID, though an old address names them
    // by Employee ID, and one not on the chart is no part of it.
    chartViewSearch({ ...search, team: lead?.id }),
    (next, replace) => {
      go(
        {
          person: search.person,
          open: search.open,
          featureTeam: search.featureTeam,
          day: search.day,
          ...chartAddressOf(next),
        },
        replace,
      );
    },
    chartChoiceKeys,
  );
  const views = useSavedViews({
    table: "org-chart",
    within: orgChartQuery.queryKey,
    view,
    applied,
    onApply,
    canShare: canShareViews,
  });
  const { save, undoable } = useSaving<PeopleData>({
    queryKey: peopleQuery.queryKey,
    removed: "Someone else has removed this. The people have been refreshed.",
    blocked: views.opened,
    refreshes: [orgChartQuery.queryKey],
  });
  const openTeam = (id: string | undefined) => {
    setCreating(false);
    go({ ...search, person: undefined, featureTeam: id }, false);
  };
  const teamActions = useFeatureTeamActions(openTeam, views.opened);
  const openedTeam = teamsQuery.data?.teams.find(
    ({ id }) => id === search.featureTeam,
  );
  // Live only is read only, as on tables, managers' teams are not changed on the feature team chart,
  // and team names and colours, which take no date, change only today.
  const editsTeams = show === "live" || featureView || dated ? false : canEdit;
  const tree = useMemo(
    () =>
      everyone === undefined || lead === undefined
        ? everyone
        : teamOf(everyone, lead.id),
    [everyone, lead],
  );
  const colours = useMemo(
    () => (everyone === undefined ? new Map() : reportColours(everyone)),
    [everyone],
  );
  const dateRow = otherDates && (
    <DateControl
      day={day}
      laterDays={featureView || futureDates}
      onDay={(next) => {
        setCreating(false);
        go({ ...search, day: next }, false);
      }}
    />
  );
  return (
    <DraftView show={show}>
      <Box mb="md">
        <PageHeader
          title="Org chart"
          beside={
            <ModeSwitch
              label="Teams drawn"
              modes={chartModes}
              mode={featureView ? "feature-teams" : "reporting"}
              onMode={(mode) => {
                // The person found, or whose details are open, stays found, so the chart starts at
                // them.
                go(
                  {
                    show: search.show,
                    open: search.open,
                    person: search.person ?? search.open,
                    day: search.day,
                    levels: search.levels,
                    view: search.view,
                    ...(mode === "feature-teams"
                      ? { teams: "feature" as const }
                      : {}),
                  },
                  false,
                );
              }}
            />
          }
          action={
            lead !== undefined && (
              <Group gap="sm">
                <Text size="sm">
                  Only the team of {lead.preferredName} is shown.
                </Text>
                <Button
                  variant="default"
                  onClick={() => {
                    go(
                      {
                        person: search.person,
                        show: search.show,
                        open: search.open,
                        day: search.day,
                        levels: search.levels,
                        view: search.view,
                      },
                      false,
                    );
                  }}
                >
                  Show everyone
                </Button>
              </Group>
            )
          }
        />
      </Box>
      {query.isPending || (featureView && teamsQuery.isPending) ? (
        <Loading />
      ) : query.isError || tree === undefined || everyone === undefined ? (
        <div>
          {dateRow}
          <LoadProblem
            what="the org chart"
            onRetry={() => {
              void query.refetch();
              if (featureView) void teamsQuery.refetch();
            }}
          />
        </div>
      ) : tree.people.size === 0 && !featureView ? (
        <div>
          {dateRow}
          <Text c="dimmed">Nobody is on the org chart yet.</Text>
        </div>
      ) : (
        <WithSidePanel
          storageKey="fathom-table-panel-width"
          panels={[
            ...(search.open !== undefined
              ? [
                  {
                    key: "person",
                    id: personPanelId,
                    name: "details",
                    node: (
                      <PersonPanel
                        shownOn={peopleDay}
                        employeeId={search.open}
                        teams={featureView ? "feature-teams" : "reporting"}
                        show={show}
                        showDates={showDates}
                        narrow={narrow}
                        elsewhere={(person) => (
                          <Anchor
                            size="sm"
                            renderRoot={(props) => (
                              <Link
                                {...props}
                                to="/people"
                                search={{ search: person.employeeId }}
                              />
                            )}
                          >
                            Show in People
                          </Anchor>
                        )}
                        onPerson={(employeeId) => {
                          go(
                            { ...search, open: employeeId, person: employeeId },
                            false,
                          );
                        }}
                        onFollow={(employeeId) => {
                          onSearch({ ...search, open: employeeId }, true);
                        }}
                        notes={notes}
                        changesFrom={linesChangeOnDay ? day : undefined}
                        onChange={
                          canEdit && !readOnly && (!dated || linesChangeOnDay)
                            ? (person, change) => {
                                save({
                                  ...personUpdate(
                                    person,
                                    change,
                                    person.preferredName,
                                  ),
                                  onSaved: (changeSetId, before) => {
                                    undoable(changeSetId, before);
                                  },
                                });
                              }
                            : undefined
                        }
                        onClose={() => {
                          const open = (search.open as string).toLowerCase();
                          const card = [...everyone.people.values()].find(
                            ({ employeeId }) =>
                              employeeId?.toLowerCase() === open,
                          );
                          go({ ...search, open: undefined }, false);
                          // A person whose card is not drawn leaves focus on finding them.
                          focusSoon(
                            ...(card === undefined
                              ? []
                              : [cardLinkId(card.id)]),
                            findFieldId,
                          );
                        }}
                      />
                    ),
                  },
                ]
              : []),
            ...(note === undefined ? [] : [note]),
            ...(featureView && (creating || openedTeam !== undefined)
              ? [
                  {
                    key: `feature-team ${openedTeam?.id ?? "new"}`,
                    id: featureTeamPanelId,
                    name: "feature team",
                    node: (
                      <FeatureTeamPanel
                        key={openedTeam?.id ?? "new"}
                        team={creating ? undefined : openedTeam}
                        day={day}
                        people={query.data.people}
                        edits={
                          readOnly
                            ? noFeatureTeamEdits
                            : dated
                              ? undatedChangesLeftOut(featureTeamEdits)
                              : featureTeamEdits
                        }
                        show={show}
                        narrow={narrow}
                        actions={teamActions}
                        onClose={() => {
                          openTeam(undefined);
                        }}
                      />
                    ),
                  },
                ]
              : []),
          ]}
        >
          <ReactFlowProvider
            key={`${featureView ? "feature-teams" : "reporting"} ${lead?.id ?? ""}`}
          >
            <Chart
              tree={tree}
              everyone={everyone}
              colours={colours}
              alone={lead !== undefined}
              editsTeams={editsTeams}
              show={show}
              fixedDay={fixedDay}
              search={search}
              onSearch={go}
              dateRow={dateRow}
              views={
                <ViewsMenu
                  saved={views.saved}
                  columns={[]}
                  view={view}
                  onView={onView}
                  onClear={() => {
                    onView(emptyView);
                  }}
                  pageParts={chartParts(everyone)}
                />
              }
              {...(featureView
                ? {
                    teamsList: (
                      <FeatureTeamsList
                        teams={(teamsQuery.data as FeatureTeams).teams}
                        show={show}
                        canAdd={featureTeamEdits.members && show !== "live"}
                        onOpen={openTeam}
                        onNew={() => {
                          go({ ...search, featureTeam: undefined }, false);
                          setCreating(true);
                        }}
                      />
                    ),
                  }
                : {})}
            />
          </ReactFlowProvider>
        </WithSidePanel>
      )}
      {question.dialog}
      {views.dialogs}
    </DraftView>
  );
}
