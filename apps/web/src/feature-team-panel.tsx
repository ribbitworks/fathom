// SPDX-License-Identifier: Apache-2.0

// A feature team's details, beside the org chart: its name, colour, lead, and members, as its draft
// makes them, with a drafted name's live one under it and members a draft adds or removes marked, as
// managers' teams are, and when each change takes effect, where that is not the day shown. Those
// who propose feature teams add and remove members and choose the lead, from the day the chart
// shows, those who edit them also rename and remove the team. Each change is a draft, saved at once,
// which can be undone from its notification. A new team is named first, then given members.

import {
  type FeatureTeam,
  featureTeamLengths,
  type OrgChartPerson,
  type PaletteColour,
  type Show,
} from "@fathom/shared";
import {
  Button,
  CloseButton,
  type ComboboxItem,
  type ComboboxParsedItem,
  isOptionsGroup,
  type OptionsFilter,
  Group,
  Select,
  Stack,
  Text,
  TextInput,
} from "@mantine/core";
import { useState } from "react";
import {
  featureTeamsQuery,
  liveTeam,
  takesEffect,
  teamPersonNamer,
} from "./feature-teams.ts";
import { SidePanelFrame, sidePanelScroll } from "./side-panel.tsx";
import { DraftMark, LiveLine } from "./status-mark.tsx";
import { TeamColourMenu } from "./team-colour-menu.tsx";
import { today } from "./today.ts";

export const featureTeamPanelId = "feature-team-panel";
const titleId = "feature-team-panel-title";
// The picker's choice that starts a new team, which no team's id can be.
const newTeam = "new";

export const noFeatureTeamEdits: FeatureTeamEdits = {
  propose: false,
  edit: false,
  colours: false,
  dates: false,
};

export interface FeatureTeamEdits {
  // Adds teams, and changes their members and leads.
  propose: boolean;
  // Also renames and removes teams.
  edit: boolean;
  colours: boolean;
  // Changes teams from an earlier day than today.
  dates: boolean;
}

export interface FeatureTeamActions {
  create: (name: string) => void;
  rename: (team: FeatureTeam, name: string) => void;
  lead: (
    team: FeatureTeam,
    leadId: string | null,
    from: string | undefined,
  ) => void;
  add: (team: FeatureTeam, personId: string, from: string | undefined) => void;
  remove: (
    team: FeatureTeam,
    personId: string,
    from: string | undefined,
  ) => void;
  removeTeam: (team: FeatureTeam) => void;
  discard: (team: FeatureTeam) => void;
  resubmit: (team: FeatureTeam) => void;
  colour: (
    team: FeatureTeam,
  ) => (colour: PaletteColour | null) => Promise<void>;
}

const byName = new Intl.Collator(undefined, { sensitivity: "base" });

