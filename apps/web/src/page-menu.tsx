// SPDX-License-Identifier: Apache-2.0

// A private page's ⋯, after the Export icon at its heading's right: Rename page…, Copy link,
// Copy key, then Remove page… in red.

import type { PrivatePage } from "@fathom/shared";
import { Menu } from "@mantine/core";
import { focusFoundSoon } from "./focus.ts";
import { useMineChanges } from "./mine-changes.tsx";
import { PanelMoreMenu } from "./panel-menu.tsx";
import { CopyItems } from "./record-key.tsx";
import { actionsFor } from "./row-controls.tsx";

const pageMenuId = "page-menu";

export function PageMenu({
  page,
}: {
  page: Pick<PrivatePage, "id" | "name" | "key">;
}) {
  const changes = useMineChanges();
  // The menu's item is gone once a dialog opens over it, so focus goes back to the ⋯, found by
  // where it is, since renaming the page changes its name.
  const back = () => {
    focusFoundSoon(
      () =>
        document.querySelector<HTMLElement>(`#${pageMenuId} button`) ??
        undefined,
    );
  };
  return (
    <span id={pageMenuId}>
      <PanelMoreMenu label={actionsFor(page.name)}>
        <Menu.Item
          onClick={() => {
            changes.rename(page, back);
          }}
        >
          Rename page…
        </Menu.Item>
        {/* A page made before keys were has none to copy. */}
        {page.key !== null && (
          <CopyItems record={{ kind: "page", code: page.key }} />
        )}
        <Menu.Divider />
        <Menu.Item
          color="red"
          onClick={() => {
            changes.remove(page, back);
          }}
        >
          Remove page…
        </Menu.Item>
      </PanelMoreMenu>
    </span>
  );
}
