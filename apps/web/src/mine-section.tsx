// SPDX-License-Identifier: Apache-2.0

// Mine, first in the sidebar: the signed-in person's own pages, each after the private ring, in
// their order, then New page.

import {
  type ListedPrivatePage,
  pageNeeds,
  type Permission,
  reaches,
} from "@fathom/shared";
import { UnstyledButton, VisuallyHidden } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Icon } from "./icons.tsx";
import classes from "./layout.module.css";
import { NewPageDialog } from "./new-page-dialog.tsx";
import { privatePagesQuery } from "./private-pages.ts";
import { RailTip, SidebarGroup } from "./sidebar-group.tsx";
import { PrivateRing } from "./status-mark.tsx";

export const mineLabel = "Mine";

const minePrefix = "/mine/";

// Whether a role's permissions show Mine.
export const showsMine = (permissions: readonly Permission[]): boolean =>
  reaches(pageNeeds.mine, permissions);

// Whether a role's permissions open the page at an address, as far as Mine decides: every page
// outside Mine, and Mine's pages where they show Mine.
export const opensUnderMine = (
  pathname: string,
  permissions: readonly Permission[],
): boolean => !pathname.startsWith(minePrefix) || showsMine(permissions);

// A page's first character, which stands for it in the rail, as other items' icons do.
const firstCharacter = (name: string): string =>
  Array.from(name).slice(0, 1).join("");

function PageItem({ page, rail }: { page: ListedPrivatePage; rail: boolean }) {
  return (
    <RailTip rail={rail} label={page.name}>
      <Link
        to="/mine/$pageId"
        params={{ pageId: page.id }}
        className={classes.link}
        activeOptions={{ includeSearch: false }}
      >
        {rail ? (
          // In the rail, the ring and the first character stand together for the page, centred as
          // an item's icon is.
          <span className={classes.mineRail} aria-hidden="true">
            <PrivateRing />
            {firstCharacter(page.name)}
          </span>
        ) : (
          <span className={classes.mineRing}>
            <PrivateRing />
          </span>
        )}
        {rail ? (
          <VisuallyHidden>{page.name}</VisuallyHidden>
        ) : (
          <span className={classes.minePageName}>{page.name}</span>
        )}
      </Link>
    </RailTip>
  );
}

export function MineSection({ rail }: { rail: boolean }) {
  const pages = useQuery(privatePagesQuery);
  const listed = pages.data ?? [];
  const [making, { open, close }] = useDisclosure(false);
  const label = "New page";
  return (
    <SidebarGroup label={mineLabel} rail={rail}>
      {listed.map((page) => (
        <PageItem key={page.id} page={page} rail={rail} />
      ))}
      <RailTip rail={rail} label={label}>
        <UnstyledButton className={classes.link} onClick={open}>
          <Icon name="plus" />
          {rail ? (
            <VisuallyHidden>{label}</VisuallyHidden>
          ) : (
            <span>{label}</span>
          )}
        </UnstyledButton>
      </RailTip>
      <NewPageDialog opened={making} pages={listed} onClose={close} />
    </SidebarGroup>
  );
}

// The top bar's place on a page under Mine: the section and the page's name, once read.
export function useMinePlace(
  pathname: string,
  permissions: readonly Permission[],
): { section: string; label: string } | undefined {
  const pageId =
    showsMine(permissions) && pathname.startsWith(minePrefix)
      ? pathname.slice(minePrefix.length)
      : undefined;
  const pages = useQuery({
    ...privatePagesQuery,
    enabled: pageId !== undefined,
  });
  if (pageId === undefined) return undefined;
  const page = pages.data?.find(({ id }) => id === pageId);
  return page === undefined
    ? undefined
    : { section: mineLabel, label: page.name };
}
