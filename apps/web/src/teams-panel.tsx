// SPDX-License-Identifier: Apache-2.0

// Every manager's team in one list, for those who can name teams or colour them: where an unnamed
// team is named, and where colours are found by those who never notice the dot on a card. A drafted
// name is marked as on the cards, with the live one, if any, under it, marked Live.

import { Button, Drawer, Group, Stack, Text } from "@mantine/core";
import { useState } from "react";
import { Swatch, teamSwatchSize } from "./colour-swatch.tsx";
import {
  hasApprovedName,
  type ChartPerson,
  type OrgTree,
  type TeamEdits,
} from "./org-chart.ts";
import classes from "./org-chart.module.css";
import { TeamColourMenu } from "./team-colour-menu.tsx";
import { TeamNameEditor } from "./team-name-editor.tsx";
import { LiveLine, MarkRow } from "./status-mark.tsx";
import { TeamMarks } from "./org-chart-marks.tsx";

const byName = new Intl.Collator(undefined, { sensitivity: "base" });

// Named teams first, by name, then unnamed ones by their manager's name. A planned team is named
// only once someone fills its planned manager, so it is not listed.
function teamsOf(tree: OrgTree): ChartPerson[] {
  return [...tree.people.values()]
    .filter(
      (person) => person.planned === undefined && tree.reports.has(person.id),
    )
    .sort((a, b) =>
      a.teamName === null || b.teamName === null
        ? Number(a.teamName === null) - Number(b.teamName === null) ||
          byName.compare(a.preferredName, b.preferredName)
        : byName.compare(a.teamName, b.teamName),
    );
}

export function TeamsPanel({
  tree,
  edits,
}: {
  tree: OrgTree;
  edits: TeamEdits;
}) {
  // Those who may only colour teams have nothing to do with a team that has no name.
  const teams = teamsOf(tree).filter(
    (person) =>
      edits.names || person.teamName !== null || hasApprovedName(person),
  );
  const [opened, setOpened] = useState(false);
  return (
    <>
      <Button
        variant="default"
        onClick={() => {
          setOpened(true);
        }}
      >
        Teams
      </Button>
      <Drawer
        opened={opened}
        onClose={() => {
          setOpened(false);
        }}
        position="right"
        size="sm"
        title="Teams"
      >
        <Stack gap="sm">
          {teams.map((person) => (
            <Group key={person.id} gap="sm" wrap="nowrap">
              <span className={classes.teamDot}>
                {person.teamName === null ? null : edits.colours &&
                  hasApprovedName(person) ? (
                  <TeamColourMenu
                    teamId={person.id}
                    current={person.teamColour}
                    team={person.teamName}
                    look="square"
                  />
                ) : (
                  person.teamColour !== null && (
                    <Swatch
                      colour={person.teamColour}
                      size={teamSwatchSize}
                      alone
                    />
                  )
                )}
              </span>
              <Stack gap={0} miw={0}>
                <MarkRow>
                  <TeamMarks person={person}>
                    {edits.names ? (
                      <TeamNameEditor
                        managerId={person.id}
                        managerName={person.preferredName}
                        name={person.teamName}
                        size="sm"
                      />
                    ) : (
                      <Text
                        size="sm"
                        fs={person.teamName === null ? "italic" : undefined}
                        truncate
                      >
                        {person.teamName ?? "No name"}
                      </Text>
                    )}
                  </TeamMarks>
                </MarkRow>
                {person.renamed !== undefined &&
                  person.renamed.live !== null && (
                    <LiveLine>{person.renamed.live}</LiveLine>
                  )}
                <Text size="xs" c="dimmed" truncate>
                  Led by {person.preferredName}
                </Text>
              </Stack>
            </Group>
          ))}
        </Stack>
      </Drawer>
    </>
  );
}
