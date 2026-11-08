// SPDX-License-Identifier: Apache-2.0

// The menu that changes a manager's team's colour, for those who may colour teams.
// A colour is no draft, so the chart is redrawn in it once saved, and the change can be undone from
// its notification.

import { type PaletteColour, paletteColours } from "@fathom/shared";
import { ActionIcon, Menu, UnstyledButton } from "@mantine/core";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { describeProblem } from "./api.ts";
import { AppMenu } from "./app-menu.tsx";
import { Swatch } from "./colour-swatch.tsx";
import { colourWords } from "./colours.ts";
import { Icon } from "./icons.tsx";
import { changeMade, notifyFailure, notifyUndoable } from "./notices.tsx";
import { orgChartQuery, setTeamColour } from "./org-chart.ts";
import classes from "./org-chart.module.css";

export function TeamColourMenu({
  managerId,
  current,
  team,
  square = false,
}: {
  managerId: string;
  current: PaletteColour | null;
  team: string;
  // The dot in a button's square, where a bare dot would be missed.
  square?: boolean;
}) {
  const queryClient = useQueryClient();
  const change = useMutation({
    mutationFn: ({
      colour,
    }: {
      colour: PaletteColour | null;
      // The colour before, which Undo puts back; none when this is the undoing.
      previous?: PaletteColour | null;
    }) => setTeamColour(managerId, colour),
    onError: (error) => {
      notifyFailure(
        describeProblem(
          error,
          `Fathom could not change the colour of ${team}.`,
        ),
      );
    },
    onSuccess: (_, { colour, previous }) => {
      if (previous === undefined) return;
      const done =
        colour === null
          ? `${team} no longer has a colour.`
          : `${team} is now drawn in ${colourWords(colour)}.`;
      notifyUndoable(done, () => {
        change.mutate({ colour: previous });
      });
    },
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: orgChartQuery.queryKey }),
  });
  const choose = (colour: PaletteColour | null) => {
    if (colour === current) return;
    changeMade();
    change.mutate({ colour, previous: current });
  };
  const ticked = (colour: PaletteColour | null) =>
    colour === current ? <Icon name="check" /> : null;
  const label = `Colour of ${team}: ${current === null ? "no colour" : colourWords(current)}`;
  const dot =
    current === null ? (
      <span className={classes.noColour} />
    ) : (
      <Swatch colour={current} size={8} />
    );
  return (
    <AppMenu position="bottom-start" shadow="md">
      <AppMenu.Target>
        {square ? (
          <ActionIcon
            variant="default"
            size="md"
            aria-label={label}
            title="Change the team's colour"
          >
            {dot}
          </ActionIcon>
        ) : (
          <UnstyledButton
            className={[classes.colourButton, "nodrag", "nopan"].join(" ")}
            aria-label={label}
            title="Change the team's colour"
          >
            {dot}
          </UnstyledButton>
        )}
      </AppMenu.Target>
      <AppMenu.Dropdown>
        <Menu.Label>Colour of {team}</Menu.Label>
        {paletteColours.map((colour) => (
          <Menu.Item
            key={colour}
            leftSection={<Swatch colour={colour} size={12} />}
            rightSection={ticked(colour)}
            onClick={() => {
              choose(colour);
            }}
          >
            {colourWords(colour)}
          </Menu.Item>
        ))}
        <Menu.Divider />
        <Menu.Item
          rightSection={ticked(null)}
          onClick={() => {
            choose(null);
          }}
        >
          No colour
        </Menu.Item>
      </AppMenu.Dropdown>
    </AppMenu>
  );
}
