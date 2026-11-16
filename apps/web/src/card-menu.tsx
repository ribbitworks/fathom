// SPDX-License-Identifier: Apache-2.0

// A card's menu, as a table row's is: from a right-click beside the pointer, from Shift+F10 or the
// menu key on the card, and, on a card with room for it, from the ⋯ shown at its corner while it is
// pointed at or has focus. The ⋯ sits beside the card rather than in it, since the card is itself a
// button, and isn't a stop for Tab, as the card's keys reach the menu.

import { Menu } from "@mantine/core";
import {
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
  useState,
} from "react";
import { closesOnBlankClick } from "./app-menu.tsx";
import classes from "./card-menu.module.css";
import { MenuTitle } from "./draft-details.tsx";
import pageClasses from "./pages.module.css";
import { actionsFor, MoreButton, opensMenu } from "./row-controls.tsx";

type Place = { x: number; y: number };

const below = (element: Element): Place => {
  const { left, bottom } = element.getBoundingClientRect();
  return { x: left, y: bottom };
};

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
  const [place, setPlace] = useState<Place | undefined>();
  const close = () => {
    setPlace(undefined);
  };
  return (
    <div className={classes.holder}>
      {children({
        onContextMenu: (event) => {
          event.preventDefault();
          setPlace({ x: event.clientX, y: event.clientY });
        },
        onMenuKey: (event) => {
          if (!opensMenu(event)) return false;
          event.preventDefault();
          setPlace(below(event.currentTarget));
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
              setPlace(below(event.currentTarget));
            }}
            aria-haspopup="menu"
            aria-expanded={place !== undefined}
          />
        </span>
      )}
      <Menu
        opened={place !== undefined}
        onClose={close}
        position="bottom-start"
        withinPortal
      >
        <Menu.Target>
          <span
            aria-hidden="true"
            className={pageClasses.pointerAnchor}
            style={{ left: place?.x, top: place?.y }}
          />
        </Menu.Target>
        <Menu.Dropdown onClick={closesOnBlankClick(close)}>
          <MenuTitle>{name}</MenuTitle>
          {items}
        </Menu.Dropdown>
      </Menu>
    </div>
  );
}
