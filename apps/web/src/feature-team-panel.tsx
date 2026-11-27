// SPDX-License-Identifier: Apache-2.0

// A feature team's details beside the org chart, and the form that adds one.

import type { Refusal } from "./api.ts";
import {
  capitalized,
  type Choice,
  type FeatureTeam,
  type FeatureTeamDraft,
  featureTeamLengths,
  type FeatureTeamRequest,
  type OrgChartPerson,
  type PaletteColour,
  type Show,
  type TeamHire,
} from "@fathom/shared";
import { Button, Group, Text } from "@mantine/core";
import { type ReactNode, useMemo, useState } from "react";
import { colourWords } from "./colours.ts";
import { expectedWords, formatMonth } from "./day-formats.ts";
import {
  featureTeamsQuery,
  liveTeam,
  membersChanged,
  plannedHireOrder,
  takesEffect,
  teamHireWords,
  type TeamPerson,
  teamPersonOf,
} from "./feature-teams.ts";
import { draftOffer } from "./menu-offer.ts";
import { noOthers } from "./new-plan-record-panel.tsx";
import { NewRecordPanel, newRecordId } from "./new-record-panel.tsx";
import { noRecordProblem } from "./plan-table.tsx";
import { aboutPerson, reportingWords } from "./people-rows.ts";
import classes from "./record-details.module.css";
import { RecordSection, Row, DetailSections } from "./record-details.tsx";
import {
  type RecordEditingContext,
  useRecordEditing,
} from "./record-editing.tsx";
import { fieldColumn } from "./grid-columns.tsx";
import type { Column } from "./record-table.ts";
import type { CellValue } from "./table-view.ts";
import { KeyAfter, RecordKey } from "./record-key.tsx";
import { SidePanelFrame, sidePanelScroll } from "./side-panel.tsx";
import {
  DraftedItem,
  type DraftedPart,
  DraftedPartItem,
  FilledIn,
  marksIn,
  useDraftView,
  viewedDraft,
} from "./status-mark.tsx";
import type { DraftLike } from "./draft-marks.ts";
import { TeamColourMenu } from "./team-colour-menu.tsx";
import { today } from "./today.ts";

export const featureTeamPanelId = "feature-team-panel";
const titleId = "feature-team-panel-title";

export const noFeatureTeamEdits: FeatureTeamEdits = {
  members: false,
  undated: false,
  dates: false,
};

export interface FeatureTeamEdits {
  // Adds teams, and changes their members and leads, which take effect from the day shown.
  members: boolean;
  // Renames, removes and colours teams, which take no date, so only on today's chart.
  undated: boolean;
  // Changes teams from an earlier day than today.
  dates: boolean;
}

export interface FeatureTeamActions {
  create: (
    request: FeatureTeamRequest,
    refused: (refusal: Refusal) => boolean,
  ) => void;
  rename: (team: FeatureTeam, name: string) => void;
  // A change of the lead or the members names the server's refusal under the row it was made in.
  lead: (
    team: FeatureTeam,
    leadId: string | null,
    from: string | undefined,
    refused: RefusedIn,
  ) => void;
  members: (
    team: FeatureTeam,
    change: { add: string[]; remove: string[] },
    from: string | undefined,
    refused: RefusedIn,
  ) => void;
  removeTeam: (team: FeatureTeam) => void;
  discard: (team: FeatureTeam) => void;
  resubmit: (team: FeatureTeam) => void;
  colour: (
    team: FeatureTeam,
  ) => (colour: PaletteColour | null) => Promise<void>;
}

// Where the server's refusal of a change shows: what names it under its field, saying whether it
// could, and the field the change was made in, which a refusal naming no field is about.
export interface RefusedIn {
  about?: string;
  onRefused: (refusal: Refusal) => boolean;
}

// A change made in one of the team's rows.
type TeamChange = Partial<
  Pick<FeatureTeamRequest, "name" | "leadId" | "members">
>;

// The team's own fields, so a panel holds no other kind of record.
const onlyKind = "";

const byName = new Intl.Collator(undefined, { sensitivity: "base" });

