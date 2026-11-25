// SPDX-License-Identifier: Apache-2.0

// The org chart's canvas: the cards and the lines between them laid out, with the chart's controls
// above, keeping the person found in view.

import { type PaletteColour, type Show } from "@fathom/shared";
import { Paper, Stack, useComputedColorScheme } from "@mantine/core";
import { type Edge, ReactFlow, useReactFlow } from "@xyflow/react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { TeamsPanel } from "./teams-panel.tsx";
import { colourVariable } from "./colours.ts";
import { ChartControls } from "./org-chart-controls.tsx";
import { type CardNode, nodeTypes } from "./org-chart-cards.tsx";
import {
  cardWidth,
  type ChartPerson,
  fitOptions,
  liveCopyId,
  heightOf,
  type ChartLevels,
  type ChartSearch,
  collapsedTo,
  levelsOf,
  openLevels,
  managersAbove,
  type OrgTree,
  type Placed,
  placed,
} from "./org-chart.ts";
import classes from "./org-chart.module.css";
import { motionLasts } from "./side-panel.tsx";
import { besideLive } from "./status-mark.tsx";
import { DraftMenu } from "./table-controls.tsx";

// How the address names a person, for the team shown alone and the person found: by Employee ID,
// or, for a planned hire, by Fathom's own ID. Null for a Live copy, which the person themselves
// stands for.
function addressOf(person: ChartPerson): string | null {
  if (person.liveCopyOf !== undefined) return null;
  return person.planned === undefined ? person.employeeId : person.id;
}

// The least zoom at which a card can still be read, below which a person found is centred alone
// rather than fitted to the screen with their Live copy, and the room left around cards fitted.
const readableZoom = 0.6;
const fitMargin = 40;

