// SPDX-License-Identifier: Apache-2.0

// Fathom's menus: a click in a menu that is not on one of its items or fields, such as on its title,
// a draft's details, or empty space, closes it, as a click outside it does. AppMenu keeps its own
// open state for that; a menu that keeps its own uses closesOnBlankClick on its dropdown. A group
// of choices in a menu ticks the chosen one.

import {
  Menu,
  type MenuDropdownProps,
  type MenuProps,
  VisuallyHidden,
} from "@mantine/core";
import {
  createContext,
  type MouseEvent,
  type ReactNode,
  useContext,
  useId,
  useState,
} from "react";
import classes from "./app-menu.module.css";
import { Icon } from "./icons.tsx";

export const closesOnBlankClick =
  (close: () => void) => (event: MouseEvent<HTMLElement>) => {
    const target = event.target as HTMLElement;
    const item = "button, a, input, textarea, select, label, [role='menuitem']";
    if (!target.closest(item)) close();
  };

const CloseMenu = createContext<() => void>(() => undefined);

export function AppMenu({
  children,
  ...props
}: Omit<MenuProps, "opened" | "onChange"> & { children: ReactNode }) {
  const [opened, setOpened] = useState(false);
  return (
    <Menu {...props} opened={opened} onChange={setOpened}>
      <CloseMenu.Provider
        value={() => {
          setOpened(false);
        }}
      >
        {children}
      </CloseMenu.Provider>
    </Menu>
  );
}

function AppMenuDropdown(props: MenuDropdownProps) {
  const close = useContext(CloseMenu);
  return <Menu.Dropdown {...props} onClick={closesOnBlankClick(close)} />;
}

AppMenu.Target = Menu.Target;
AppMenu.Dropdown = AppMenuDropdown;

// The tick before a menu item, shown while it is chosen.
function Tick({ chosen }: { chosen: boolean }) {
  return (
    <span className={classes.choiceTick} data-chosen={chosen || undefined}>
      <Icon name="check" />
    </span>
  );
}

// A group of choices in a menu, under a label, the chosen one ticked.
export function MenuChoices<Value extends string>({
  label,
  choices,
  chosen,
  onChoose,
  divided = true,
}: {
  label: string;
  // Each choice's words, with any marks they carry, such as a draft's dot.
  choices: readonly { value: Value; label: ReactNode }[];
  chosen: Value | undefined;
  onChoose: (value: Value) => void;
  // False where the menu sets the group apart itself.
  divided?: boolean;
}) {
  const labelId = useId();
  return (
    <>
      {divided && <Menu.Divider />}
      <Menu.Label id={labelId}>{label}</Menu.Label>
      <div role="group" aria-labelledby={labelId}>
        {choices.map((choice) => (
          <Menu.Item
            key={choice.value}
            leftSection={<Tick chosen={chosen === choice.value} />}
            onClick={() => {
              onChoose(choice.value);
            }}
          >
            {choice.label}
            {chosen === choice.value && (
              <VisuallyHidden>, chosen</VisuallyHidden>
            )}
          </Menu.Item>
        ))}
      </div>
    </>
  );
}

// A choice in a menu that is on or off, ticked while on.
export function MenuToggle({
  label,
  on,
  onToggle,
}: {
  label: string;
  on: boolean;
  onToggle: (on: boolean) => void;
}) {
  return (
    <Menu.Item
      leftSection={<Tick chosen={on} />}
      onClick={() => {
        onToggle(!on);
      }}
    >
      {label}
      {on && <VisuallyHidden>, chosen</VisuallyHidden>}
    </Menu.Item>
  );
}