export function FeatureTeamPanel({
  team,
  day,
  people,
  edits,
  show,
  narrow,
  actions,
  teams,
  onTeam,
  onNew,
  onClose,
}: {
  // The team shown, or none for a new one.
  team: FeatureTeam | undefined;
  // The day the chart shows, which changes take effect from, or undefined for today.
  day: string | undefined;
  // Every team, to choose another from.
  teams: readonly FeatureTeam[];
  onTeam: (id: string) => void;
  onNew: () => void;
  // Everyone on the org chart, who may be named and chosen as members.
  people: readonly OrgChartPerson[];
  edits: FeatureTeamEdits;
  show: Show;
  narrow: boolean;
  actions: FeatureTeamActions;
  onClose: () => void;
}) {
  const [name, setName] = useState(team?.name ?? "");
  const [renaming, setRenaming] = useState(false);
  const frame = (title: string, content: React.ReactNode) => (
    <SidePanelFrame
      id={featureTeamPanelId}
      titleId={titleId}
      title={title}
      narrow={narrow}
      close={{ label: "Close feature team", onClose }}
    >
      <div className={sidePanelScroll}>{content}</div>
    </SidePanelFrame>
  );
  if (team === undefined) {
    return frame(
      "New feature team",
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (name.trim() !== "") actions.create(name.trim());
        }}
      >
        <Stack gap="md">
          <TextInput
            label="Name"
            data-autofocus
            aria-required
            maxLength={featureTeamLengths.name}
            value={name}
            onChange={(event) => {
              setName(event.currentTarget.value);
            }}
          />
          <Text size="sm" c="dimmed">
            Name the team first; then add its members and choose its lead.
          </Text>
          <Group justify="flex-end">
            <Button variant="default" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={name.trim() === ""}>
              Add feature team
            </Button>
          </Group>
        </Stack>
      </form>,
    );
  }
  const nameOf = teamPersonNamer(team, people);
  const shown = show === "live" ? (liveTeam(team) ?? team) : team;
  const live = liveTeam(team);
  const draft = show === "live" ? undefined : team.draft;
  const changes = edits.propose && show !== "live" && team.heldBy === undefined;
  const wasMember = new Set(live?.members ?? []);
  const leaving =
    draft === undefined
      ? []
      : [...wasMember].filter((personId) => !shown.members.includes(personId));
  const choices = people
    .filter(
      (person) =>
        person.planned === undefined &&
        person.left !== true &&
        !shown.members.includes(person.id),
    )
    .sort((a, b) => byName.compare(a.preferredName, b.preferredName))
    .map((person) => ({ value: person.id, label: person.preferredName }));
  // Each person's position and reporting team, shown under their name and searched with it, so
  // members are chosen knowing what they do and whose team they are on.
  const aboutOf = (personId: string) => {
    const person = people.find(({ id }) => id === personId);
    const manager = people.find(({ id }) => id === person?.managerId);
    const team =
      manager === undefined
        ? undefined
        : (manager.teamName ?? `${manager.preferredName}'s team`);
    return [person?.position, team].filter(Boolean).join(", ");
  };
  const picking = {
    searchable: true,
    nothingFoundMessage: "Nobody by that name",
    renderOption: ({
      option,
    }: {
      option: { value: string; label: string };
    }) => (
      <div>
        <Text size="sm">{option.label}</Text>
        <Text size="xs" c="dimmed">
          {aboutOf(option.value)}
        </Text>
      </div>
    ),
    filter: (({ options, search }) => {
      const words = search.toLowerCase().split(/\s+/).filter(Boolean);
      const fits = (item: ComboboxItem) => {
        const text = `${item.label} ${aboutOf(item.value)}`.toLowerCase();
        return words.every((word) => text.includes(word));
      };
      return options.flatMap((option): ComboboxParsedItem[] => {
        if (isOptionsGroup(option)) {
          const items = option.items.filter(fits);
          return items.length === 0 ? [] : [{ ...option, items }];
        }
        return fits(option) ? [option] : [];
      });
    }) satisfies OptionsFilter,
  };
  const members = [...shown.members].sort((a, b) =>
    byName.compare(nameOf(a), nameOf(b)),
  );
  const from = (personId: string | undefined) =>
    draft === undefined
      ? undefined
      : takesEffect(draft, personId, day ?? today());
  const leadFrom = from(undefined);
  return frame(
    "Feature team",
    <Stack gap="lg">
      {draft !== undefined && (
        <Group gap="xs">
          <DraftMark draft={draft} />
          {team.heldBy !== undefined && (
            <Text size="sm" c="dimmed">
              {team.heldBy} is changing this team
            </Text>
          )}
        </Group>
      )}
      {draft?.state === "rejected" && draft.reason !== undefined && (
        <Text size="sm">Reason: {draft.reason}</Text>
      )}
      <Stack gap={4}>
        {renaming ? (
          <TextInput
            label="Name"
            data-autofocus
            maxLength={featureTeamLengths.name}
            value={name}
            onChange={(event) => {
              setName(event.currentTarget.value);
            }}
            onBlur={() => {
              setRenaming(false);
              if (name.trim() !== "" && name.trim() !== shown.name) {
                actions.rename(team, name.trim());
              }
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") event.currentTarget.blur();
              if (event.key === "Escape") {
                event.preventDefault();
                setName(shown.name);
                setRenaming(false);
              }
            }}
          />
        ) : (
          <Group gap="xs" align="flex-end" wrap="nowrap">
            <Select
              label="Team"
              searchable
              allowDeselect={false}
              nothingFoundMessage="No team by that name"
              data={[
                ...teams.map((one) => ({ value: one.id, label: one.name })),
                ...(edits.propose && show !== "live"
                  ? [{ value: newTeam, label: "New feature team…" }]
                  : []),
              ]}
              value={team.id}
              onChange={(value) => {
                if (value === newTeam) onNew();
                else onTeam(String(value));
              }}
              style={{ flex: 1 }}
            />
            {changes && edits.edit && (
              <Button
                variant="default"
                onClick={() => {
                  setName(shown.name);
                  setRenaming(true);
                }}
              >
                Rename
              </Button>
            )}
          </Group>
        )}
        {draft?.live.name !== undefined && (
          <LiveLine>{draft.live.name}</LiveLine>
        )}
      </Stack>
      {edits.colours && live !== undefined && (
        <Group gap="xs">
          <Text size="sm" fw={500}>
            Colour
          </Text>
          <TeamColourMenu
            teamId={team.id}
            current={team.colour}
            team={shown.name}
            square
            save={actions.colour(team)}
            refreshes={featureTeamsQuery.queryKey}
          />
        </Group>
      )}
      <Stack gap={4}>
        {changes ? (
          <Select
            label="Feature lead"
            placeholder="No lead"
            clearable
            {...picking}
            data={[
              {
                group: "Members",
                items: members.map((personId) => ({
                  value: personId,
                  label: nameOf(personId),
                })),
              },
              { group: "Anyone else, who will join the team", items: choices },
            ]}
            value={shown.leadId}
            onChange={(leadId) => {
              actions.lead(team, leadId, day);
            }}
          />
        ) : (
          <Text size="sm">
            <Text span fw={500}>
              Feature lead{" "}
            </Text>
            {shown.leadId === null ? "None" : nameOf(shown.leadId)}
          </Text>
        )}
        {draft?.live.leadId !== undefined && (
          <LiveLine>
            {draft.live.leadId === null ? "None" : nameOf(draft.live.leadId)}
            {leadFrom === undefined ? "" : `, until ${leadFrom}`}
          </LiveLine>
        )}
      </Stack>
      <Stack gap="xs">
        <Text size="sm" fw={500}>
          Members
        </Text>
        {members.length === 0 && leaving.length === 0 && (
          <Text size="sm" c="dimmed">
            No members yet.
          </Text>
        )}
        {members.map((personId) => (
          <Group key={personId} gap="xs" justify="space-between" wrap="nowrap">
            <Group gap="xs" wrap="nowrap" miw={0}>
              <Text size="sm" truncate>
                {nameOf(personId)}
                {personId === shown.leadId ? " (lead)" : ""}
              </Text>
              {draft !== undefined && !wasMember.has(personId) && (
                <DraftMark draft={draft} from={from(personId)} />
              )}
            </Group>
            {changes && (
              <CloseButton
                size="sm"
                aria-label={`Remove ${nameOf(personId)} from ${shown.name}`}
                onClick={() => {
                  actions.remove(team, personId, day);
                }}
              />
            )}
          </Group>
        ))}
        {leaving.map((personId) => {
          const leaves = from(personId);
          return (
            <LiveLine key={personId}>
              {nameOf(personId)}, leaving
              {leaves === undefined ? "" : ` from ${leaves}`}
            </LiveLine>
          );
        })}
        {changes && (
          <Select
            aria-label="Add member"
            placeholder="Add member"
            {...picking}
            data={choices}
            value={null}
            onChange={(personId) => {
              actions.add(team, String(personId), day);
            }}
          />
        )}
      </Stack>
      {edits.propose && show !== "live" && team.heldBy === undefined && (
        <Group gap="xs">
          {draft?.state === "rejected" && (
            <Button
              variant="default"
              onClick={() => {
                actions.resubmit(team);
              }}
            >
              Resubmit
            </Button>
          )}
          {draft !== undefined && (
            <Button
              variant="default"
              onClick={() => {
                actions.discard(team);
              }}
            >
              Discard draft
            </Button>
          )}
          {edits.edit && draft?.action !== "deleted" && (
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
    </Stack>,
  );
}