export function Chart({
  tree,
  everyone,
  colours,
  alone,
  editsTeams,
  show,
  search,
  onSearch,
  teamsList,
  fixedDay,
  dateRow,
  views,
}: {
  dateRow: ReactNode;
  // The Views menu, last of the controls on the left, as on a table.
  views: ReactNode;
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
  editsTeams: boolean;
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
      const address = addressOf(person);
      if (address !== null && !cards.has(address)) cards.set(address, person);
    }
    return cards;
  }, [tree]);
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
  const levelsChosen = search.levels ?? openLevels;
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(() =>
    collapsedTo(tree, levelsChosen),
  );
  // Choosing a number of levels, from the menu, a saved view or the browser's Back, shows that
  // many again, hiding or showing every manager's reports, even the number already shown, and
  // fits the chart to them.
  const [levelsShown, setLevelsShown] = useState({
    levels: levelsChosen,
    times: 0,
  });
  if (levelsShown.levels !== levelsChosen) {
    setLevelsShown({ levels: levelsChosen, times: levelsShown.times + 1 });
    setCollapsed(collapsedTo(tree, levelsChosen));
  }
  // Someone who manages nobody in one choice of what to show may manage someone in another, such as
  // the manager a person is drafted from, so the first time they appear their reports are shown or
  // hidden as the levels last chosen have them.
  const [managersSeen, setManagersSeen] = useState<ReadonlySet<string>>(
    () => new Set(tree.reports.keys()),
  );
  const added = [...tree.reports.keys()].filter((id) => !managersSeen.has(id));
  if (added.length > 0) {
    setManagersSeen(new Set([...managersSeen, ...added]));
    const below = collapsedTo(tree, levelsChosen);
    setCollapsed(
      new Set([...collapsed, ...added.filter((id) => below.has(id))]),
    );
  }
  // Shows the person found, whether from the finder or the address, by showing the managers above
  // them, and above their Live copy, when a draft moves them, so both places they are drawn show,
  // once each time someone new is found.
  const [shownFor, setShownFor] = useState<string | null>(null);
  if (found !== shownFor) {
    setShownFor(found);
    const above =
      found === null
        ? []
        : [
            ...managersAbove(tree, found),
            ...managersAbove(tree, liveCopyId(found)),
          ];
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
        const address = addressOf(person);
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
            editsTeams,
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
                      {
                        team: person.id,
                        show: search.show,
                        day: search.day,
                        levels: search.levels,
                        view: search.view,
                      },
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
              person.teamCard !== true && employeeId === null
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
      editsTeams,
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
  // A feature team opened, from its card, its name, or the list of teams, stays in the middle as
  // its panel opens, as a person opened from their card does.
  const teamOpened = search.featureTeam;
  useEffect(() => {
    if (teamOpened !== undefined) keepCentred.current = true;
  }, [teamOpened]);
  // Once the details or the team close, the chart keeps its place after the panel has slid away.
  const detailsOpen =
    search.open !== undefined || search.featureTeam !== undefined;
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
    // A person a draft moves is shown with their Live copy too, both fitted to the screen, no closer
    // than finding anyone else brings the chart, unless fitting both would make the cards too small
    // to read, when the person is centred alone, as anyone found is.
    const copy = layout.cards.find(({ id }) => id === liveCopyId(card.id));
    const area = chartArea.current;
    const bothFit =
      copy !== undefined &&
      area !== null &&
      Math.min(
        area.clientWidth /
          (Math.abs(card.x - copy.x) + cardWidth + 2 * fitMargin),
        area.clientHeight /
          (Math.abs(card.y - copy.y) +
            Math.max(height, heightOf(tree.people.get(copy.id))) +
            2 * fitMargin),
      ) >= readableZoom;
    if (copy !== undefined && bothFit) {
      centredZoom.current = null;
      void flow.fitView({
        ...fitOptions,
        nodes: [{ id: card.id }, { id: copy.id }],
        duration: 300,
      });
      return;
    }
    const zoom = Math.max(flow.getZoom(), 1);
    centredZoom.current = zoom;
    void flow.setCenter(card.x + cardWidth / 2, card.y + height / 2, {
      zoom,
      duration: 300,
    });
  }, [layout, found, flow, ready, reveals, tree]);

  // Showing a number of levels changes the chart's whole shape, so it is fitted to the screen again
  // once laid out; showing or hiding one manager's reports leaves it where it is.
  const fittedFor = useRef(levelsShown.times);
  useEffect(() => {
    if (fittedFor.current === levelsShown.times) return;
    fittedFor.current = levelsShown.times;
    void flow.fitView({ ...fitOptions, duration: 300 });
  }, [levelsShown, flow]);
  const showLevels = (levels: ChartLevels) => {
    centreOnSpace(false);
    if (levels === levelsChosen) {
      setLevelsShown({ levels, times: levelsShown.times + 1 });
      setCollapsed(collapsedTo(tree, levels));
      return;
    }
    onSearch(
      { ...search, levels: levels === openLevels ? undefined : levels },
      false,
    );
  };

  return (
    <Stack gap="sm">
      <ChartControls
        tree={tree}
        outside={outside}
        draft={
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
        teams={teamsList ?? (editsTeams && <TeamsPanel tree={everyone} />)}
        found={found}
        levels={levels}
        onFind={(id, team) => {
          if (team && id !== null && collapsed.has(id)) {
            setCollapsed(new Set([...collapsed].filter((one) => one !== id)));
          }
          const person = id === null ? undefined : tree.people.get(id);
          const address = person === undefined ? null : addressOf(person);
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
        views={views}
        onMove={() => {
          centreOnSpace(false);
        }}
      />
      {dateRow}
      <Paper
        withBorder
        className={classes.chart}
        ref={chartArea}
        data-tinted={besideLive(show) || undefined}
      >
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          forceColorMode={colorScheme}
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
          // React Flow reports only the reader's own moves, not those the chart makes itself.
          onMoveStart={() => {
            centreOnSpace(false);
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