// Everyone who may be chosen as a team's lead or member, by name: people, each described by their
// position and the team they are on or whom they report to, then planned hires, each by when it's
// expected, after its position where its name isn't made from it.
function teamChoices(people: readonly OrgChartPerson[]): Choice[] {
  const byId = new Map(people.map((person) => [person.id, person]));
  const aboutOf = ({ position, managerId, planned }: OrgChartPerson) => {
    if (planned !== undefined) {
      // A name made from the position says it already, so the line starts with when.
      return planned.shownId === undefined
        ? aboutPerson(position, expectedWords(planned))
        : capitalized(expectedWords(planned));
    }
    const manager = managerId === null ? undefined : byId.get(managerId);
    return aboutPerson(
      position,
      manager && reportingWords(manager.teamName, manager.preferredName),
    );
  };
  return people
    .filter((person) => person.left !== true)
    .sort(
      (a, b) =>
        Number(a.planned !== undefined) - Number(b.planned !== undefined) ||
        byName.compare(a.preferredName, b.preferredName),
    )
    .map((person) => ({
      id: person.id,
      label: person.preferredName,
      description: aboutOf(person),
      retired: false,
    }));
}

const noneRemoving: ReadonlySet<string> = new Set();

// Why a planned hire can't be chosen from the day shown, as the server would refuse it: one drafted
// to be removed, or one not yet expected, which joins no earlier than its month's first day.
function hireTurnedOff(
  people: readonly OrgChartPerson[],
  removing: ReadonlySet<string>,
  day: string,
): (choice: Choice) => string | undefined {
  const expected = new Map(
    people.flatMap(({ id, planned }) =>
      planned === undefined || planned.undated === true
        ? []
        : [[id, planned.expected] as const],
    ),
  );
  return ({ id }) => {
    if (removing.has(id)) return "Drafted to be removed";
    const month = expected.get(id);
    return month !== undefined && day < `${month}-01`
      ? `Can't join before ${formatMonth(month)}`
      : undefined;
  };
}

// Whether a choice is a planned hire named by its position and ID, as its card names it.
function hireMadeName(
  people: readonly OrgChartPerson[],
): (choice: Choice) => boolean {
  const made = new Set(
    people.flatMap(({ id, planned }) =>
      planned?.shownId === undefined ? [] : [id],
    ),
  );
  return ({ id }) => made.has(id);
}

// The rows the team's values are shown and changed in, offering everyone on the chart.
function teamColumns(
  people: readonly OrgChartPerson[],
  choices: Choice[],
  canRename: boolean,
  turnedOff: (choice: Choice) => string | undefined,
): Record<"name" | "leadId" | "members", Column<FeatureTeam, TeamChange>> {
  const filledIn = hireMadeName(people);
  return {
    name: fieldColumn("name", "text", {
      label: "Name",
      required: true,
      choices: [],
      multiple: false,
      maxLength: featureTeamLengths.name,
      readOnly: !canRename,
    }),
    leadId: {
      ...fieldColumn<FeatureTeam, TeamChange>("leadId", "choice", {
        label: "Feature lead",
        required: false,
        choices,
        multiple: false,
        emptyLabel: "None",
      }),
      choiceTurnedOff: turnedOff,
      choiceFilledIn: filledIn,
    },
    members: {
      ...fieldColumn<FeatureTeam, TeamChange>("members", "choice", {
        label: "Members",
        required: false,
        choices,
        multiple: true,
        emptyLabel: "None",
      }),
      change: (value) => ({ members: value as string[] }),
      choiceTurnedOff: turnedOff,
      choiceFilledIn: filledIn,
    },
  };
}

// The team's colour, shown as its row, changed from its own menu, since a colour is no draft.
const colourColumn = {
  key: "colour",
  label: "Colour",
  kind: "text",
  multiple: false,
  choices: [],
  required: false,
} as const satisfies Parameters<typeof Row>[0]["column"];

// The planned hires on a team, changed in its Members row, so with no pencil of their own.
const plannedHiresColumn = {
  key: "plannedHires",
  label: "Planned hires",
  kind: "text",
  multiple: false,
  choices: [],
  required: false,
} as const satisfies Parameters<typeof Row>[0]["column"];

