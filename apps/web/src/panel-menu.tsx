// SPDX-License-Identifier: Apache-2.0

// The ⋯ menus in side panels, for a record or its drafts, and the menu a record's details panel
// takes from the table beside it.

import { createContext, type ReactNode, useContext } from "react";
import { AppMenu } from "./app-menu.tsx";
import { MoreButton, actionsFor } from "./row-controls.tsx";

const panelMenuWidth = 260;

// A ⋯ in a side panel and its menu, below the button's end.
export function PanelMoreMenu({
  label,
  id,
  children,
}: {
  // What the button is read aloud as, such as Actions for the record.
  label: string;
  // The menu's, which its button takes, for focus to go back to it once a dialog it opened closes.
  id?: string;
  children: ReactNode;
}) {
  return (
    <AppMenu
      position="bottom-end"
      width={panelMenuWidth}
      hideDetached={false}
      {...(id === undefined ? {} : { id })}
    >
      <AppMenu.Target>
        <MoreButton label={label} />
      </AppMenu.Target>
      <AppMenu.Dropdown>{children}</AppMenu.Dropdown>
    </AppMenu>
  );
}

// The items of a record's menu, by the record's identifier, or none where it offers nothing.
export type PanelMenus = (recordId: string) => ReactNode;

export const PanelMenusContext = createContext<PanelMenus | undefined>(
  undefined,
);

// The ⋯ at the top of a record's panel, holding its menu from the table beside the panel, or none
// where it offers nothing, given the record's name as the panel's title shows it.
export function usePanelMenu(recordId: string, name: string): ReactNode {
  const items = useContext(PanelMenusContext)?.(recordId);
  return items === undefined ? undefined : (
    <PanelMoreMenu label={actionsFor(name)}>{items}</PanelMoreMenu>
  );
}
