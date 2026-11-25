// SPDX-License-Identifier: Apache-2.0

// The menu that changes a team's colour, a manager's or a feature team's, for those who may colour
// teams.
// A colour is no draft, so the chart is redrawn in it once saved, and the change can be undone from
// its notification.

import { type PaletteColour, paletteColours } from "@fathom/shared";
import { ActionIcon, Menu, UnstyledButton } from "@mantine/core";
import {
  type QueryKey,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import type { ReactNode } from "react";
import { describeProblem } from "./api.ts";
import { AppMenu } from "./app-menu.tsx";
import { Swatch, teamSwatchSize } from "./colour-swatch.tsx";
import { colourWords } from "./colours.ts";
import { Icon } from "./icons.tsx";
import { changeButton } from "./record-details.tsx";
import { changeMade, notifyFailure, notifyUndoable } from "./notices.tsx";
import { orgChartQuery, setTeamColour } from "./org-chart.ts";
import classes from "./org-chart.module.css";

type ColourMenuLook = "dot" | "square" | "change";

export function TeamColourMenu({
  teamId,
  current,
  team,
  look = "dot",
  save = (colour) => setTeamColour(teamId, colour),
  refreshes = orgChartQuery.queryKey,
}: {
  // The manager whose team it is, or the feature team's id when save is given.
  teamId: string;
  current: PaletteColour | null;
  team: string;
  // What opens the menu: the bare dot, as on a card; the dot in a button's square, where a bare dot
  // would be missed; or a details panel's change button, beside the colour shown in words.
  look?: ColourMenuLook;
  // Saves the colour chosen, a manager's team's unless given.
  save?: (colour: PaletteColour | null) => Promise<void>;
  // The data the colour is drawn from, reloaded once it is saved.
  refreshes?: QueryKey;
}) {
  const queryClient = useQueryClient();
  const change = useMutation({
    mutationFn: ({
      colour,
    }: {
      colour: PaletteColour | null;
      // The colour before, which Undo puts back; none when this is the undoing.
      previous?: PaletteColour | null;
    }) => save(colour),
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
          : `${team}'s colour is now ${colourWords(colour)}.`;
      notifyUndoable(done, () => {
        change.mutate({ colour: previous });
      });
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: refreshes }),
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
      <Swatch colour={current} size={teamSwatchSize} alone />
    );
  const title = "Change the team's colour";
  const targets: Record<ColourMenuLook, ReactNode> = {
    dot: (
      <UnstyledButton
        className={[classes.colourButton, "nodrag", "nopan"].join(" ")}
        aria-label={label}
        title={title}
      >
        {dot}
      </UnstyledButton>
    ),
    square: (
      <ActionIcon variant="default" size="md" aria-label={label} title={title}>
        {dot}
      </ActionIcon>
    ),
    change: <ActionIcon {...changeButton("Colour")} title={title} />,
  };
  return (
    <AppMenu position="bottom-start">
      <AppMenu.Target>
        {
          // The look is one of the fixed looks.
          // eslint-disable-next-line security/detect-object-injection
          targets[look]
        }
      </AppMenu.Target>
      <AppMenu.Dropdown>
        <Menu.Label>Colour of {team}</Menu.Label>
        {paletteColours.map((colour) => (
          <Menu.Item
            key={colour}
            leftSection={<Swatch colour={colour} size={14} alone />}
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
