// SPDX-License-Identifier: Apache-2.0

// The Org chart page, for users who see the org chart: today's reporting lines, each person under
// their manager. Managers' reports can be hidden and shown again, a number of levels shown at once,
// the chart panned, zoomed, and fitted to the screen, and a person found by name, which brings them
// to the centre. A manager's team can be shown alone. For those who see people, a person's card
// finds them and shows their details in a side panel beside the chart. The person found, the team
// shown alone, and the person whose details are shown, are kept in the page's address. Each team's
// cards, and the lines to them, are drawn in its colour, which reaches down to the teams below that
// have none, even when a team is shown alone. The Draft menu, as on tables, draws drafts of
// managers, positions and team names beside the live chart, applied to it, or not at all, which
// leaves the chart read only; its choice is kept in the address. A date control draws the chart as
// of another day, kept in the address too, where feature teams and reporting lines change from that
// day, for those who may date changes then, and everything else is read only.

import {
  type FeatureTeams,
  mayDateLineChange,
  mayDateChange,
  type PaletteColour,
  type Show,
} from "@fathom/shared";
import {
  ActionIcon,
  Alert,
  Anchor,
  Button,
  Group,
  Loader,
  Paper,
  SegmentedControl,
  Stack,
  Text,
  Tooltip,
  UnstyledButton,
  VisuallyHidden,
  useComputedColorScheme,
} from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  type Edge,
  Handle,
  type Node,
  type NodeProps,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  type CSSProperties,
  type MouseEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Swatch } from "./colour-swatch.tsx";
import { TeamColourMenu } from "./team-colour-menu.tsx";
import { TeamNameEditor } from "./team-name-editor.tsx";
import { TeamsPanel } from "./teams-panel.tsx";
import { useFeatureTeamActions } from "./feature-team-actions.ts";
import {
  type FeatureTeamEdits,
  FeatureTeamPanel,
  featureTeamPanelId,
  noFeatureTeamEdits,
} from "./feature-team-panel.tsx";
import { FeatureTeamsList } from "./feature-teams-list.tsx";
import { featureTeamPeople, featureTeamsQueryOn } from "./feature-teams.ts";
import { colourVariable } from "./colours.ts";
import { Icon } from "./icons.tsx";
import { ChartControls } from "./org-chart-controls.tsx";
import { OrgChartDate } from "./org-chart-date.tsx";
import {
  hasApprovedName,
  cardWidth,
  changeOf,
  chartPeople,
  type ChartPerson,
  fitOptions,
  heightOf,
  stackIndent,
  type ChartSearch,
  chartDay,
  collapsedBelow,
  levelsOf,
  findFieldId,
  managersAbove,
  type OrgTree,
  orgChartQuery,
  orgChartQueryOn,
  noTeamEdits,
  type Placed,
  type TeamEdits,
  placed,
  reportColours,
  teamOf,
  treeOf,
} from "./org-chart.ts";
import classes from "./org-chart.module.css";
import { focusSoon } from "./focus.ts";
import { PageHeader } from "./page-header.tsx";
import { personUpdate } from "./person-change.ts";
import { noteQuestion } from "./note-editing.tsx";
import { usePersonNotes, useShownId } from "./person-editing.tsx";
import { useDiscardQuestion } from "./discard-question.tsx";
import { PersonPanel, personPanelId } from "./person-panel.tsx";
import { type PeopleData, peopleQuery } from "./people.ts";
import { useSaving } from "./saving.ts";
import { motionLasts, useNarrow, WithSidePanel } from "./side-panel.tsx";
import { DraftMark, LiveLine, StatusMark } from "./status-mark.tsx";
import { formatMonth } from "./table-view.ts";
import { DraftMenu } from "./table-controls.tsx";
import { today } from "./today.ts";

