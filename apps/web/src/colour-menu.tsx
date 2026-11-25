// SPDX-License-Identifier: Apache-2.0

// The menu that changes a colour chosen for a record, such as a manager's team's, a feature team's
// or a feature's, for those who may choose it, and the row that shows it in a record's details.
// A colour is no draft, so the page is redrawn in it once saved, and the change can be undone from
// its notification.

import { type PaletteColour, paletteColours } from "@fathom/shared";
import { ActionIcon, Menu, Text, UnstyledButton } from "@mantine/core";
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
import { changeButton, Row } from "./record-details.tsx";
import { changeMade, notifyFailure, notifyUndoable } from "./notices.tsx";
import classes from "./org-chart.module.css";

type ColourMenuLook = "dot" | "square" | "change";

// A record with no colour of its own that takes its team's, such as a feature, chooses its team's
// by these words, rather than none.
export const teamsColourWords = "Team's colour";

export function ColourMenu({
  current,
  inherited,
  name,
  look = "dot",
  save,
  refreshes,
  title = "Change the team's colour",
}: {
  current: PaletteColour | null;
  // The colour shown while the record has none of its own, its team's, for a record that takes
  // one; undefined for a record that has none then.
  inherited?: PaletteColour | null | undefined;
  // The record's name, as the menu and its notifications name it.
  name: string;
  // What opens the menu: the bare dot, as on a card; the dot in a button's square, where a bare dot
  // would be missed; or a details panel's change button, beside the colour shown in words.
  look?: ColourMenuLook;
  save: (colour: PaletteColour | null) => Promise<void>;
  // The data the colour is drawn from, reloaded once it is saved.
  refreshes: QueryKey;
  // What pointing at the menu's button says it does, a team's colour unless the caller says.
  title?: string;
}) {
  const queryClient = useQueryClient();
  const takesTeams = inherited !== undefined;
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
          `Fathom could not change the colour of ${name}.`,
        ),
      );
    },
    onSuccess: (_, { colour, previous }) => {
      if (previous === undefined) return;
      const done =
        colour !== null
          ? `${name} now has the colour ${colourWords(colour)}.`
          : takesTeams
            ? `${name} now has its team's colour.`
            : `${name} no longer has a colour.`;
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
  const label = `Colour of ${name}: ${current === null ? (takesTeams ? "the team's colour" : "no colour") : colourWords(current)}`;
  const dot =
    current === null ? (
      <span className={classes.noColour} />
    ) : (
      <Swatch colour={current} size={teamSwatchSize} alone />
    );
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
        <Menu.Label>Colour of {name}</Menu.Label>
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
          leftSection={
            takesTeams && inherited !== null ? (
              <Swatch colour={inherited} size={14} alone />
            ) : undefined
          }
          rightSection={ticked(null)}
          onClick={() => {
            choose(null);
          }}
        >
          {takesTeams ? teamsColourWords : "No colour"}
        </Menu.Item>
      </AppMenu.Dropdown>
    </AppMenu>
  );
}

const colourColumn = {
  key: "colour",
  label: "Colour",
  kind: "text",
  multiple: false,
  choices: [],
  required: false,
} as const satisfies Parameters<typeof Row>[0]["column"];

// A record's Colour in its details: the colour's square and name, or, for a record that takes its
// team's, that colour's square and Team's colour, dimmed; with the menu that changes it, if given.
export function ColourRow({
  colour,
  inherited,
  menu,
}: {
  colour: PaletteColour | null;
  inherited?: PaletteColour | null | undefined;
  menu: ReactNode;
}) {
  return (
    <Row
      column={colourColumn}
      value={colour ?? ""}
      colour={colour ?? inherited ?? null}
      action={menu}
    >
      {colour !== null ? (
        <Text>{colourWords(colour)}</Text>
      ) : inherited !== undefined ? (
        <Text c="dimmed">{teamsColourWords}</Text>
      ) : undefined}
    </Row>
  );
}
