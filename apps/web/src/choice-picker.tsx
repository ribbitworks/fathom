// SPDX-License-Identifier: Apache-2.0

// Picking choices in a cell of the People table, built on Mantine's Combobox. The cell keeps its own
// input, the same size as when it is not being edited, and the choices drop down below it. Typing
// narrows the choices, the arrow keys move through them, and Enter picks one; for a column that
// takes several, Enter adds or removes one and keeps the list open, with no choice highlighted, so
// Enter again finishes, as it does in other cells. Tab picks the highlighted choice when something
// has been typed, then moves on, Esc cancels, and leaving the cell keeps what was picked. Where
// several can be picked, a check marks each one picked.

import { CheckIcon, Combobox, Group, useCombobox } from "@mantine/core";
import { type KeyboardEvent, useEffect, useRef, useState } from "react";
import classes from "./pages.module.css";

// How editing a cell ended: Enter, Tab or Shift+Tab, or leaving the cell.
export type Finish = "enter" | "next" | "previous" | "leave";

export interface Option {
  value: string;
  label: string;
}

export function ChoicePicker({
  id,
  label,
  options,
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
  const shown = options.filter((option) =>
    option.label.toLowerCase().includes(search.trim().toLowerCase()),
  );

  // Whether a choice was picked since anything was typed or the arrow keys moved, which leaves no
  // choice highlighted, so Enter finishes.
  const justPicked = useRef(false);

  // The first choice that matches is highlighted, so Enter or Tab picks it.
  useEffect(() => {
    if (justPicked.current) {
      store.resetSelectedOption();
    } else {
      store.selectFirstOption();
    }
  }, [search, store]);

  const toggled = (value: string) =>
    picked.includes(value)
      ? picked.filter((other) => other !== value)
      : options
          .map((option) => option.value)
          .filter((other) => other === value || picked.includes(other));

  const pick = (value: string) => {
    if (!multiple) {
      onDone([value], "enter");
      return;
    }
    justPicked.current = true;
    store.resetSelectedOption();
    setPicked(toggled(value));
    setSearch("");
  };

  const highlighted = () => shown[store.getSelectedOptionIndex()]?.value;

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      justPicked.current = false;
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
              active={picked.includes(option.value)}
              aria-selected={picked.includes(option.value)}
            >
              {multiple ? (
                <Group gap="xs" wrap="nowrap">
                  {/* Hidden, not left out, so every label starts in line. */}
                  <CheckIcon
                    size={12}
                    aria-hidden
                    visibility={
                      picked.includes(option.value) ? "visible" : "hidden"
                    }
                  />
                  <span>{option.label}</span>
                </Group>
              ) : (
                option.label
              )}
            </Combobox.Option>
          ))}
          {shown.length === 0 && <Combobox.Empty>No matches</Combobox.Empty>}
        </Combobox.Options>
      </Combobox.Dropdown>
    </Combobox>
  );
}