interface CardData extends Record<string, unknown> {
  person: ChartPerson;
  // The colour of the team the person is on, if it has one.
  colour: PaletteColour | undefined;
  reports: number;
  // Whether those under the card are a feature team's members rather than reports.
  members: boolean;
  // Opens the feature team the card leads, on the feature team chart.
  onFeatureTeam: (() => void) | undefined;
  collapsed: boolean;
  found: boolean;
  // The chart's address with the person found and their details shown beside it.
  opened: ChartSearch;
  // Shows only the person's team; absent unless they manage someone, are known by more than their
  // name, and are not already shown alone.
  onTeam: (() => void) | undefined;
  // Whether the reader may change the name and colour of the team the person leads.
  teamEdits: TeamEdits;
  onToggle: (id: string) => void;
  // Shows the person's details beside the chart; absent for someone People does not show the reader.
  onOpen: (() => void) | undefined;
}

type CardNode = Node<CardData, "person">;

// A plain click shows the person's details beside the chart; any other, such as one opening a new
// tab, is left to the browser.
const plainClick = (event: MouseEvent) =>
  event.button === 0 &&
  !event.metaKey &&
  !event.ctrlKey &&
  !event.shiftKey &&
  !event.altKey;

// The name of the team a person leads, or its draft: renamed from their card by those who may, with
// the colour's dot before it, chosen there by those who may once the name is approved. A drafted
// name is marked, with the live one, if any, under it, dimmed and marked Live.
function TeamRow({
  person,
  teamEdits,
  onFeatureTeam,
}: {
  person: ChartPerson;
  teamEdits: TeamEdits;
  // Opens the feature team the card leads, on the feature team chart.
  onFeatureTeam?: (() => void) | undefined;
}) {
  const { renamed } = person;
  if (person.teamName === null && renamed === undefined) return null;
  return (
    <>
      <Group gap={6} wrap="nowrap">
        {teamEdits.colours &&
        person.teamName !== null &&
        hasApprovedName(person) ? (
          <TeamColourMenu
            teamId={person.id}
            current={person.teamColour}
            team={person.teamName}
          />
        ) : (
          person.teamColour !== null && (
            <Swatch colour={person.teamColour} size={8} />
          )
        )}
        {onFeatureTeam !== undefined && person.teamName !== null ? (
          <Anchor
            component="button"
            size="xs"
            className={["nodrag", "nopan"].join(" ")}
            onClick={onFeatureTeam}
          >
            {person.teamName}
          </Anchor>
        ) : teamEdits.names ? (
          <TeamNameEditor
            managerId={person.id}
            managerName={person.preferredName}
            name={person.teamName}
          />
        ) : (
          <Text
            size="xs"
            c="dimmed"
            fs={person.teamName === null ? "italic" : undefined}
            truncate
          >
            {person.teamName ?? "No name"}
          </Text>
        )}
        {renamed !== undefined && <DraftMark draft={changeOf(renamed.draft)} />}
      </Group>
      {renamed !== undefined && renamed.live !== null && (
        <LiveLine className={classes.liveName}>{renamed.live}</LiveLine>
      )}
    </>
  );
}

// The dimmed copy of a person drafted to another manager, under the manager they report to now:
// their name and position, marked Live, opening nothing.
function LiveCopyCard({ data }: { data: CardData }) {
  const { person, colour } = data;
  return (
    <div
      className={[classes.card, classes.liveCopy].join(" ")}
      data-coloured={colour === undefined ? undefined : true}
      style={
        colour === undefined
          ? undefined
          : ({
              "--team-colour": colourVariable(colour, "filled"),
            } as CSSProperties)
      }
    >
      <Handle
        id="row"
        type="target"
        position={Position.Top}
        isConnectable={false}
        className={classes.handle}
      />
      <Handle
        id="stack"
        type="target"
        position={Position.Left}
        isConnectable={false}
        className={classes.handle}
      />
      <div className={classes.name}>
        <span className={classes.label}>{person.preferredName}</span>
        <StatusMark tone="live" spaced>
          Live
        </StatusMark>
      </div>
      {person.position !== null && (
        <Text size="sm" c="dimmed" truncate>
          {person.position}
        </Text>
      )}
    </div>
  );
}