function MemberName({ person }: { person: TeamPerson }) {
  const { name, hire } = person;
  if (hire === undefined) return name;
  return (
    <>
      {hire.shownId === undefined ? name : <FilledIn>{name}</FilledIn>}
      <KeyAfter record={{ kind: "hire", keyNumber: hire.keyNumber }} />
    </>
  );
}

// The second line starts under the name, so it sets in past the dot that hangs before the first.
function HireEntry({
  hire,
  marked,
  children,
}: {
  hire: TeamHire;
  marked?: DraftLike | undefined;
  children: ReactNode;
}) {
  const show = useDraftView();
  const { draft: shown } = viewedDraft(marked, show);
  /* v8 ignore next 5 -- screen layout: only how far the line under a dot is set in */
  const setIn = !marksIn(marked, show)
    ? ""
    : shown?.state === "rejected"
      ? classes.underRinged
      : classes.underDot;
  return (
    <span className={classes.twoLines}>
      <span>{children}</span>
      <Text component="span" size="sm" c="dimmed" className={setIn}>
        {teamHireWords(hire)}
      </Text>
    </span>
  );
}

// Someone a draft adds to a team or takes off it, as the panel names them, and the draft that does.
interface MemberMark {
  named: ReactNode;
  by: DraftLike;
}

type MarkOf = ((personId: string) => MemberMark | undefined) | undefined;

function PeopleList({
  members,
  personOf,
  markOf,
}: {
  members: readonly string[];
  personOf: (personId: string) => TeamPerson;
  markOf: MarkOf;
}) {
  const sorted = members
    .map((personId) => ({ personId, person: personOf(personId) }))
    .sort((a, b) => byName.compare(a.person.name, b.person.name));
  return (
    <ul className={classes.reports}>
      {sorted.map(({ personId, person }) => (
        <li key={personId}>
          {markOf?.(personId)?.named ?? <MemberName person={person} />}
        </li>
      ))}
    </ul>
  );
}

function HireList({
  hires,
  markOf,
}: {
  hires: readonly { personId: string; name: string; hire: TeamHire }[];
  markOf: MarkOf;
}) {
  return (
    <ul className={classes.spacedList}>
      {[...hires].sort(plannedHireOrder).map(({ personId, name, hire }) => {
        const mark = markOf?.(personId);
        return (
          <li key={personId}>
            <HireEntry hire={hire} marked={mark?.by}>
              {mark?.named ?? <MemberName person={{ name, hire }} />}
            </HireEntry>
          </li>
        );
      })}
    </ul>
  );
}

// A team's Members row lists its people alone; its planned hires, changed there too, have a row of
// their own under it while it has any.
function MemberRows({
  column,
  members,
  personOf,
  markOf,
  changed,
  editing,
}: {
  column: Column<FeatureTeam, TeamChange>;
  members: readonly string[];
  personOf: (personId: string) => TeamPerson;
  markOf: MarkOf;
  changed?: Parameters<typeof Row>[0]["changed"];
  editing: Parameters<typeof Row>[0]["editing"];
}) {
  const people = members.filter(
    (personId) => personOf(personId).hire === undefined,
  );
  const hires = members.flatMap((personId) => {
    const { name, hire } = personOf(personId);
    return hire === undefined ? [] : [{ personId, name, hire }];
  });
  return (
    <>
      <Row column={column} value={people} changed={changed} editing={editing}>
        {people.length === 0 ? undefined : (
          <PeopleList members={people} personOf={personOf} markOf={markOf} />
        )}
      </Row>
      {hires.length > 0 && (
        <Row
          column={plannedHiresColumn}
          value={hires.map(({ personId }) => personId)}
        >
          <HireList hires={hires} markOf={markOf} />
        </Row>
      )}
    </>
  );
}

