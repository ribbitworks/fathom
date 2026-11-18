// SPDX-License-Identifier: Apache-2.0

// Fathom's menus: a click in a menu that is not on one of its items or fields, such as on its title,
// a draft's details, or empty space, closes it, as a click outside it does. AppMenu keeps its own
// open state for that; a menu that keeps its own uses closesOnBlankClick on its dropdown. A menu
// may open beside a point on the screen rather than a control, such as a right-click. A group of
// choices in a menu ticks the chosen one.

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

// A point on the screen, in the window's coordinates, that a menu opens beside.
export interface ScreenPoint {
  x: number;
  y: number;
}

export const noPoint: ScreenPoint = { x: 0, y: 0 };

export const clickedPoint = (event: MouseEvent): ScreenPoint => ({
  x: event.clientX,
  y: event.clientY,
});

// Below an element's start, where a menu opened from its keys or its button goes.
export const pointBelow = (element: Element): ScreenPoint => {
  const { left, bottom } = element.getBoundingClientRect();
  return { x: left, y: bottom };
};

// A menu beside a point on the screen, such as where a row or card was right-clicked. It stays
// drawn while closed, at the point it last opened at, since a menu notes where focus was only as
// it opens, to put it back when it closes. Mantine's Menu.ContextMenu would do the same, but it
// stops text being selected in whatever it opens from.
export function MenuAtPoint({
  at,
  opened,
  onClose,
  children,
}: {
  at: ScreenPoint;
  opened: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <Menu
      opened={opened}
      onClose={onClose}
      position="bottom-start"
      withinPortal
      hideDetached={false}
    >
      <Menu.Target>
        <span
          aria-hidden="true"
          className={classes.pointAnchor}
          style={{ left: at.x, top: at.y }}
        />
      </Menu.Target>
      <Menu.Dropdown onClick={closesOnBlankClick(onClose)}>
        {children}
      </Menu.Dropdown>
    </Menu>
  );
}

const CloseMenu = createContext<() => void>(() => undefined);

export function AppMenu({
  children,
  defaultOpened = false,
  ...props
}: Omit<MenuProps, "opened" | "onChange"> & { children: ReactNode }) {
  const [opened, setOpened] = useState(defaultOpened);
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

// The tick before a menu item, shown while it is chosen, keeping its room while not.
export function Tick({ chosen }: { chosen: boolean }) {
  return (
    <span className={classes.choiceTick} data-chosen={chosen || undefined}>
      <Icon name="check" />
    </span>
  );
}

// A group of choices in a menu, under a label where it shares the menu, the chosen one ticked.
export function MenuChoices<Value extends string>({
  label,
  choices,
  chosen,
  onChoose,
  divided = true,
  after,
}: {
  // Left out where the choices are the whole menu, which its button names.
  label?: string | undefined;
  // Each choice's words, with any marks they carry, such as a draft's dot.
  choices: readonly { value: Value; label: ReactNode }[];
  chosen: Value | undefined;
  onChoose: (value: Value) => void;
  // False where the menu sets the group apart itself.
  divided?: boolean;
  // Items of the group that can't be chosen, after the choices.
  after?: ReactNode;
}) {
  const labelId = useId();
  return (
    <>
      {divided && <Menu.Divider />}
      {label !== undefined && <Menu.Label id={labelId}>{label}</Menu.Label>}
      <div
        role={label === undefined ? undefined : "group"}
        aria-labelledby={label === undefined ? undefined : labelId}
      >
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
        {after}
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