// A person's position, or its draft, marked, with the live one under it, dimmed and marked Live.
function PositionRow({ person }: { person: ChartPerson }) {
  const { repositioned } = person;
  if (person.position === null) return null;
  return (
    <>
      <Group gap={6} wrap="nowrap">
        <Text size="sm" c="dimmed" truncate>
          {person.position}
        </Text>
        {repositioned !== undefined && (
          <DraftMark draft={changeOf(repositioned.draft)} />
        )}
      </Group>
      {repositioned !== undefined && <LiveLine>{repositioned.live}</LiveLine>}
    </>
  );
}

function PersonCard({ data }: NodeProps<CardNode>) {
  if (data.person.liveCopyOf !== undefined) return <LiveCopyCard data={data} />;
  const {
    person,
    colour,
    reports,
    members,
    onFeatureTeam,
    collapsed,
    found,
    opened,
    onTeam,
    teamEdits,
    onToggle,
    onOpen,
  } = data;
  const { planned } = person;
  // A planned hire with no name of its own goes by its position and ID; its card shows the ID as
  // its name, with the position under it as a person's is, so the name fits.
  const shownId = planned?.shownId;
  const madeName = shownId !== undefined;
  const cardName = shownId ?? person.preferredName;
  return (
    <div
      className={classes.card}
      data-found={found || undefined}
      data-planned={planned === undefined ? undefined : true}
      data-draft={
        person.moved !== undefined ||
        person.repositioned !== undefined ||
        person.renamed !== undefined ||
        undefined
      }
      data-coloured={colour === undefined ? undefined : true}
      style={
        colour === undefined
          ? undefined
          : ({
              "--team-colour": colourVariable(colour, "filled"),
            } as CSSProperties)
      }
    >
      <Handle
        id="row"
        type="target"
        position={Position.Top}
        isConnectable={false}
        className={classes.handle}
      />
      <Handle
        id="stack"
        type="target"
        position={Position.Left}
        isConnectable={false}
        className={classes.handle}
      />
      <div className={classes.name}>
        {(person.employeeId === null && person.teamCard !== true) ||
        onOpen === undefined ? (
          <span
            className={[classes.label, madeName ? classes.madeName : ""].join(
              " ",
            )}
          >
            {cardName}
          </span>
        ) : (
          <Link
            id={cardLinkId(person.id)}
            to="/org-chart"
            search={opened}
            className={[classes.label, classes.link, "nodrag", "nopan"].join(
              " ",
            )}
            onClick={(event) => {
              if (!plainClick(event)) return;
              event.preventDefault();
              onOpen();
            }}
          >
            {person.preferredName}
          </Link>
        )}
        {person.moved !== undefined && (
          <DraftMark draft={changeOf(person.moved)} />
        )}
        {person.left === true && (
          <StatusMark tone="warning" spaced>
            Left<VisuallyHidden>: their end date has passed</VisuallyHidden>
          </StatusMark>
        )}
        {onTeam !== undefined && (
          <Tooltip label="Show only this team">
            <ActionIcon
              variant="subtle"
              color="gray"
              size="sm"
              className={[classes.team, "nodrag", "nopan"].join(" ")}
              aria-label={`Show only the team of ${person.preferredName}`}
              onClick={onTeam}
            >
              <Icon name="orgChart" />
            </ActionIcon>
          </Tooltip>
        )}
      </div>
      <PositionRow person={person} />
      {person.movedFrom !== undefined && (
        <Text size="xs" c="dimmed">
          From {person.movedFrom}
        </Text>
      )}
      {planned !== undefined && (
        <StatusMark tone="planned">
          Planned, expected {formatMonth(planned.expected)}
        </StatusMark>
      )}
      <TeamRow
        person={person}
        teamEdits={teamEdits}
        onFeatureTeam={onFeatureTeam}
      />
      {reports > 0 && (
        <UnstyledButton
          className={[classes.toggle, "nodrag", "nopan"].join(" ")}
          aria-expanded={!collapsed}
          onClick={() => {
            onToggle(person.id);
          }}
        >
          {`${collapsed ? "Show" : "Hide"} ${String(reports)} ${members ? (reports === 1 ? "member" : "members") : reports === 1 ? "report" : "reports"}`}{" "}
          <VisuallyHidden>of {person.preferredName}</VisuallyHidden>
        </UnstyledButton>
      )}
      <Handle
        id="row"
        type="source"
        position={Position.Bottom}
        isConnectable={false}
        className={classes.handle}
      />
      {/* Lines to a stack leave from the manager's left, halfway to where the stack starts. */}
      <Handle
        id="stack"
        type="source"
        position={Position.Bottom}
        isConnectable={false}
        className={classes.handle}
        style={{ left: stackIndent / 2 }}
      />
    </div>
  );
}