export function FeatureTeamPanel({
  team,
  ...rest
}: {
  // The team shown, or none for a new one.
  team: FeatureTeam | undefined;
  // The day the chart shows, which changes take effect from, or undefined for today.
  day: string | undefined;
  // Everyone on the org chart, who may be named and chosen as members.
  people: readonly OrgChartPerson[];
  // The planned hires among them a draft removes, which can't join or lead a team.
  removing?: ReadonlySet<string>;
  edits: FeatureTeamEdits;
  show: Show;
  narrow: boolean;
  actions: FeatureTeamActions;
  onClose: () => void;
}) {
  return team === undefined ? (
    <NewFeatureTeamPanel {...rest} />
  ) : (
    <TeamDetails team={team} {...rest} />
  );
}

// A new team's name, lead and members, added together.
function NewFeatureTeamPanel({
  day,
  people,
  removing = noneRemoving,
  narrow,
  actions,
  onClose,
}: {
  day: string | undefined;
  people: readonly OrgChartPerson[];
  removing?: ReadonlySet<string>;
  narrow: boolean;
  actions: FeatureTeamActions;
  onClose: () => void;
}) {
  const [entered, setEntered] = useState<
    Record<"name" | "leadId" | "members", string | string[]>
  >({ name: "", leadId: [], members: [] });
  const { editingOf, unfinished, withRefused, refuseEntered } =
    useRecordEditing<FeatureTeam, TeamChange>();
  const choices = useMemo(() => teamChoices(people), [people]);
  const columns = teamColumns(
    people,
    choices,
    true,
    hireTurnedOff(people, removing, day ?? today()),
  );
  const shownColumns = [columns.name, columns.leadId, columns.members];
  const context: RecordEditingContext<FeatureTeam, TeamChange> = {
    id: newRecordId,
    kind: onlyKind,
    values: entered,
    adding: true,
    others: noOthers,
    recordProblem: noRecordProblem,
    save: (_change, column, value) => {
      setEntered((current) => ({ ...current, [column.key]: value }));
    },
  };
  const editing = editingOf(context);
  const members = entered.members as string[];
  // Members are chosen from the choices, so each has a name there.
  const labels = new Map(choices.map(({ id, label }) => [id, label]));
  const cards = new Map(people.map((person) => [person.id, person]));
  // A planned hire chosen is one the chart draws, which says what its details show.
  const personOf = (personId: string): TeamPerson => {
    const name = String(labels.get(personId));
    const card = cards.get(personId);
    return card?.planned === undefined
      ? { name }
      : { name, hire: { keyNumber: card.keyNumber, ...card.planned } };
  };
  return (
    <NewRecordPanel<FeatureTeam, TeamChange, FeatureTeamRequest>
      panelId={featureTeamPanelId}
      title="New feature team"
      narrow={narrow}
      saving={false}
      table={{
        recordProblem: noRecordProblem,
        // Each value entered, as the panel holds it, rather than the changes each row makes.
        request: () => ({
          name: (entered.name as string).trim(),
          leadId: (entered.leadId as string[])[0] ?? null,
          members,
          ...(day === undefined ? {} : { from: day }),
        }),
      }}
      columns={shownColumns}
      kind={onlyKind}
      values={entered}
      others={noOthers}
      unfinished={unfinished(newRecordId)}
      shown={shownColumns}
      withRefused={(found) => withRefused(newRecordId, shownColumns, found)}
      onRefused={(found) => {
        refuseEntered(newRecordId, found, shownColumns);
      }}
      onAdd={actions.create}
      onCancel={onClose}
    >
      <RecordSection id="new-feature-team-details" title="Details">
        <Row
          column={columns.name}
          value={entered.name}
          editing={editing(columns.name)}
        />
      </RecordSection>
      <RecordSection id="new-feature-team-members" title="Members">
        <Row
          column={columns.leadId}
          value={entered.leadId}
          editing={editing(columns.leadId)}
        />
        <MemberRows
          column={columns.members}
          members={members}
          personOf={personOf}
          markOf={undefined}
          editing={editing(columns.members)}
        />
      </RecordSection>
    </NewRecordPanel>
  );
}

