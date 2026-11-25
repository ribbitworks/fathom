// SPDX-License-Identifier: Apache-2.0

// The cards the org chart draws: each person's, with their name, position and team, and the dimmed
// Live copy of someone a draft moves.

import { type PaletteColour } from "@fathom/shared";
import {
  ActionIcon,
  Anchor,
  Text,
  Tooltip,
  UnstyledButton,
  VisuallyHidden,
  Menu,
} from "@mantine/core";
import { Link } from "@tanstack/react-router";
import { Handle, type Node, type NodeProps, Position } from "@xyflow/react";
import { type CSSProperties, type MouseEvent } from "react";
import { ColouredName } from "./colour-swatch.tsx";
import { CardMenu } from "./card-menu.tsx";
import { CopyLinkItem } from "./record-key.tsx";
import { TeamColourMenu } from "./team-colour-menu.tsx";
import { TeamNameEditor } from "./team-name-editor.tsx";
import { colourVariable } from "./colours.ts";
import { Icon } from "./icons.tsx";
import { PersonMarks, TeamMarks } from "./org-chart-marks.tsx";
import {
  hasApprovedName,
  changeOf,
  type ChartPerson,
  stackIndent,
  type ChartSearch,
  chartKeyOf,
} from "./org-chart.ts";
import classes from "./org-chart.module.css";
import {
  DraftedItem,
  leftWarning,
  LiveLine,
  MarkedItem,
  MarkRow,
} from "./status-mark.tsx";
import { plannedWords } from "./day-formats.ts";

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
  editsTeams: boolean;
  onToggle: (id: string) => void;
  // Shows the person's details beside the chart; absent for someone People does not show the reader.
  onOpen: (() => void) | undefined;
}

export type CardNode = Node<CardData, "person">;

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
  editsTeams,
  onFeatureTeam,
}: {
  person: ChartPerson;
  editsTeams: boolean;
  // Opens the feature team the card leads, on the feature team chart.
  onFeatureTeam?: (() => void) | undefined;
}) {
  const { renamed } = person;
  if (person.teamName === null && renamed === undefined) return null;
  const colourChosen =
    editsTeams && person.teamName !== null && hasApprovedName(person);
  // Whether a colour, or the button to choose one, comes before the name.
  const swatched = colourChosen || person.teamColour !== null;
  return (
    <>
      <MarkRow small>
        {colourChosen && person.teamName !== null && (
          <TeamColourMenu
            teamId={person.id}
            current={person.teamColour}
            team={person.teamName}
          />
        )}
        {/* A feature team's own card names the team, and marks it there, not again here. */}
        <TeamMarks person={person} plain={person.teamCard === true}>
          <ColouredName colour={colourChosen ? null : person.teamColour}>
            {onFeatureTeam !== undefined && person.teamName !== null ? (
              <Anchor
                component="button"
                size="xs"
                className={["nodrag", "nopan"].join(" ")}
                onClick={onFeatureTeam}
              >
                {person.teamName}
              </Anchor>
            ) : editsTeams ? (
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
          </ColouredName>
        </TeamMarks>
      </MarkRow>
      {renamed !== undefined && renamed.live !== null && (
        <LiveLine className={swatched ? classes.liveName : undefined}>
          {renamed.live}
        </LiveLine>
      )}
    </>
  );
}

// A card in its team's colour, when its team has one.
const teamColourProps = (colour: PaletteColour | undefined) =>
  colour === undefined
    ? {}
    : {
        "data-coloured": true,
        style: {
          "--team-colour": colourVariable(colour, "filled"),
        } as CSSProperties,
      };

// Where the line from a person's manager arrives: at the top of a card in a row, and at the left of
// one in a stack.
function TargetHandles() {
  return (
    <>
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
      {...teamColourProps(colour)}
    >
      <TargetHandles />
      <div className={classes.name}>
        <MarkedItem tone="live">
          <span className={classes.label}>{person.preferredName}</span>
        </MarkedItem>
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
      <MarkRow>
        <DraftedItem
          draft={
            repositioned === undefined
              ? undefined
              : changeOf(repositioned.draft)
          }
        >
          <Text size="sm" c="dimmed" truncate>
            {person.position}
          </Text>
        </DraftedItem>
      </MarkRow>
      {repositioned?.live !== undefined && (
        <LiveLine>{repositioned.live}</LiveLine>
      )}
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
    editsTeams,
    onToggle,
    onOpen,
  } = data;
  const { planned } = person;
  // A planned hire with no name of its own goes by its position and ID; its card shows the ID as
  // its name, with the position under it as a person's is, so the name fits.
  const shownId = planned?.shownId;
  const madeName = shownId !== undefined;
  const cardName = shownId ?? person.preferredName;
  const linked =
    (person.employeeId !== null || person.teamCard === true) &&
    onOpen !== undefined;
  return (
    <CardMenu
      name={cardName}
      withMore={false}
      items={
        <>
          {onOpen !== undefined && (
            <Menu.Item onClick={onOpen}>Show details</Menu.Item>
          )}
          <CopyLinkItem record={chartKeyOf(person)} />
        </>
      }
    >
      {({ onContextMenu, onMenuKey }) => (
        <div
          onContextMenu={onContextMenu}
          onKeyDown={(event) => {
            onMenuKey(event);
          }}
          // A card whose name isn't a link takes focus itself, so its menu opens from the keyboard.
          {...(linked
            ? {}
            : { tabIndex: 0, role: "group", "aria-label": cardName })}
          className={classes.card}
          data-found={found || undefined}
          data-planned={planned === undefined ? undefined : true}
          data-draft={
            person.moved !== undefined ||
            person.added !== undefined ||
            person.repositioned !== undefined ||
            person.renamed !== undefined ||
            undefined
          }
          {...teamColourProps(colour)}
        >
          <TargetHandles />
          <div className={classes.name}>
            <PersonMarks person={person}>
              <MarkedItem
                tone={person.left === true ? "warning" : undefined}
                words={leftWarning.words}
                spoken={leftWarning.spoken}
              >
                {!linked ? (
                  <span
                    className={[
                      classes.label,
                      madeName ? classes.madeName : "",
                    ].join(" ")}
                  >
                    {cardName}
                  </span>
                ) : (
                  <Link
                    id={cardLinkId(person.id)}
                    to="/org-chart"
                    search={opened}
                    className={[
                      classes.label,
                      classes.link,
                      "nodrag",
                      "nopan",
                    ].join(" ")}
                    onClick={(event) => {
                      if (!plainClick(event)) return;
                      event.preventDefault();
                      onOpen();
                    }}
                  >
                    {person.preferredName}
                  </Link>
                )}
              </MarkedItem>
            </PersonMarks>
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
            <MarkedItem tone="planned" words={plannedWords(planned)} />
          )}
          <TeamRow
            person={person}
            editsTeams={editsTeams}
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
      )}
    </CardMenu>
  );
}

export const nodeTypes = { person: PersonCard };

export const cardLinkId = (id: string) => `card-${id}`;
