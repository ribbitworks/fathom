// SPDX-License-Identifier: Apache-2.0

// Fathom's menus: a click in a menu that is not on one of its items or fields, such as on its title,
// a draft's details, or empty space, closes it, as a click outside it does. AppMenu keeps its own
// open state for that; a menu that keeps its own uses closesOnBlankClick on its dropdown.

import { Menu, type MenuDropdownProps, type MenuProps } from "@mantine/core";
import {
  createContext,
  type MouseEvent,
  type ReactNode,
  useContext,
  useState,
} from "react";

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
