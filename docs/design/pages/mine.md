---
title: "Mine: Private Pages"
category: "Design"
audience: "Contributors"
applies_to: ["apps/web/src/mine-section.tsx", "apps/web/src/new-page-dialog.tsx", "apps/web/src/private-page.tsx", "apps/web/src/private-table.ts", "apps/web/src/private-row-actions.ts", "apps/web/src/private-pages.ts"]
dependencies: ["docs/design/visual-design.md", "docs/standards/ui-conventions.md", "docs/design/domain-model.md", "docs/help/private-pages.md"]
last_updated: "2026-11-27"
---

# Fathom: Mine and Private Pages

Mine holds a person's own pages, each a table of free rows typed in like a spreadsheet, which nobody else reads. It is the sidebar's section after People, shown to a role with Make private pages.

[Private pages help](../../help/private-pages.md) describes it for the people who use it. [Visual Design](../visual-design.md) covers what every page shares, and [Domain Model](../domain-model.md#private-pages) what a page, its rows and their keys are.

## The Sidebar

- **Mine:** after People and before Administration, or where they would be for a role that sees neither, listing the maker's pages in their order, then New page. Its pages are read from the server, so it is the one section not in `sections` in `apps/web/src/navigation.ts`; `MineSection` in `apps/web/src/mine-section.tsx` draws it with `SidebarGroup` in `apps/web/src/sidebar-group.tsx`, as every section is drawn.
- **Each page:** its name after the private ring, as [The private ring](../../standards/ui-conventions/drafts-and-values.md#access) sets out, cut short with an ellipsis where long. In the collapsed rail, its first character after the ring, with its name in the rail's tip, as other items show their icons.
- **New page:** last, with a + icon, opening the New page dialog. It has no "…", as every button starting with New.
- **The top bar:** Mine / the page's name, cut short where long, with its whole name in a tip, so the account's menu stays in reach.

## New Page

One dialog, titled New page, in two steps: the name, then the columns.

- **Name:** refused under the field as Name needed, Too long, or Another page has that name, among the maker's own pages, ignoring letter case; the server refuses a name taken since in the same words, and the dialog returns to this step with focus on it.
- **Columns:** one row each, with Name, Type and, for Choice from a list, List, typed in as a table is: Tab moves across, and Enter goes to the next row's name. The empty last row is where a new column is typed; typing in it adds another empty row under it. Each row but the first and the empty one has a × at its end.
  - **The first row:** Name, Text, naming each row of the page. Its name and type can change, but it stays first and has no ×. Its types are only those that can name a row: Text, Number and Date.
  - **Types:** every column type, in the order the column dialog offers them.
  - **Lists:** Choice from a list offers the lists on Lists as they are live, with their drafts undone, leaving out a retired list and one only drafted to be added, since a page saves at once and its own lists wait for #215.
  - **Class:** every new column is General.
  - **Refusals:** under its field, with focus on the first: Name needed, Another column has that name for the later of two, and List needed.
- **Back:** returns to the name, keeping the columns.
- **Add page:** makes the page and its columns at once, with no draft, opens it, and puts it last under Mine.
- **Leaving:** Cancel, ×, or Esc with anything typed asks Discard the new page?, with Keep adding; with nothing typed it closes at once.

## The Page

- **Address:** `/mine/<page>`, keeping the table's view as every table's address does. An address naming no page the reader may read shows There is no page at this address, as a key's link to it reads Nothing found.
- **Heading:** the private ring, then the page's name, with the Export icon at the right. The ring's tip is read aloud before the name.
- **The table:** the shared table without drafts, so no Draft menu, dots, tints or Live rows. Its toolbar has Search, Metrics, Group by, by each Choice from a list column, and Views, with filters and sorts in each column's menu.
  - **Saving:** each value saves at once, as the row's change; Cmd+Z or Ctrl+Z undoes the latest.
  - **New rows:** typed in the empty row, as on every table; a row needs its first column's value. With no drafts, a row typed in is added on Enter, on Tab from its last column, or when focus leaves the row, so nothing typed is lost. Until then its slot shows the hollow dot in the private violet, saying New, not saved yet.
  - **An empty page:** the table's header and its empty row alone, with no space under them. Rows pasted together are saved one after another, each as its own change, so Undo takes back the last. They are kept all or none: if one is refused, those already saved are removed again.
  - **Removing a row:** Remove row in the row's menu acts at once, with a notification saying Removed and the row's name, with Undo.
  - **Keys:** each row has a random key, such as #ROW-4X9T, in a Key column hidden at first; its menu offers Copy link, whose link opens the page for its maker alone.
  - **Export:** what the table shows, with no Draft or Change columns and no drafts in the file's name, as every table without drafts exports.

## Decisions

- **No drafts anywhere on a page,** since its data is one person's own and reaches nobody else.
- **The ring by the page's name only,** never on each value, since everything on the page is private.
- **A new row saved on leaving it,** since a page has no drafts to keep it in, and asking would interrupt typing.
- **Built on `RecordGrid`** with `liveTableParts` from `apps/web/src/live-table.ts`, which Accounts shares, rather than a table of its own.