function TeamDetails({
  team,
  day,
  people,
  removing = noneRemoving,
  edits,
  show,
  narrow,
  actions,
  onClose,
}: {
  team: FeatureTeam;
  day: string | undefined;
  people: readonly OrgChartPerson[];
  removing?: ReadonlySet<string>;
  edits: FeatureTeamEdits;
  show: Show;
  narrow: boolean;
  actions: FeatureTeamActions;
  onClose: () => void;
}) {
  const { closeStale, editingOf, refuseSaved } = useRecordEditing<
    FeatureTeam,
    TeamChange
  >();
  const choices = useMemo(() => teamChoices(people), [people]);
  const offered = useMemo(
    () => new Set(choices.map(({ id }) => id)),
    [choices],
  );
  const personOf = useMemo(() => teamPersonOf(team, people), [team, people]);
  const shown = show === "live" ? (liveTeam(team) ?? team) : team;
  const live = liveTeam(team);
  const draft = show === "live" ? undefined : team.draft;
  // The team's draft, whatever the view, which marks it and the values it changes, so the Draft view
  // decides how they show.
  const ownDraft = team.draft;
  const markedHere = (key: string) =>
    ownDraft?.action === "changed" && ownDraft.changed.includes(key)
      ? ownDraft
      : undefined;
  const changes = edits.members && show !== "live" && team.heldBy === undefined;
  // The panel's buttons offer the team's own draft; deciding it is the Drafts page's.
  const teamOffer = draftOffer({
    hasDraft: draft !== undefined,
    rejected: draft?.state === "rejected",
    unpublished: draft?.unpublished === true,
    editsDraft: changes,
    discardable: draft?.discardable === true,
    decides: false,
    publishes: false,
  });
  const columns = teamColumns(
    people,
    choices,
    edits.undated,
    hireTurnedOff(people, removing, day ?? today()),
  );
  // The server's refusal of a change made in a row, named in that row's editor, opened again on what
  // was chosen, while the panel is still shown; another team's is a new panel. Otherwise, or for a
  // field the row isn't, a notification names it.
  const refusedIn = (
    column: Column<FeatureTeam, TeamChange>,
    chosen: CellValue,
  ): RefusedIn => ({
    about: column.key,
    onRefused: ({ field, reason }) => {
      return (
        field === column.key && refuseSaved(context, column, chosen, reason)
      );
    },
  });
  const save = (
    change: TeamChange,
    column: Column<FeatureTeam, TeamChange>,
    chosen: CellValue,
  ) => {
    if (change.name !== undefined) actions.rename(team, change.name);
    if (change.leadId !== undefined) {
      actions.lead(team, change.leadId, day, refusedIn(column, chosen));
    }
    if (change.members !== undefined) {
      const changed = membersChanged(shown.members, change.members, offered);
      if (changed !== undefined) {
        actions.members(team, changed, day, refusedIn(column, chosen));
      }
    }
  };
  const context: RecordEditingContext<FeatureTeam, TeamChange> = {
    id: team.id,
    kind: onlyKind,
    values: Object.fromEntries(
      Object.values(columns).map((column) => [column.key, column.value(shown)]),
    ),
    save: changes && draft?.action !== "deleted" ? save : undefined,
    others: noOthers,
    recordProblem: noRecordProblem,
  };
  closeStale(context);
  const editing = editingOf(context);
  const from = (drafted: FeatureTeamDraft, personId: string | undefined) =>
    takesEffect(drafted, personId, day ?? today());
  const wasMember = new Set(live?.members ?? []);
  const leaving =
    draft === undefined
      ? []
      : [...wasMember].filter((personId) => !shown.members.includes(personId));
  // Without a draft, the team shown is the live one, so no one is added or removed.
  const draftedAs = (personId: string): DraftedPart | undefined =>
    leaving.includes(personId)
      ? "removed"
      : wasMember.has(personId)
        ? undefined
        : "added";
  // A member a draft adds or takes off, with the draft's dot before them, struck through when taken
  // off, as a record's parts are, and when the change takes effect, where that is not the day shown.
  const memberMark = (
    personId: string,
    by: FeatureTeamDraft,
  ): MemberMark | undefined => {
    const drafted = draftedAs(personId);
    if (drafted === undefined) return undefined;
    return {
      named: (
        <DraftedPartItem draft={by} part={drafted} from={from(by, personId)}>
          <MemberName person={personOf(personId)} />
        </DraftedPartItem>
      ),
      by,
    };
  };
  const members = [...shown.members, ...leaving];
  const markOf =
    draft === undefined
      ? undefined
      : (personId: string) => memberMark(personId, draft);
  const lead = shown.leadId === null ? undefined : personOf(shown.leadId);
  const nameDraft = markedHere("name");
  const leadDraft = markedHere("leadId");
  // Its members are marked one by one, except live only, where they are not drawn as parts.
  const membersDraft = show === "live" ? markedHere("members") : undefined;
  return (
    <SidePanelFrame
      id={featureTeamPanelId}
      titleId={titleId}
      title={shown.name}
      marked={(heading) => (
        <DraftedItem
          draft={ownDraft?.action === "changed" ? undefined : ownDraft}
          heldBy={team.heldBy}
        >
          {heading}
        </DraftedItem>
      )}
      subtitle={
        <RecordKey record={{ kind: "team", keyNumber: team.keyNumber }} />
      }
      narrow={narrow}
      close={{ label: "Close feature team", onClose }}
    >
      <div className={sidePanelScroll}>
        <DetailSections>
          {draft?.state === "rejected" && draft.reason !== undefined && (
            <Text size="sm">Reason: {draft.reason}</Text>
          )}
          <RecordSection id="feature-team-details" title="Details">
            <Row
              column={columns.name}
              value={columns.name.value(shown)}
              changed={
                nameDraft === undefined
                  ? undefined
                  : { live: columns.name.live(nameDraft), draft: nameDraft }
              }
              editing={editing(columns.name)}
            />
            <Row
              column={colourColumn}
              value={team.colour ?? ""}
              colour={team.colour}
              action={
                edits.undated &&
                live !== undefined &&
                draft?.action !== "deleted" && (
                  <TeamColourMenu
                    teamId={team.id}
                    current={team.colour}
                    team={shown.name}
                    look="change"
                    save={actions.colour(team)}
                    refreshes={featureTeamsQuery.queryKey}
                  />
                )
              }
            >
              {team.colour === null ? undefined : (
                <Text>{colourWords(team.colour)}</Text>
              )}
            </Row>
          </RecordSection>
          <RecordSection id="feature-team-members" title="Members">
            <Row
              column={columns.leadId}
              value={columns.leadId.value(shown)}
              changed={
                leadDraft === undefined
                  ? undefined
                  : {
                      live: columns.leadId.live(leadDraft),
                      draft: leadDraft,
                      from: from(leadDraft, undefined),
                    }
              }
              editing={editing(columns.leadId)}
            >
              {lead === undefined ? undefined : lead.hire === undefined ? (
                <Text>{lead.name}</Text>
              ) : (
                <HireEntry hire={lead.hire} marked={leadDraft}>
                  <MemberName person={lead} />
                </HireEntry>
              )}
            </Row>
            <MemberRows
              column={columns.members}
              members={members}
              personOf={personOf}
              markOf={markOf}
              changed={
                membersDraft === undefined ? undefined : { draft: membersDraft }
              }
              editing={editing(columns.members)}
            />
          </RecordSection>
          {changes && (
            <Group gap="xs">
              {teamOffer.resubmit && (
                <Button
                  variant="default"
                  onClick={() => {
                    actions.resubmit(team);
                  }}
                >
                  Resubmit
                </Button>
              )}
              {teamOffer.discard && (
                <Button
                  variant="default"
                  onClick={() => {
                    actions.discard(team);
                  }}
                >
                  Discard draft
                </Button>
              )}
              {edits.undated && draft?.action !== "deleted" && (
                <Button
                  variant="outline"
                  color="red"
                  onClick={() => {
                    actions.removeTeam(team);
                  }}
                >
                  Remove feature team
                </Button>
              )}
            </Group>
          )}
        </DetailSections>
      </div>
    </SidePanelFrame>
  );
}
