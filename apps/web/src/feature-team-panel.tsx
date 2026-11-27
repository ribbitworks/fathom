// SPDX-License-Identifier: Apache-2.0

// A feature team's details beside the org chart, and the form that adds one.

import type { Refusal } from "./api.ts";
import {
  type Choice,
  type FeatureTeam,
  type FeatureTeamDraft,
  featureTeamLengths,
  type FeatureTeamRequest,
  type OrgChartPerson,
  type PaletteColour,
  type Show,
} from "@fathom/shared";
import { Button, Group, Text } from "@mantine/core";
import { type ReactNode, useMemo, useState } from "react";
import { colourWords } from "./colours.ts";
import {
  featureTeamsQuery,
  liveTeam,
  membersChanged,
  takesEffect,
  teamPersonNamer,
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
import { RecordKey } from "./record-key.tsx";
import { SidePanelFrame, sidePanelScroll } from "./side-panel.tsx";
import {
  DraftedItem,
  type DraftedPart,
  DraftedPartItem,
} from "./status-mark.tsx";
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
  lead: (
    team: FeatureTeam,
    leadId: string | null,
    from: string | undefined,
  ) => void;
  members: (
    team: FeatureTeam,
    change: { add: string[]; remove: string[] },
    from: string | undefined,
  ) => void;
  removeTeam: (team: FeatureTeam) => void;
  discard: (team: FeatureTeam) => void;
  resubmit: (team: FeatureTeam) => void;
  colour: (
    team: FeatureTeam,
  ) => (colour: PaletteColour | null) => Promise<void>;
}

// A change made in one of the team's rows.
type TeamChange = Partial<
  Pick<FeatureTeamRequest, "name" | "leadId" | "members">
>;

// The team's own fields, so a panel holds no other kind of record.
const onlyKind = "";

const byName = new Intl.Collator(undefined, { sensitivity: "base" });

// Everyone who may be chosen as a team's lead or member, by name, each described by their position
// and the team they are on or whom they report to.
function teamChoices(people: readonly OrgChartPerson[]): Choice[] {
  const byId = new Map(people.map((person) => [person.id, person]));
  const aboutOf = (person: OrgChartPerson) => {
    const manager =
      person.managerId === null ? undefined : byId.get(person.managerId);
    return aboutPerson(
      person.position,
      manager && reportingWords(manager.teamName, manager.preferredName),
    );
  };
  return people
    .filter((person) => person.planned === undefined && person.left !== true)
    .sort((a, b) => byName.compare(a.preferredName, b.preferredName))
    .map((person) => ({
      id: person.id,
      label: person.preferredName,
      description: aboutOf(person),
      retired: false,
    }));
}

// The rows the team's values are shown and changed in.
function teamColumns(
  choices: Choice[],
  canRename: boolean,
): Record<"name" | "leadId" | "members", Column<FeatureTeam, TeamChange>> {
  return {
    name: fieldColumn("name", "text", {
      label: "Name",
      required: true,
      choices: [],
      multiple: false,
      maxLength: featureTeamLengths.name,
      readOnly: !canRename,
    }),
    leadId: fieldColumn("leadId", "choice", {
      label: "Feature lead",
      required: false,
      choices,
      multiple: false,
      emptyLabel: "None",
    }),
    members: {
      ...fieldColumn<FeatureTeam, TeamChange>("members", "choice", {
        label: "Members",
        required: false,
        choices,
        multiple: true,
        emptyLabel: "None",
      }),
      change: (value) => ({ members: value as string[] }),
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

// A team's members by name, one to a line, each with what a draft does to them, if anything.
function MemberList({
  members,
  nameOf,
  markOf,
}: {
  members: readonly string[];
  nameOf: (personId: string) => string;
  markOf?: ((personId: string) => ReactNode) | undefined;
}) {
  return (
    <ul className={classes.reports}>
      {[...members]
        .sort((a, b) => byName.compare(nameOf(a), nameOf(b)))
        .map((personId) => (
          <li key={personId}>{markOf?.(personId) ?? nameOf(personId)}</li>
        ))}
    </ul>
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
  narrow,
  actions,
  onClose,
}: {
  day: string | undefined;
  people: readonly OrgChartPerson[];
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
  const columns = teamColumns(choices, true);
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
  const nameOf = (personId: string) => String(labels.get(personId));
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
        <Row
          column={columns.members}
          value={members}
          editing={editing(columns.members)}
        >
          {members.length === 0 ? undefined : (
            <MemberList members={members} nameOf={nameOf} />
          )}
        </Row>
      </RecordSection>
    </NewRecordPanel>
  );
}

function TeamDetails({
  team,
  day,
  people,
  edits,
  show,
  narrow,
  actions,
  onClose,
}: {
  team: FeatureTeam;
  day: string | undefined;
  people: readonly OrgChartPerson[];
  edits: FeatureTeamEdits;
  show: Show;
  narrow: boolean;
  actions: FeatureTeamActions;
  onClose: () => void;
}) {
  const { closeStale, editingOf } = useRecordEditing<FeatureTeam, TeamChange>();
  const choices = useMemo(() => teamChoices(people), [people]);
  const offered = useMemo(
    () => new Set(choices.map(({ id }) => id)),
    [choices],
  );
  const nameOf = teamPersonNamer(team, people);
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
    changedByUser: draft?.changedByUser === true,
    decides: false,
    publishes: false,
  });
  const columns = teamColumns(choices, edits.undated);
  const save = (change: TeamChange) => {
    if (change.name !== undefined) actions.rename(team, change.name);
    if (change.leadId !== undefined) actions.lead(team, change.leadId, day);
    if (change.members !== undefined) {
      const changed = membersChanged(shown.members, change.members, offered);
      if (changed !== undefined) actions.members(team, changed, day);
    }
  };
  const context: RecordEditingContext<FeatureTeam, TeamChange> = {
    id: team.id,
    kind: onlyKind,
    values: Object.fromEntries(
      Object.values(columns).map((column) => [column.key, column.value(shown)]),
    ),
    save:
      changes && draft?.action !== "deleted"
        ? (change) => {
            save(change);
          }
        : undefined,
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
  const memberMark = (personId: string, by: FeatureTeamDraft) => {
    const drafted = draftedAs(personId);
    if (drafted === undefined) return undefined;
    return (
      <DraftedPartItem draft={by} part={drafted} from={from(by, personId)}>
        {nameOf(personId)}
      </DraftedPartItem>
    );
  };
  const members = [...shown.members, ...leaving];
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
              {shown.leadId === null ? undefined : (
                <Text>{nameOf(shown.leadId)}</Text>
              )}
            </Row>
            <Row
              column={columns.members}
              value={columns.members.value(shown)}
              changed={
                membersDraft === undefined ? undefined : { draft: membersDraft }
              }
              editing={editing(columns.members)}
            >
              {members.length === 0 ? undefined : (
                <MemberList
                  members={members}
                  nameOf={nameOf}
                  markOf={
                    draft === undefined
                      ? undefined
                      : (personId) => memberMark(personId, draft)
                  }
                />
              )}
            </Row>
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
