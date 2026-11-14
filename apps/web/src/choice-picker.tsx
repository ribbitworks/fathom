// SPDX-License-Identifier: Apache-2.0

// Picking choices in a cell of the People table, built on Mantine's Combobox. The cell keeps its own
// input, the same size as when it is not being edited, and the choices drop down below it. Typing
// narrows the choices, the arrow keys move through them, and Enter picks one; for a column that
// takes several, Enter adds or removes one and keeps the list open, with no choice highlighted, so
// Enter again finishes, as it does in other cells. Tab picks the highlighted choice when something
// has been typed, then moves on, Esc cancels, and leaving the cell keeps what was picked. Where
// several can be picked, a check marks each one picked. A choice with a description shows it under
// its name, and is found by it too. A value that takes one choice and need not have one offers its
// word for none first, set apart by a line, until something is typed; nothing is highlighted then
// until the arrow keys move, and Down goes first to the choice after none, so none is always in
// sight but never what Enter picks unasked. The list is at least as wide as the cell, and wider
// where a choice needs it, up to a limit past which a choice wraps.

import { matchesWords, searchWords } from "@fathom/shared";
import { CheckIcon, Combobox, Group, Text, useCombobox } from "@mantine/core";
import {
  type ComponentProps,
  type KeyboardEvent,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from "react";
import comboboxClasses from "./combobox.module.css";
import classes from "./pages.module.css";

// How editing a cell ended: Enter, Tab or Shift+Tab, or leaving the cell.
export type Finish = "enter" | "next" | "previous" | "leave";

export interface Option {
  value: string;
  label: string;
  description?: string | undefined;
}

const descriptionOpacity = 0.75;

// The widest the list grows to fit its choices, in pixels, unless its cell is wider.
const widestList = 320;

// Sizes the list to its cell, as the list's floating position is worked out.
export function fitList({
  rects,
  elements,
}: {
  rects: { reference: { width: number } };
  elements: { floating: HTMLElement };
}): void {
  const cell = rects.reference.width;
  Object.assign(elements.floating.style, {
    minWidth: `${String(cell)}px`,
    maxWidth: `${String(Math.max(cell, widestList))}px`,
  });
}

const listWidths: NonNullable<ComponentProps<typeof Combobox>["middlewares"]> =
  { size: { apply: fitList } };

// A choice's name, with its description, if any, on a smaller line under it, as every list of
// choices shows them.
export function OptionWords({
  option,
  name,
}: {
  option: Pick<Option, "label" | "description">;
  // The option's label as drawn, where it carries marks, such as a draft's dot.
  name?: ReactNode;
}) {
  const label = name ?? option.label;
  return option.description === undefined ? (
    <span>{label}</span>
  ) : (
    <div>
      <span>{label}</span>
      {/* The option's own colour, faded, so it reads on a highlighted option's fill too. */}
      <Text size="xs" c="inherit" opacity={descriptionOpacity}>
        {option.description}
      </Text>
    </div>
  );
}

// What the choice of none is known by among the options, which no choice's identifier is.
const noneValue = "";

export function ChoicePicker({
  id,
  label,
  options,
  none,
  multiple,
  initial,
  typed,
  invalid = false,
  describedBy,
  onDone,
  onCancel,
}: {
  id: string;
  label: string;
  // Whether the value was refused, and what names why, when it is shown.
  invalid?: boolean;
  describedBy?: string | undefined;
  options: Option[];
  // The word for no choice, such as None, for a value that takes one choice and need not have one.
  none?: string | undefined;
  multiple: boolean;
  initial: string[];
  // What was typed to start editing, which narrows the choices straight away.
  typed: string;
  onDone: (values: string[], finish: Finish) => void;
  onCancel: () => void;
}) {
  const store = useCombobox({ opened: true });
  const [search, setSearch] = useState(typed);
  const [picked, setPicked] = useState(initial);
  // Every word typed, found anywhere in a choice's name or description, as a search finds rows.
  const wanted = searchWords(search);
  const noneShown = none !== undefined && !multiple && wanted.length === 0;
  const shown = [
    ...(noneShown ? [{ value: noneValue, label: none }] : []),
    ...options.filter((option) =>
      matchesWords(`${option.label} ${option.description ?? ""}`, wanted),
    ),
  ];

  // Whether a choice was picked since anything was typed or the arrow keys moved, which leaves no
  // choice highlighted, so Enter finishes.
  const justPicked = useRef(false);

  // The first choice that matches is highlighted, so Enter or Tab picks it; with none offered,
  // nothing is.
  useEffect(() => {
    if (justPicked.current || noneShown) {
      store.resetSelectedOption();
    } else {
      store.selectFirstOption();
    }
  }, [search, store, noneShown]);

  const toggled = (value: string) =>
    picked.includes(value)
      ? picked.filter((other) => other !== value)
      : options
          .map((option) => option.value)
          .filter((other) => other === value || picked.includes(other));

  const pick = (value: string) => {
    if (!multiple) {
      onDone(value === noneValue ? [] : [value], "enter");
      return;
    }
    justPicked.current = true;
    store.resetSelectedOption();
    setPicked(toggled(value));
    setSearch("");
  };

  const highlighted = () => shown[store.getSelectedOptionIndex()]?.value;
  const chosen = (value: string) =>
    value === noneValue ? picked.length === 0 : picked.includes(value);

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      justPicked.current = false;
      // The combobox moves on after this, so Down from nothing passes over none to the first choice.
      if (
        event.key === "ArrowDown" &&
        noneShown &&
        store.getSelectedOptionIndex() === -1
      ) {
        store.selectOption(0);
      }
    } else if (event.key === "Escape") {
      event.preventDefault();
      onCancel();
    } else if (event.key === "Tab") {
      event.preventDefault();
      const value = search.trim() === "" ? undefined : highlighted();
      let values = picked;
      if (value !== undefined) values = multiple ? toggled(value) : [value];
      onDone(values, event.shiftKey ? "previous" : "next");
    } else if (event.key === "Enter" && highlighted() === undefined) {
      // Nothing to pick: Enter finishes, as it does in other cells.
      event.preventDefault();
      onDone(picked, "enter");
    }
  };

  const labels = options
    .filter((option) => picked.includes(option.value))
    .map((option) => option.label)
    .join(", ");

  return (
    // The cell sits in the table's scrolling area; the choices stay shown with it however it scrolls.
    <Combobox
      store={store}
      onOptionSubmit={pick}
      withinPortal
      hideDetached={false}
      width="max-content"
      middlewares={listWidths}
    >
      <Combobox.Target>
        <input
          id={id}
          className={[
            classes.recordEditor,
            invalid ? classes.recordEditorInvalid : "",
          ].join(" ")}
          aria-label={label}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          value={search}
          placeholder={labels}
          autoComplete="off"
          onChange={(event) => {
            justPicked.current = false;
            setSearch(event.currentTarget.value);
          }}
          onKeyDown={onKeyDown}
          onBlur={() => {
            onDone(picked, "leave");
          }}
        />
      </Combobox.Target>
      <Combobox.Dropdown>
        <Combobox.Options className={classes.choiceOptions}>
          {shown.map((option) => (
            <Combobox.Option
              key={option.value}
              value={option.value}
              className={
                option.value === noneValue ? comboboxClasses.none : undefined
              }
              active={chosen(option.value)}
              aria-selected={chosen(option.value)}
            >
              {multiple ? (
                <Group gap="xs" wrap="nowrap">
                  {/* Hidden, not left out, so every label starts in line. */}
                  <CheckIcon
                    size={12}
                    aria-hidden
                    visibility={chosen(option.value) ? "visible" : "hidden"}
                  />
                  <OptionWords option={option} />
                </Group>
              ) : (
                <OptionWords option={option} />
              )}
            </Combobox.Option>
          ))}
          {shown.length === 0 && <Combobox.Empty>No matches</Combobox.Empty>}
        </Combobox.Options>
      </Combobox.Dropdown>
    </Combobox>
  );
}
