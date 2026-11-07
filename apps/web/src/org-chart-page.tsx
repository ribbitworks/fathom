// SPDX-License-Identifier: Apache-2.0

// The Org chart page, for users who see people: today's reporting lines, each person under their
// manager. Managers' reports can be hidden and shown again, a number of levels shown at once, the
// chart panned, zoomed, and fitted to the screen, and a person found by name, which brings them to
// the centre. A manager's team can be shown alone. A person opens People, searched for their
// Employee ID, which leads back to the chart with them found. The person found, and the team shown
// alone, are kept in the page's address. Each team's cards, and the lines to them, are drawn in its
// colour, which reaches down to the teams below that have none, even when a team is shown alone.

import type { OrgChartPerson, PaletteColour } from "@fathom/shared";
import {
  ActionIcon,
  Alert,
  Button,
  Group,
  Loader,
  Paper,
  Stack,
  Text,
  Tooltip,
  UnstyledButton,
  VisuallyHidden,
  useComputedColorScheme,
} from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
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
} from "react";
import { Swatch } from "./colour-swatch.tsx";
import { TeamColourMenu } from "./team-colour-menu.tsx";
import { TeamNameEditor } from "./team-name-editor.tsx";
import { TeamsPanel } from "./teams-panel.tsx";
import { colourVariable } from "./colours.ts";
import { Icon } from "./icons.tsx";
import { ChartControls } from "./org-chart-controls.tsx";
import {
  cardHeight,
  cardWidth,
  fitOptions,
  stackIndent,
  type ChartSearch,
  collapsedBelow,
  levelsOf,
  managersAbove,
  type OrgTree,
  orgChartQuery,
  noTeamEdits,
  type Placed,
  type TeamEdits,
  placed,
  reportColours,
  teamOf,
  treeOf,
} from "./org-chart.ts";
import classes from "./org-chart.module.css";
import { PageHeader } from "./page-header.tsx";
import { StatusMark } from "./status-mark.tsx";

interface CardData extends Record<string, unknown> {
  person: OrgChartPerson;
  // The colour of the team the person is on, if it has one.
  colour: PaletteColour | undefined;
  reports: number;
  collapsed: boolean;
  found: boolean;
  // The chart's address once the person is opened, which People leads back to.
  back: ChartSearch;
  // Shows only the person's team; absent unless they manage someone, are known by more than their
  // name, and are not already shown alone.
  onTeam: (() => void) | undefined;
  // Whether the reader may change the name and colour of the team the person leads.
  teamEdits: TeamEdits;
  onToggle: (id: string) => void;
  // Opens the person on People; absent for someone People does not show the reader.
  onOpen: (() => void) | undefined;
}

type CardNode = Node<CardData, "person">;

// A plain click opens People in this tab, after the chart's address keeps the person; any other,
// such as one opening a new tab, is left to the browser.
const plainClick = (event: MouseEvent) =>
  event.button === 0 &&
  !event.metaKey &&
  !event.ctrlKey &&
  !event.shiftKey &&
  !event.altKey;

