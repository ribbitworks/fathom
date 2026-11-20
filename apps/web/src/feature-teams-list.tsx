// SPDX-License-Identifier: Apache-2.0

// The list of feature teams beside the org chart, where a team is opened in its panel, and where
// those who edit feature teams add one; each team named with its colour, and marked when its
// draft is waiting. Shown live only, each team is as it is live, marked Live while a draft waits.

import type { FeatureTeam, Show } from "@fathom/shared";
import { Button, Group, Menu, Text } from "@mantine/core";
import { AppMenu } from "./app-menu.tsx";
import { Swatch, teamSwatchSize } from "./colour-swatch.tsx";
import { liveTeam } from "./feature-teams.ts";
import { DraftedItem } from "./status-mark.tsx";

export function FeatureTeamsList({
  teams: all,
  show,
  canAdd,
  onOpen,
  onNew,
}: {
  teams: readonly FeatureTeam[];
  show: Show;
  canAdd: boolean;
  onOpen: (id: string) => void;
  onNew: () => void;
}) {
  // Each team as the view shows it, keeping its draft, so the Draft view decides how it is marked.
  const teams =
    show === "live"
      ? all.flatMap((team) => {
          const live = liveTeam(team);
          return live === undefined ? [] : [{ ...live, draft: team.draft }];
        })
      : all;
  return (
    <AppMenu position="bottom-end">
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
                <Swatch colour={team.colour} size={teamSwatchSize} alone />
              )
            }
            onClick={() => {
              onOpen(team.id);
            }}
          >
            <Group gap="xs" wrap="nowrap">
              <Text size="sm">
                <DraftedItem draft={team.draft}>{team.name}</DraftedItem>
              </Text>
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
