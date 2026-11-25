// SPDX-License-Identifier: Apache-2.0

// A new list's choices in a column's dialog, typed or pasted in the row a list's panel adds them in.

import type { Choice, ChoiceRequest } from "@fathom/shared";
import { Input, Menu } from "@mantine/core";
import { useState } from "react";
import { closesOnBlankClick } from "./app-menu.tsx";
import { onRowsKey } from "./choice-editing.ts";
import { useChoiceEntry } from "./choice-entry.ts";
import { ChoiceEntryRow } from "./choice-entry-row.tsx";
import { entryNameId } from "./choice-ids.ts";
import { ChoiceCells, choiceShape } from "./choice-row.tsx";
import { MenuTitle } from "./draft-details.tsx";
import { focusSoon } from "./focus.ts";
import { shortcutsFor } from "./menu-shortcuts.ts";
import classes from "./pages.module.css";
import { actionsFor, MoreButton } from "./row-controls.tsx";

// A choice typed for a new list: its name and description.
export type NewChoice = Pick<ChoiceRequest, "label" | "description">;

const labelId = "new-list-choices-label";

const rowIdOf = (index: number) => `new-choice-${String(index)}`;

const asChoice = (
  { label, description }: NewChoice,
  index: number,
): Choice => ({
  id: String(index),
  label,
  description,
  retired: false,
});

const shape = choiceShape([], false);

const shortcuts = shortcutsFor(navigator.userAgent);

export function NewListChoices({
  choices,
  needed,
  onChoices,
}: {
  choices: readonly NewChoice[];
  // Why the list can't be made yet, such as having no choices, shown under the empty row.
  needed: string | undefined;
  onChoices: (choices: NewChoice[]) => void;
}) {
  const typed = choices.map(asChoice);
  // The row focus is on, drawn selected as a list's panel draws its row.
  const [selected, setSelected] = useState<number>();
  // The row whose menu is open.
  const [menuFor, setMenuFor] = useState<number>();
  // Past the last row, focus goes to the empty row.
  const select = (target: Choice | undefined) => {
    focusSoon(target === undefined ? entryNameId : rowIdOf(Number(target.id)));
  };
  const remove = (choice: Choice) => {
    const index = Number(choice.id);
    onChoices(choices.filter((_, at) => at !== index));
    focusSoon(index < choices.length - 1 ? rowIdOf(index) : entryNameId);
  };
  const entry = useChoiceEntry({
    list: { choices: typed },
    meanings: [],
    weighed: false,
    add: (requests) => {
      onChoices([
        ...choices,
        ...requests.map(({ label, description }) => ({ label, description })),
      ]);
    },
    select,
    rowAbove: typed.at(-1),
    rowBelow: undefined,
  });

  return (
    <Input.Wrapper label="Choices" labelElement="div" id={labelId}>
      <div role="grid" aria-labelledby={labelId}>
        {typed.map((choice, index) => (
          <div
            key={choice.id}
            id={rowIdOf(index)}
            role="row"
            tabIndex={-1}
            className={[
              ...shape,
              selected === index ? classes.selectedRow : "",
            ].join(" ")}
            onFocus={() => {
              setSelected(index);
            }}
            onBlur={() => {
              setSelected(undefined);
            }}
            onKeyDown={(event) => {
              onRowsKey(event, typed, choice, { select, remove });
            }}
          >
            <ChoiceCells
              choice={choice}
              original={choice}
              movedBy={undefined}
              livePlace={undefined}
              meanings={[]}
              weighed={false}
              cellRole="gridcell"
            />
            <span role="gridcell">
              <Menu
                opened={menuFor === index}
                onChange={(opened) => {
                  setMenuFor(opened ? index : undefined);
                }}
                position="bottom-end"
                width={220}
              >
                <Menu.Target>
                  <MoreButton tabIndex={-1} label={actionsFor(choice.label)} />
                </Menu.Target>
                <Menu.Dropdown
                  onClick={closesOnBlankClick(() => {
                    setMenuFor(undefined);
                  })}
                >
                  <MenuTitle>{choice.label}</MenuTitle>
                  <Menu.Item
                    color="red"
                    rightSection={<kbd>{shortcuts.remove}</kbd>}
                    onClick={() => {
                      remove(choice);
                    }}
                  >
                    Remove
                  </Menu.Item>
                </Menu.Dropdown>
              </Menu>
            </span>
          </div>
        ))}
        <ChoiceEntryRow
          entry={entry}
          shape={shape}
          meanings={[]}
          weighed={false}
          problem={needed}
        />
      </div>
    </Input.Wrapper>
  );
}