const nodeTypes = { person: PersonCard };

const cardLinkId = (id: string) => `card-${id}`;

// The levels shown when the chart opens, so a large organization starts readable.
const openLevels = 2;

// How the address names a person, for the team shown alone and the person found. A reader who sees
// people has each person's Employee ID; one who does not has Fathom's own ID for them, which means
// nothing outside Fathom, as a planned hire has for everyone. Null for someone shown by name only,
// who cannot be kept there, and for a Live copy, which the person themselves stands for.
function addressOf(person: ChartPerson, seesPeople: boolean): string | null {
  if (person.nameOnly === true || person.liveCopyOf !== undefined) return null;
  return seesPeople && person.planned === undefined
    ? person.employeeId
    : person.id;
}

function Chart({
  tree,
  everyone,
  seesPeople,
  colours,
  alone,
  teamEdits,
  show,
  search,
  onSearch,
  teamsList,
  fixedDay,
}: {
  // Whether the chart shows another day on which nothing can be changed, drawn as approved, with no
  // drafts to choose among.
  fixedDay: boolean;
  // The list of teams beside the chart, in place of managers' teams, such as feature teams.
  teamsList?: ReactNode;
  tree: OrgTree;
  everyone: OrgTree;
  // The colour each manager's reports are drawn in, worked out from the whole chart.
  colours: ReadonlyMap<string, PaletteColour>;
  // Whether the tree is one manager's team, shown alone.
  alone: boolean;
  // Whether the reader sees people, so cards open them on People and the address names them by
  // Employee ID.
  seesPeople: boolean;
  teamEdits: TeamEdits;
  show: Show;
  search: ChartSearch;
  onSearch: (search: ChartSearch, replace: boolean) => void;
}) {
  const flow = useReactFlow();
  const colorScheme = useComputedColorScheme("light");
  // Someone on two feature teams is found at their first card.
  const byAddress = useMemo(() => {
    const cards = new Map<string, ChartPerson>();
    for (const person of tree.people.values()) {
      const address = addressOf(person, seesPeople);
      if (address !== null && !cards.has(address)) cards.set(address, person);
    }
    return cards;
  }, [tree, seesPeople]);
  // Someone shown by name only has nothing to keep in the address, so is found here alone.
  const [foundByName, setFoundByName] = useState<string | null>(null);
  // A feature team opened is found at its first card, its lead's or its own.
  const teamCard =
    search.featureTeam === undefined
      ? undefined
      : [...tree.people.values()].find(
          (person) =>
            person.featureTeamId === search.featureTeam &&
            person.managerId === null,
        )?.id;
  const found =
    search.person === undefined
      ? (teamCard ?? foundByName)
      : (byAddress.get(search.person)?.id ?? null);
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(() =>
    collapsedBelow(tree, openLevels),
  );
  // Someone who manages nobody in one choice of what to show may manage someone in another, such as
  // the manager a person is drafted from, so the first time they appear their reports are shown or
  // hidden as the levels last chosen have them.
  const [levelsChosen, setLevelsChosen] = useState<number | "all">(openLevels);
  const [managersSeen, setManagersSeen] = useState<ReadonlySet<string>>(
    () => new Set(tree.reports.keys()),
  );
  const added = [...tree.reports.keys()].filter((id) => !managersSeen.has(id));
  if (added.length > 0) {
    setManagersSeen(new Set([...managersSeen, ...added]));
    const below =
      levelsChosen === "all" ? new Set() : collapsedBelow(tree, levelsChosen);
    setCollapsed(
      new Set([...collapsed, ...added.filter((id) => below.has(id))]),
    );
  }
  // Shows the person found, whether from the finder or the address, by showing the managers above
  // them, once each time someone new is found.
  const [shownFor, setShownFor] = useState<string | null>(null);
  if (found !== shownFor) {
    setShownFor(found);
    const above = found === null ? [] : managersAbove(tree, found);
    if (above.some((managerId) => collapsed.has(managerId))) {
      setCollapsed(
        new Set([...collapsed].filter((one) => !above.includes(one))),
      );
    }
  }
  const levels = useMemo(() => levelsOf(tree), [tree]);
  const outside = useMemo(
    () =>
      alone
        ? [...everyone.people.values()].filter(
            (person) =>
              !tree.people.has(person.id) && person.liveCopyOf === undefined,
          )
        : [],
    [alone, everyone, tree],
  );

  const layout = useMemo(() => placed(tree, collapsed), [tree, collapsed]);
  const nodes = useMemo(
    () =>
      layout.cards.map(({ id, x, y }): CardNode => {
        // Every card placed is someone in the tree.
        const person = tree.people.get(id) as ChartPerson;
        const reports = tree.reports.get(id)?.length ?? 0;
        const { employeeId } = person;
        const address = addressOf(person, seesPeople);
        // On the feature team chart, a team's own card, while it has no lead, opens the team; every
        // other card opens its person, as on managers' teams.
        const teamId = person.featureTeamId;
        const opened =
          person.teamCard === true
            ? {
                ...search,
                person: undefined,
                open: undefined,
                featureTeam: teamId,
              }
            : {
                ...search,
                person: address ?? undefined,
                open: employeeId ?? undefined,
                featureTeam: undefined,
              };
        return {
          id,
          type: "person",
          position: { x, y },
          width: cardWidth,
          height: heightOf(person),
          data: {
            person,
            // The top of a team shown alone is drawn without the team above, so without its colour.
            colour:
              person.managerId === null || (alone && tree.roots.includes(id))
                ? undefined
                : colours.get(person.managerId),
            reports,
            collapsed: collapsed.has(id),
            found: id === found,
            opened,
            teamEdits: person.nameOnly === true ? noTeamEdits : teamEdits,
            members: teamId !== undefined,
            onFeatureTeam:
              teamId === undefined || person.teamName === null
                ? undefined
                : () => {
                    onSearch(
                      { ...search, person: undefined, featureTeam: teamId },
                      false,
                    );
                  },
            onTeam:
              teamId !== undefined ||
              address === null ||
              reports === 0 ||
              (alone && tree.roots.includes(id))
                ? undefined
                : () => {
                    onSearch(
                      { team: address, show: search.show, day: search.day },
                      false,
                    );
                  },
            onToggle: (toggled) => {
              centreOnSpace(false);
              setCollapsed((before) => {
                const after = new Set(before);
                if (!after.delete(toggled)) after.add(toggled);
                return after;
              });
            },
            onOpen:
              person.teamCard !== true && (employeeId === null || !seesPeople)
                ? undefined
                : () => {
                    centreOnSpace(true);
                    onSearch(opened, false);
                  },
          },
        };
      }),
    [
      layout,
      tree,
      colours,
      collapsed,
      found,
      alone,
      seesPeople,
      teamEdits,
      search,
      onSearch,
    ],
  );
  const edges = useMemo(
    () =>
      layout.lines.map(({ from, to, stacked }): Edge => {
        const colour = colours.get(from);
        const toLiveCopy = tree.people.get(to)?.liveCopyOf !== undefined;
        return {
          id: `${from}-${to}`,
          source: from,
          target: to,
          type: "smoothstep",
          sourceHandle: stacked ? "stack" : "row",
          targetHandle: stacked ? "stack" : "row",
          // The lines only draw what each card's place already says, and would otherwise be read out
          // by the identifiers of the people they join.
          domAttributes: { "aria-hidden": true },
          style: {
            ...(colour === undefined
              ? {}
              : { stroke: colourVariable(colour, "filled") }),
            // The line to a Live copy is dashed, as the copy's edge is, and faded as the copy is.
            ...(toLiveCopy ? { strokeDasharray: "4 4", opacity: 0.7 } : {}),
          },
        };
      }),
    [layout, colours, tree],
  );

  // Brings the person found to the centre once the managers above them are shown, and only then,
  // so showing or hiding reports afterwards leaves the chart where it is.
  const centred = useRef<string | null>(null);
  // A person whose details are opened from their card stays in the middle of the chart while the
  // space beside the panel changes, as it opens, is resized, or closes, until the chart is moved
  // any other way.
  const keepCentred = useRef(false);
  // The zoom finding them is moving towards, if it is, which they are kept at.
  const centredZoom = useRef<number | null>(null);
  const centreOnSpace = (keep: boolean) => {
    keepCentred.current = keep;
    centredZoom.current = null;
  };
  // Once the details close, the chart keeps its place after the panel has slid away.
  const detailsOpen = search.open !== undefined;
  useEffect(() => {
    if (detailsOpen) return;
    const timer = setTimeout(() => {
      keepCentred.current = false;
    }, motionLasts);
    return () => {
      clearTimeout(timer);
    };
  }, [detailsOpen]);
  const chartArea = useRef<HTMLDivElement>(null);
  // What the observer below centres, as the chart is now drawn.
  const placing = useRef({ layout, found, tree });
  useEffect(() => {
    placing.current = { layout, found, tree };
  });
  useEffect(() => {
    // The chart's panel is drawn whenever the chart is.
    const area = chartArea.current as HTMLDivElement;
    // Only a change of width counts, not the size reported when watching starts.
    let width: number | undefined;
    const observer = new ResizeObserver(([entry]) => {
      const now = (entry as ResizeObserverEntry).contentRect.width;
      const changed = width !== undefined && now !== width;
      width = now;
      const { layout: shown, found: at, tree: drawn } = placing.current;
      const card = shown.cards.find(({ id }) => id === at);
      if (!changed || !keepCentred.current || card === undefined) return;
      const height = heightOf(drawn.people.get(card.id));
      void flow.setCenter(card.x + cardWidth / 2, card.y + height / 2, {
        zoom: centredZoom.current ?? flow.getZoom(),
      });
    });
    observer.observe(area);
    return () => {
      observer.disconnect();
    };
  }, [flow]);
  const [reveals, setReveals] = useState(0);
  const [ready, setReady] = useState(false);
  // A chart opened with someone found starts at them, rather than fitted to the screen.
  const [fitOnOpen] = useState(found === null);
  useEffect(() => {
    if (found === null) centred.current = null;
    if (!ready || found === centred.current) return;
    // The managers above the person found are shown, so their card is placed.
    const card = layout.cards.find(({ id }) => id === found) as Placed;
    centred.current = found;
    const height = heightOf(tree.people.get(card.id));
    const zoom = Math.max(flow.getZoom(), 1);
    centredZoom.current = zoom;
    void flow.setCenter(card.x + cardWidth / 2, card.y + height / 2, {
      zoom,
      duration: 300,
    });
  }, [layout, found, flow, ready, reveals, tree]);

  // Showing a number of levels changes the chart's whole shape, so it is fitted to the screen again
  // once laid out; showing or hiding one manager's reports leaves it where it is.
  const fitNext = useRef(false);
  const showLevels = (levels: number | "all") => {
    centreOnSpace(false);
    fitNext.current = true;
    setLevelsChosen(levels);
    setCollapsed(levels === "all" ? new Set() : collapsedBelow(tree, levels));
  };
  useEffect(() => {
    if (!fitNext.current) return;
    fitNext.current = false;
    void flow.fitView({ ...fitOptions, duration: 300 });
  }, [layout, flow]);

  return (
    <Stack gap="sm">
      <ChartControls
        tree={tree}
        outside={outside}
        draft={
          // Drafts are details of people, so those who do not see people see only the approved
          // chart.
          seesPeople &&
          !fixedDay && (
            <DraftMenu
              show={show}
              onShow={(next) => {
                onSearch(
                  { ...search, show: next === "both" ? undefined : next },
                  false,
                );
              }}
            />
          )
        }
        teams={
          teamsList ??
          ((teamEdits.names || teamEdits.colours) && (
            <TeamsPanel tree={everyone} edits={teamEdits} />
          ))
        }
        found={found}
        levels={levels}
        onFind={(id, team) => {
          if (team && id !== null && collapsed.has(id)) {
            setCollapsed(new Set([...collapsed].filter((one) => one !== id)));
          }
          const person = id === null ? undefined : tree.people.get(id);
          const address =
            person === undefined ? null : addressOf(person, seesPeople);
          setFoundByName(
            person !== undefined && address === null ? person.id : null,
          );
          onSearch({ ...search, person: address ?? undefined }, true);
        }}
        onFindAgain={() => {
          // Choosing the person already found, perhaps hidden since, shows and centres them again.
          setShownFor(null);
          centred.current = null;
          setReveals((count) => count + 1);
        }}
        onLevels={showLevels}
        onMove={() => {
          centreOnSpace(false);
        }}
      />
      <Paper withBorder className={classes.chart} ref={chartArea}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          colorMode={colorScheme}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
          // Cards and lines take no focus of their own; each card's link and buttons do.
          nodesFocusable={false}
          edgesFocusable={false}
          disableKeyboardA11y
          onNodeClick={(event, node) => {
            const target = event.target as Element;
            // The name, and each button, do their own, and a menu or popover opened from a card is
            // drawn outside it but still passes its clicks to it.
            if (
              target.closest("a, button") !== null ||
              !event.currentTarget.contains(target)
            ) {
              return;
            }
            node.data.onOpen?.();
          }}
          minZoom={0.1}
          fitView={fitOnOpen}
          fitViewOptions={fitOptions}
          onMoveStart={(event) => {
            // Only the reader's own moves have an event.
            if (event !== null) centreOnSpace(false);
          }}
          onInit={() => {
            setReady(true);
          }}
          aria-label="Org chart"
          // The MIT licence lets the attribution be hidden; it would cover the chart.
          proOptions={{ hideAttribution: true }}
        />
      </Paper>
    </Stack>
  );
}

