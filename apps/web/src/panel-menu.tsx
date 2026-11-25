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
  children,
}: {
  // What the button is read aloud as, such as Actions for the record.
  label: string;
  children: ReactNode;
}) {
  return (
    <AppMenu position="bottom-end" width={panelMenuWidth} hideDetached={false}>
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

// The items of a record's menu, from the table beside its panel, if it has any.
export const usePanelMenu = (recordId: string): ReactNode =>
  useContext(PanelMenusContext)?.(recordId);

export function PanelMenu({
  name,
  items,
}: {
  // The record's name, as the panel's title shows it.
  name: string;
  items: ReactNode;
}) {
  return <PanelMoreMenu label={actionsFor(name)}>{items}</PanelMoreMenu>;
}