function PersonCard({ data }: NodeProps<CardNode>) {
  const {
    person,
    colour,
    reports,
    collapsed,
    found,
    back,
    onTeam,
    teamEdits,
    onToggle,
    onOpen,
  } = data;
  return (
    <div
      className={classes.card}
      data-found={found || undefined}
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
        {person.employeeId === null || onOpen === undefined ? (
          <span className={classes.label}>{person.preferredName}</span>
        ) : (
          <Link
            to="/people"
            search={{ search: person.employeeId, chart: back }}
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
      {person.position !== null && (
        <Text size="sm" c="dimmed" truncate>
          {person.position}
        </Text>
      )}
      {person.teamName !== null && (
        <Group gap={6} wrap="nowrap">
          {teamEdits.colours ? (
            <TeamColourMenu
              managerId={person.id}
              current={person.teamColour}
              team={person.teamName}
            />
          ) : (
            person.teamColour !== null && (
              <Swatch colour={person.teamColour} size={8} />
            )
          )}
          {teamEdits.names ? (
            <TeamNameEditor
              managerId={person.id}
              managerName={person.preferredName}
              name={person.teamName}
            />
          ) : (
            <Text size="xs" c="dimmed" truncate>
              {person.teamName}
            </Text>
          )}
        </Group>
      )}
      {reports > 0 && (
        <UnstyledButton
          className={[classes.toggle, "nodrag", "nopan"].join(" ")}
          aria-expanded={!collapsed}
          onClick={() => {
            onToggle(person.id);
          }}
        >
          {`${collapsed ? "Show" : "Hide"} ${String(reports)} ${reports === 1 ? "report" : "reports"}`}{" "}
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

// The levels shown when the chart opens, so a large organization starts readable.
const openLevels = 2;

// How the address names a person, for the team shown alone and the person found. A reader who sees
// people has each person's Employee ID; one who does not has Fathom's own ID for them, which means
// nothing outside Fathom. Null for someone shown by name only, who cannot be kept there.
function addressOf(person: OrgChartPerson, seesPeople: boolean): string | null {
  if (person.nameOnly === true) return null;
  return seesPeople ? person.employeeId : person.id;
}

function Chart({
  tree,
  everyone,
  seesPeople,
  colours,
  alone,
  teamEdits,
  search,
  onSearch,
}: {
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
  search: ChartSearch;
  onSearch: (search: ChartSearch, replace: boolean) => void;
}) {
  const flow = useReactFlow();
  const navigate = useNavigate();
  const colorScheme = useComputedColorScheme("light");
  const byAddress = useMemo(
    () =>
      new Map(
        [...tree.people.values()].flatMap((person) => {
          const address = addressOf(person, seesPeople);
          return address === null ? [] : [[address, person]];
        }),
      ),
    [tree, seesPeople],
  );
  // Someone shown by name only has nothing to keep in the address, so is found here alone.
  const [foundByName, setFoundByName] = useState<string | null>(null);
  const found =
    search.person === undefined
      ? foundByName
      : (byAddress.get(search.person)?.id ?? null);
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(() =>
    collapsedBelow(tree, openLevels),
  );
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
            (person) => !tree.people.has(person.id),
          )
        : [],
    [alone, everyone, tree],
  );

  const layout = useMemo(() => placed(tree, collapsed), [tree, collapsed]);
  const nodes = useMemo(
    () =>
      layout.cards.map(({ id, x, y }): CardNode => {
        // Every card placed is someone in the tree.
        const person = tree.people.get(id) as OrgChartPerson;
        const reports = tree.reports.get(id)?.length ?? 0;
        const { employeeId } = person;
        const address = addressOf(person, seesPeople);
        const back = { ...search, person: address ?? undefined };
        return {
          id,
          type: "person",
          position: { x, y },
          width: cardWidth,
          height: cardHeight,
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
            back,
            teamEdits: person.nameOnly === true ? noTeamEdits : teamEdits,
            onTeam:
              address === null ||
              reports === 0 ||
              (alone && tree.roots.includes(id))
                ? undefined
                : () => {
                    onSearch({ team: address }, false);
                  },
            onToggle: (toggled) => {
              setCollapsed((before) => {
                const after = new Set(before);
                if (!after.delete(toggled)) after.add(toggled);
                return after;
              });
            },
            onOpen:
              employeeId === null || !seesPeople
                ? undefined
                : () => {
                    onSearch(back, true);
                    void navigate({
                      to: "/people",
                      search: { search: employeeId, chart: back },
                    });
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
      navigate,
    ],
  );
  const edges = useMemo(
    () =>
      layout.lines.map(({ from, to, stacked }): Edge => {
        const colour = colours.get(from);
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
          ...(colour === undefined
            ? {}
            : { style: { stroke: colourVariable(colour, "filled") } }),
        };
      }),
    [layout, colours],
  );

  // Brings the person found to the centre once the managers above them are shown, and only then,
  // so showing or hiding reports afterwards leaves the chart where it is.
  const centred = useRef<string | null>(null);
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
    void flow.setCenter(card.x + cardWidth / 2, card.y + cardHeight / 2, {
      zoom: Math.max(flow.getZoom(), 1),
      duration: 300,
    });
  }, [layout, found, flow, ready, reveals]);

  // Showing a number of levels changes the chart's whole shape, so it is fitted to the screen again
  // once laid out; showing or hiding one manager's reports leaves it where it is.
  const fitNext = useRef(false);
  const showLevels = (levels: number | "all") => {
    fitNext.current = true;
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
        teams={
          (teamEdits.names || teamEdits.colours) && (
            <TeamsPanel tree={everyone} edits={teamEdits} />
          )
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
      />
      <Paper withBorder className={classes.chart}>
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

export function OrgChartPage({
  search,
  onSearch,
  seesPeople,
  teamEdits,
}: {
  search: ChartSearch;
  seesPeople: boolean;
  teamEdits: TeamEdits;
  onSearch: (search: ChartSearch, replace: boolean) => void;
}) {
  const query = useQuery(orgChartQuery);
  const everyone = useMemo(
    () => (query.data === undefined ? undefined : treeOf(query.data.people)),
    [query.data],
  );
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
          lead !== undefined && (
            <Group gap="sm">
              <Text size="sm">
                You're seeing only the team of {lead.preferredName}.
              </Text>
              <Button
                variant="default"
                onClick={() => {
                  onSearch({ person: search.person }, false);
                }}
              >
                Show everyone
              </Button>
            </Group>
          )
        }
      />
      {query.isPending ? (
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
              }}
            >
              Try again
            </Button>
          </Group>
        </Alert>
      ) : tree.people.size === 0 ? (
        <Text c="dimmed">Nobody is on the org chart yet.</Text>
      ) : (
        <ReactFlowProvider key={lead?.id ?? ""}>
          <Chart
            tree={tree}
            everyone={everyone}
            colours={colours}
            alone={lead !== undefined}
            seesPeople={seesPeople}
            teamEdits={teamEdits}
            search={search}
            onSearch={onSearch}
          />
        </ReactFlowProvider>
      )}
    </>
  );
}
