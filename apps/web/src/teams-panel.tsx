// SPDX-License-Identifier: Apache-2.0

// Every manager's team in one list, for those who can name teams or colour them: where an unnamed
// team is named, and where colours are found by those who never notice the dot on a card.

import type { OrgChartPerson } from "@fathom/shared";
import { Button, Drawer, Group, Stack, Text } from "@mantine/core";
import { useState } from "react";
import { Swatch } from "./colour-swatch.tsx";
import type { OrgTree, TeamEdits } from "./org-chart.ts";
import classes from "./org-chart.module.css";
import { TeamColourMenu } from "./team-colour-menu.tsx";
import { TeamNameEditor } from "./team-name-editor.tsx";

const byName = new Intl.Collator(undefined, { sensitivity: "base" });

// Named teams first, by name, then unnamed ones by their manager's name.
function teamsOf(tree: OrgTree): OrgChartPerson[] {
  return [...tree.people.values()]
    .filter(
      (person) => person.employeeId !== null && tree.reports.has(person.id),
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
    (person) => edits.names || person.teamName !== null,
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
                {person.teamName === null ? null : edits.colours ? (
                  <TeamColourMenu
                    managerId={person.id}
                    current={person.teamColour}
                    team={person.teamName}
                    square
                  />
                ) : (
                  person.teamColour !== null && (
                    <Swatch colour={person.teamColour} size={8} />
                  )
                )}
              </span>
              <Stack gap={0} miw={0}>
                {edits.names ? (
                  <TeamNameEditor
                    managerId={person.id}
                    managerName={person.preferredName}
                    name={person.teamName}
                    size="sm"
                  />
                ) : (
                  <Text size="sm" truncate>
                    {person.teamName}
                  </Text>
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
