// SPDX-License-Identifier: Apache-2.0

// A card's menu, as a table row's is: from a right-click beside the pointer, from Shift+F10 or the
// menu key on the card, and, on a card with room for it, from the ⋯ shown at its corner while it is
// pointed at or has focus. The ⋯ sits beside the card rather than in it, since the card is itself a
// button, and isn't a stop for Tab, as the card's keys reach the menu.

import {
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
  useState,
} from "react";
import {
  clickedPoint,
  MenuAtPoint,
  noPoint,
  pointBelow,
  type ScreenPoint,
} from "./app-menu.tsx";
import classes from "./card-menu.module.css";
import { MenuTitle } from "./draft-details.tsx";
import { actionsFor, MoreButton, opensMenu } from "./row-controls.tsx";

export interface CardMenuHandlers {
  onContextMenu: (event: MouseEvent<HTMLElement>) => void;
  // Opens the menu from the card's keys, telling whether it did, so the card's own keys can go on.
  onMenuKey: (event: KeyboardEvent<HTMLElement>) => boolean;
}

export function CardMenu({
  name,
  items,
  withMore = true,
  children,
}: {
  // The card's record, as the ⋯ names it.
  name: string;
  items: ReactNode;
  // Whether the card has room for the ⋯, which a small card, such as the Org chart's, leaves out.
  withMore?: boolean;
  children: (handlers: CardMenuHandlers) => ReactNode;
}) {
  const [menu, setMenu] = useState({ at: noPoint, opened: false });
  const openAt = (at: ScreenPoint) => {
    setMenu({ at, opened: true });
  };
  return (
    <div className={classes.holder}>
      {children({
        onContextMenu: (event) => {
          event.preventDefault();
          openAt(clickedPoint(event));
        },
        onMenuKey: (event) => {
          if (!opensMenu(event)) return false;
          event.preventDefault();
          openAt(pointBelow(event.currentTarget));
          return true;
        },
      })}
      {withMore && (
        <span className={classes.more}>
          <MoreButton
            label={actionsFor(name)}
            size="sm"
            tabIndex={-1}
            onClick={(event) => {
              event.stopPropagation();
              openAt(pointBelow(event.currentTarget));
            }}
            aria-haspopup="menu"
            aria-expanded={menu.opened}
          />
        </span>
      )}
      <MenuAtPoint
        at={menu.at}
        opened={menu.opened}
        onClose={() => {
          setMenu((shown) => ({ ...shown, opened: false }));
        }}
      >
        <MenuTitle>{name}</MenuTitle>
        {items}
      </MenuAtPoint>
    </div>
  );
}