// On another day, only what takes effect from it is changed: renaming, colouring and removing a team
// do not.
const undatedChangesLeftOut = (edits: FeatureTeamEdits): FeatureTeamEdits => ({
  ...edits,
  edit: false,
  colours: false,
});

export function OrgChartPage({
  search,
  onSearch,
  seesPeople,
  showDates = false,
  canEdit = false,
  changesDates = false,
  teamEdits,
  featureTeamEdits = noFeatureTeamEdits,
}: {
  featureTeamEdits?: FeatureTeamEdits;
  search: ChartSearch;
  seesPeople: boolean;
  // Whether the reader may change people, in a person's details.
  canEdit?: boolean;
  // Whether the reader may change Personal details, which dating a change earlier needs.
  changesDates?: boolean;
  // Whether the reader sees Personal details, such as dates, in a person's details.
  showDates?: boolean;
  teamEdits: TeamEdits;
  onSearch: (search: ChartSearch, replace: boolean) => void;
}) {
  const featureView = search.view === "feature-teams";
  const day = chartDay(search.day, featureView, showDates);
  // Those who do not see Personal details see feature teams on another day, with people as they
  // are today, since reporting lines on another day are Personal. Feature teams and reporting
  // lines change from the day shown for those who may date changes then; people's other details
  // change only today.
  const dated = day !== undefined;
  const linesChangeOnDay =
    day !== undefined &&
    canEdit &&
    mayDateLineChange(changesDates, day, today());
  const changesOnDay =
    day !== undefined &&
    (featureView
      ? featureTeamEdits.propose &&
        mayDateChange(featureTeamEdits.dates, day, today())
      : linesChangeOnDay);
  const fixedDay = dated && !changesOnDay;
  const query = useQuery(orgChartQueryOn(showDates ? day : undefined));
  const narrow = useNarrow();
  // A person's details and a note of theirs being written, beside the chart.
  const notes = usePersonNotes();
  const people = useQuery({ ...peopleQuery, enabled: seesPeople });
  const shownId = useShownId(
    seesPeople ? search.open : undefined,
    people.data?.people,
  );
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
  const { save, undoable } = useSaving<PeopleData>({
    queryKey: peopleQuery.queryKey,
    removed: "Someone else has removed this. The people have been refreshed.",
    blocked: false,
    refreshes: [orgChartQuery.queryKey],
  });
  // Those who do not see people are sent no drafts, so every choice draws the approved chart, which
  // they may still colour teams on.
  const teamsQuery = useQuery({
    ...featureTeamsQueryOn(day),
    enabled: featureView,
  });
  // Also read only for the moment another day's data stays on screen while today's loads.
  const readOnly =
    fixedDay || query.isPlaceholderData || teamsQuery.isPlaceholderData;
  const show = readOnly
    ? "live"
    : seesPeople
      ? (search.show ?? "both")
      : "both";
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
  const openTeam = (id: string | undefined) => {
    setCreating(false);
    go({ ...search, person: undefined, featureTeam: id }, false);
  };
  const teamActions = useFeatureTeamActions(openTeam);
  const openedTeam = teamsQuery.data?.teams.find(
    ({ id }) => id === search.featureTeam,
  );
  // Live only is read only, as on tables, managers' teams are not changed on the feature team chart,
  // and team names and colours, which take no date, change only today.
  const edits =
    show === "live" || featureView || dated ? noTeamEdits : teamEdits;
  const lead =
    everyone === undefined
      ? undefined
      : [...everyone.people.values()].find(
          (person) =>
            addressOf(person, seesPeople) === search.team &&
            everyone.reports.has(person.id),
        );
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
  return (
    <>
      <PageHeader
        title="Org chart"
        action={
          <Group gap="sm">
            <SegmentedControl
              aria-label="Teams drawn"
              data={[
                { value: "reporting", label: "Reporting teams" },
                { value: "feature-teams", label: "Feature teams" },
              ]}
              value={featureView ? "feature-teams" : "reporting"}
              onChange={(value) => {
                // The person found, or whose details are open, stays found, so the chart starts at
                // them.
                go(
                  {
                    show: search.show,
                    open: search.open,
                    person: search.person ?? search.open,
                    day: search.day,
                    ...(value === "feature-teams"
                      ? { view: "feature-teams" as const }
                      : {}),
                  },
                  false,
                );
              }}
            />
            {lead !== undefined && (
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
                      },
                      false,
                    );
                  }}
                >
                  Show everyone
                </Button>
              </Group>
            )}
          </Group>
        }
      />
      {(featureView || showDates) && (
        <OrgChartDate
          day={day}
          seesDays={showDates}
          changes={changesOnDay}
          onDay={(next) => {
            setCreating(false);
            go({ ...search, day: next }, true);
          }}
        />
      )}
      {query.isPending || (featureView && teamsQuery.isPending) ? (
        <Loader role="status" aria-label="Loading" />
      ) : query.isError || tree === undefined || everyone === undefined ? (
        <Alert color="red" role="alert">
          <Group justify="space-between">
            Fathom could not load the org chart.
            <Button
              variant="light"
              color="red"
              size="xs"
              onClick={() => {
                void query.refetch();
                if (featureView) void teamsQuery.refetch();
              }}
            >
              Try again
            </Button>
          </Group>
        </Alert>
      ) : tree.people.size === 0 && !featureView ? (
        <Text c="dimmed">Nobody is on the org chart yet.</Text>
      ) : (
        <WithSidePanel
          storageKey="fathom-table-panel-width"
          panels={[
            ...(seesPeople && search.open !== undefined
              ? [
                  {
                    key: "person",
                    id: personPanelId,
                    name: "details",
                    node: (
                      <PersonPanel
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
                        seesDays={showDates}
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
                        teams={(teamsQuery.data as FeatureTeams).teams}
                        onTeam={openTeam}
                        onNew={() => {
                          onSearch(
                            { ...search, featureTeam: undefined },
                            false,
                          );
                          setCreating(true);
                        }}
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
              seesPeople={seesPeople}
              teamEdits={edits}
              show={show}
              fixedDay={fixedDay}
              search={search}
              onSearch={go}
              {...(featureView
                ? {
                    teamsList: (
                      <FeatureTeamsList
                        teams={(teamsQuery.data as FeatureTeams).teams}
                        canAdd={featureTeamEdits.propose && show !== "live"}
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
    </>
  );
}
