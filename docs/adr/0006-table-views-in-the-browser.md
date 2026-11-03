# Table Views in the Browser

- **ADR:** 0006
- **Status:** Accepted
- **Date:** 2026-10-31
- **Revised:** 2026-11-02, for the metrics' breakdown, kept in the view

## Context

The owner asked for searching, filtering, and sorting on every column of the People table, built so that every table added later, and every kind of column, gets them too. What a table shows this way is its view.

Two earlier decisions constrain it. [ADR 0005](0005-flexible-data-model.md) requires that no one can filter or sort by a value their tiers do not cover, since the order of results could reveal it. [ADR 0004](0004-ui-components.md) builds tables edited like a spreadsheet, such as People, on Mantine rather than on a grid or table library.

Each table's read already sends every row the user may see, leaving out every value their tiers do not cover.

## Decision

- **In the browser:** Tables are searched, filtered, and sorted, and their metrics counted, in the browser, over the rows and values the user has been sent. A value the user may not see is never sent, so it cannot be filtered, sorted, or counted by, and the server needs no query code for views.
- **Column kinds:** Each kind of column, such as text, date, or a choice from a list, says once how its values are searched, sorted, and filtered, and has one filter form and one description of its filter. A table only lists its columns and how to read each one, so a new table needs no other work, and a new kind adds those parts, which TypeScript requires it to.
- **The view in the address:** A table's search, filters, sort, and the columns its metrics break down by are kept in the page address, so they survive reloading, Back undoes them, and a view can be shared as a link. Filters, sorts, and breakdowns on columns the user does not have, such as in a link from someone who may see more, are ignored.
- **Saved views on the server:** A saved view is kept on the server in the same form as the address, and sent with the table's rows only to users who see every column it filters, sorts, or breaks down by; saving one on a column the user may not see is refused. Columns deleted since are ignored, as in the address. The address names the saved view the view started from, beside the view itself, so a link still shows what its sender saw.
- **Own code, not TanStack Table's:** [TanStack Table](https://tanstack.com/table), chosen for plain tables in ADR 0002, has its own filtering and sorting. Tables edited like a spreadsheet are not built on it, and the logic it would replace is small, so Fathom keeps its own. A plain table built on TanStack Table later can still take its filters and sort from the same view.

## Consequences

- **Fast and private:** Views change at once, without asking the server, and cannot reveal what a user may not see.
- **Every row is sent and drawn:** This suits tables the size the [Product Brief](../product/brief.md) expects. A much larger table would need its rows drawn a page at a time and the same view applied on the server, which is not built.
- **Searches are in the address:** What a user searches for, such as a name, stays in their browser's history and in any link they share, as the [Security Plan](../security/security-plan.md#threats-and-mitigations) sets out.
- **The address is part of the interface:** Changing how a view is written in the address can break saved links, so later changes must still read the old form.
