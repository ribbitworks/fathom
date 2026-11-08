// SPDX-License-Identifier: Apache-2.0

// The list of feature teams beside the org chart, where a team is opened in its panel, and where
// those who propose feature teams add one; each team named with its colour, and marked when its
// draft is waiting.

import type { FeatureTeam } from "@fathom/shared";
import { Button, Group, Menu, Text } from "@mantine/core";
import { AppMenu } from "./app-menu.tsx";
import { Swatch } from "./colour-swatch.tsx";
import { DraftMark } from "./status-mark.tsx";

export function FeatureTeamsList({
  teams,
  canAdd,
  onOpen,
  onNew,
}: {
  teams: readonly FeatureTeam[];
  canAdd: boolean;
  onOpen: (id: string) => void;
  onNew: () => void;
}) {
  return (
    <AppMenu position="bottom-end" shadow="md">
      <AppMenu.Target>
        <Button variant="default">Feature teams</Button>
      </AppMenu.Target>
      <AppMenu.Dropdown>
        {teams.length === 0 && <Menu.Label>No feature teams yet</Menu.Label>}
        {teams.map((team) => (
          <Menu.Item
            key={team.id}
            leftSection={
              team.colour === null ? null : (
                <Swatch colour={team.colour} size={8} />
              )
            }
            onClick={() => {
              onOpen(team.id);
            }}
          >
            <Group gap="xs" wrap="nowrap">
              <Text size="sm">{team.name}</Text>
              {team.draft !== undefined && <DraftMark draft={team.draft} />}
            </Group>
          </Menu.Item>
        ))}
        {canAdd && (
          <>
            <Menu.Divider />
            <Menu.Item onClick={onNew}>New feature team</Menu.Item>
          </>
        )}
      </AppMenu.Dropdown>
    </AppMenu>
  );
}
