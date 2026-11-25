// SPDX-License-Identifier: Apache-2.0

// Picking one or several choices from a list that drops down under a cell or a panel's value, with
// a word for none first and a New option last where offered.

import { matchesWords, searchWords } from "@fathom/shared";
import { CheckIcon, Combobox, Group, Text, useCombobox } from "@mantine/core";
import { usePrevious } from "@mantine/hooks";
import {
  type ComponentProps,
  type KeyboardEvent,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from "react";
import { ColouredName } from "./colour-swatch.tsx";
import comboboxClasses from "./combobox.module.css";
import classes from "./pages.module.css";

// How editing a cell ended: Enter, Tab or Shift+Tab, or leaving the cell.
export type Finish = "enter" | "next" | "previous" | "leave";

export interface Option {
  value: string;
  label: string;
  description?: string | undefined;
  // Its colour, such as a team's, drawn as a square before its name.
  colour?: string | null | undefined;
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
  option: Pick<Option, "label" | "description" | "colour">;
  // The option's label as drawn, where it carries marks, such as a draft's dot.
  name?: ReactNode;
}) {
  const label = (
    <ColouredName colour={option.colour ?? null}>
      {name ?? option.label}
    </ColouredName>
  );
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

// What the New option is known by among the options, which no choice's identifier is either.
const addingValue = "\u0000new";

// A picker's New option: the kind of record it adds, such as customer, and what opens its form.
export interface Adding {
  one: string;
  onNew: (typed: string) => void;
}

const addingLabel = (one: string, typed: string): string =>
  typed === "" ? `New ${one}` : `New ${one} “${typed}”`;

// An option's words after its tick, in a picker where several can be picked. The tick is hidden, not
// left out, on an option not picked, so every option's words start in line.
function Ticked({
  ticks,
  ticked,
  children,
}: {
  ticks: boolean;
  ticked: boolean;
  children: ReactNode;
}) {
  return ticks ? (
    <Group gap="xs" wrap="nowrap">
      <CheckIcon
        size={12}
        aria-hidden
        visibility={ticked ? "visible" : "hidden"}
        className={comboboxClasses.tick}
      />
      {children}
    </Group>
  ) : (
    children
  );
}

// Keys typed fast reach a cell until its editor has focus, adding to what was typed to open it; the
// editor takes them while nothing has been typed into it since.
export function useTypedBeforeFocus(
  typed: string,
  shown: string,
  show: (text: string) => void,
) {
  const before = usePrevious(typed);
  if (before !== undefined && typed !== before && shown === before) show(typed);
}

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
  adding,
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
  // For a picker that may add the record it names: its New option.
  adding?: Adding | undefined;
  onDone: (values: string[], finish: Finish) => void;
  onCancel: () => void;
}) {
  const store = useCombobox({ opened: true });
  const [search, setSearch] = useState(typed);
  useTypedBeforeFocus(typed, search, setSearch);
  const [picked, setPicked] = useState(initial);
  // Every word typed, found anywhere in a choice's name or description, as a search finds rows.
  const wanted = searchWords(search);
  const noneShown = none !== undefined && !multiple && wanted.length === 0;
  const matching = options.filter((option) =>
    matchesWords(`${option.label} ${option.description ?? ""}`, wanted),
  );
  const shown = [
    ...(noneShown ? [{ value: noneValue, label: none }] : []),
    ...matching,
    ...(adding === undefined
      ? []
      : [
          { value: addingValue, label: addingLabel(adding.one, search.trim()) },
        ]),
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
    if (value === addingValue) {
      // What was picked so far is kept, as leaving the cell keeps it, before the form opens. Only a
      // picker that may add offers New.
      onDone(picked, "leave");
      (adding as Adding).onNew(search.trim());
      return;
    }
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
      // Tab picks a choice, never New, which opens a form.
      const value = search.trim() === "" ? undefined : highlighted();
      let values = picked;
      if (value !== undefined && value !== addingValue) {
        values = multiple ? toggled(value) : [value];
      }
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
          {shown
            .filter(({ value }) => value !== addingValue)
            .map((option) => (
              <Combobox.Option
                key={option.value}
                value={option.value}
                className={
                  option.value === noneValue ? comboboxClasses.none : undefined
                }
                active={chosen(option.value)}
                aria-selected={chosen(option.value)}
              >
                <Ticked ticks={multiple} ticked={chosen(option.value)}>
                  <OptionWords option={option} />
                </Ticked>
              </Combobox.Option>
            ))}
          {matching.length === 0 && !noneShown && adding === undefined && (
            <Combobox.Empty>No matches</Combobox.Empty>
          )}
          {adding !== undefined && (
            <Combobox.Option
              value={addingValue}
              className={comboboxClasses.adding}
            >
              <Ticked ticks={multiple} ticked={false}>
                <span className={comboboxClasses.addingWords}>
                  {addingLabel(adding.one, search.trim())}
                </span>
              </Ticked>
            </Combobox.Option>
          )}
        </Combobox.Options>
      </Combobox.Dropdown>
    </Combobox>
  );
}
