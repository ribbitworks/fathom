---
title: "People Page"
category: "Design"
audience: "Contributors"
applies_to: ["apps/web/src/**"]
dependencies: ["docs/design/visual-design.md", "docs/standards/ui-conventions.md", "docs/help/people.md"]
last_updated: "2026-11-27"
---

# Fathom: People Page

People lists everyone, one row each, with planned hires beside them. It sits in the sidebar's People section, for roles that see people. Its table follows [Tables](../../standards/ui-conventions/tables.md#tables); this document covers its columns, the date row, Person details and Group by.

[People help](../../help/people.md) describes it for the people who use it, and [Visual Design](../visual-design.md) covers what every page shares.

## Columns

- **Kinds of row:** The State column tells people and planned hires apart, so there is no Kind column. Metrics name each kind, such as 150 people and 6 planned hires.
- **Manager:** Picked from people and planned hires flagged as managers, live, and not gone by today.
  - **Each described:** Under their name, by their position, then the name of the team they're on, or whom they report to where it has none, such as Engineering Manager, reports to Mateo Quintero Reynoso, so two with the same name are told apart.
  - **A pasted name:** One that more than one of them has is refused rather than given to the first.
  - **Left:** A manager whose end date has passed shows a Left mark, only to readers who see Personal details.
- **Manager?:** A checkbox straight after Manager, ticked for those flagged as managers.
- **Manager assigned:** The Personal date the line runs from; changing it moves the line. The label can't be read as the person being a manager since then.
- **Team:** Follows from Manager and isn't edited, shown by the team's name, or its manager's while it has none.
- **Team name:** The person's own team's name, edited on the manager's row.
- **Feature teams:** After Team, each person's feature teams on the date shown, by their live names, each after its colour's square, read only, since teams change on the [Org chart](org-chart.md#feature-teams). Sent only to those who see feature teams.
- **Expected:** Read only: the month a planned hire is expected, empty for people.

## Date Row

The date row sits above the table here and above the [Org chart](org-chart.md), only for a role that sees other dates.

- **Parts, in order:** a Date box, a back arrow, a timeline of 24 months either side of today, a forward arrow, and Today.
- **Range:** Without Confidential data, People and Reporting teams stop at today. Feature teams reach future dates with Personal details alone.
- **Feature teams on future dates:** Draw people as they are today.
- **On another date:** On an earlier date, only managers can change on People and Reporting teams, for those who may change Past managers; a later date is read only there. On Feature teams, members and leads change on a later date, or on an earlier one for those who may change Feature team dates.
  - Where nothing can change, it is read only: the chart has no Draft menu and shows teams or reporting lines as approved.
  - People lists those employed then, with no New person, New column or row menu.
- **Planned hires:** Shown today and later. None show on earlier dates, since past plans are not kept.
  - One with no target date reads Planned, no date, with Expected empty, on every date, since the date shown's month would read as one someone set.
- **What changes:** The date changes the rows and dated values, such as manager, team and feature teams, never the columns shown.
- **The count:** After the bar's buttons, it names the day it counts, such as 137 people and 10 planned hires on Nov 20, 2026, as a [month grid's](capacity.md) count names its month.
- **Back:** Choosing another date adds to the browser's Back, here and on the Org chart.
- **Place:** Under People's search row, as the Org chart's is under its finder.

## Person Details

Person details open beside People or the Org chart, as [Details Panels](../../standards/ui-conventions/pages-and-panels.md#details-panels) sets out.

- **Heading:** The name, then the position and Show on org chart or Show in People.
- **Sections, in order:**
  - Reporting: Manager, the date the line runs from, Reporting team, Reporting team name, Direct reports, including those yet to start, with Starts and the day
  - Feature teams, for those who see them: Leads and Member of, each team with its lead
  - Details: Name, ID, Position, State, Start, End, Expected for planned hires, Manager?
  - Columns: every added column People shows the reader
  - Timeline, for a person, not a planned hire, for those who see start and end dates: the next day of changes after the day shown and the latest on or before it, then Show timeline
- **Same as People:** The panel shows only what People shows the reader, and follows the Draft menu beside it. Personal details shown are recorded in the access history.
- **Who gets it:** Readers who see the chart but not people have no panel.
- **Following:** Choosing a manager or a report shows them in the panel.
- **Editing:** A value the reader may change on People has a pencil opening its cell's editor. Reporting team and Direct reports have none.
- **Another date:** The panel shows the person then, or says they aren't employed then. Only Manager has a pencil.
- **Timeline:** Show timeline opens the person's timeline in its own panel under the details, as a note's does, kept in the address (`timeline`). The details then take only the height they need, and the timeline the rest. On a narrow screen it covers the details, opened from them or from an address naming both.
  - **Its days:** newest first, one row a day: planned days in grey above Today's line, drawn across as a timeline draws Today, then the past; six on each side, the rest under Later dates and Earlier dates.
  - **Its changes:** Filled and the hire, Start, Manager, Feature teams and Leads added or removed, and End, one to a line in that order, in one form: the field, the new value, then changed from the old; with how many others the same new manager came to that day.
  - **Its dates:** each moves the page to that day, for readers who see other days, and a later day only for those who see later days; the day shown is marked, or, with no changes that day, drawn as a line where it falls, in teal.
  - **Who sees what:** readers who see start and end dates; managers until today with Past managers' class and later ones with Future reorganizations', feature teams with their dates' class, and the hire filled with the hiring plan. Reading it is recorded in the access history, and the hiring plan's view too when it names a hire.
  - **Links:** a manager links to their details when People lists them on the day shown; a team to the Org chart's feature teams for readers who see feature teams; a filled hire to its key's link.
  - **Following a link:** opening another person's details closes the timeline; moving to another day keeps it open.
  - **A day someone isn't employed:** the details say so, then end with the Timeline section employed people's details have, its next and latest days and Show timeline; an open timeline stays open, still listing every day of their changes.
- **Notes:** A note opens in its own panel under the details, sharing the height, kept in the address as [Kept in the address](../../standards/ui-conventions/tables.md#the-address) sets out, and can be maximized, as [Maximizing](../../standards/ui-conventions/pages-and-panels.md#panels-and-focus) sets out.

### Planned Hires

- **Heading:** The name as its Name cell shows it, with a grey Planned, expected box, and no org chart link.
- **Pencils:** Only for those who may change planned hires.
- **State:** Offers only hiring states, since a hire becomes a person only by being filled.
- **Fill:** In the Name cell and under the heading, for those who may change both people and planned hires, only on today, unless the Draft menu shows live values alone. Its form offers New person and Existing person side by side, with the hire's Position read only.
  - Filling happens in this panel, not a dialog, and once filled the panel shows the person.
  - The manager starts as the hire's and can be changed. A new person's start date starts as the hire's target date. Someone already in Fathom moves from today, or from their start date if they haven't started.
  - What a fill does is in the [Domain Model](../domain-model.md#planned-hires).

### Adding a Person or Planned Hire

- **New person:** Opens a form with State first. A hiring state makes it a planned hire. It offers only the kinds the reader may add, as the table's empty row does.
  - Changing the kind clears values the new kind lacks, and a grey line names them.
- **A planned hire's empty Name:** Shows in grey its position and ID, the name it will be shown by.

## Group By

- **Place:** After Metrics, with Then by as [Tables](../../standards/ui-conventions/tables.md#tables) sets out.
- **Choices:** None, Manager, Feature teams, Position, State, and every list column, those holding several choices included. Team isn't offered, since it follows from Manager.
- **Feature teams:** Someone on two teams shows under each; planned hires show under No feature team.
- **Metrics by Manager:** Count each manager's direct reports among the rows shown.
- **Manager headings:** The manager's name, then their team's, such as Max Munk, Mobile team.

## Planned

- **The date row:** Drawn as the shared [strip](../../standards/ui-conventions/dates-timelines-and-boards.md#timelines).
