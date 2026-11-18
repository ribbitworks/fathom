# Fathom: People Page

**Last updated:** 2026-11-17

People lists everyone, one row each, with planned hires beside them. It sits in the sidebar's People section, for roles that see people. Its table follows [Tables](../../standards/ui-conventions.md#tables); this document covers the date row, Person details and Group by.

[People help](../../help/people.md) describes it for the people who use it, and [Visual Design](../visual-design.md) covers what every page shares.

## Date Row

The date row sits above the table here and above the [Org chart](org-chart.md), only for a role that sees other dates.

- **Parts, in order:** a Date box, a back arrow, a timeline of 24 months either side of today, a forward arrow, and Today.
- **Range:** Without Confidential data, People and Reporting teams stop at today. Feature teams reach future dates with Personal details alone.
- **The line under the row:** On another date, it says whether changes take effect from that day. It keeps its place on today, as [Staying Put](../../standards/ui-conventions.md#staying-put) sets out.
- **Feature teams on future dates:** Draw people as they are today.
- **On another date:** Only managers can change on People and Reporting teams, and members and leads on Feature teams.
  - Where nothing can change, it is read only: the chart has no Draft menu and shows teams or reporting lines as approved.
  - People lists those employed then, with no New person, New column or row menu.
- **Planned hires:** Shown today and later. None show on earlier dates, since past plans are not kept.

## Person Details

Person details open beside People or the Org chart, as [Details Panels](../../standards/ui-conventions.md#details-panels) sets out.

- **Heading:** The name, then the position and Show on org chart or Show in People.
- **Sections, in order:**
  - Reporting: Manager, the date the line runs from, Reporting team, Reporting team name, Direct reports
  - Feature teams, for those who see them: Leads and Member of
  - Details: Name, ID, Position, State, Start, End, Manager?
  - Columns: every added column People shows the reader
- **Same as People:** The panel shows only what People shows the reader, and follows the Draft menu beside it.
- **Editing:** A value the reader may change on People has a pencil opening its cell's editor. Reporting team and Direct reports have none.
- **Another date:** The panel shows the person then, or says they aren't employed then. Only Manager has a pencil.
- **Notes:** A note opens in its own panel under the details, sharing the height.

### Planned Hires

- **Heading:** The name as its Name cell shows it, with a grey Planned, expected box, and no org chart link.
- **Pencils:** Only for those who may change planned hires.
- **State:** Offers only hiring states, since a hire becomes a person only by being filled.
- **Fill:** In the Name cell and under the heading, for those who may change both people and planned hires, unless the Draft menu shows live values alone. Its form offers New person and Existing person side by side, with the hire's Position read only.

### Adding a Person or Planned Hire

- **New person:** Opens a form with State first. A hiring state makes it a planned hire.
  - Changing the kind clears values the new kind lacks, and a grey line names them.
- **A planned hire's empty Name:** Shows in grey its position and ID, the name it will be shown by.

## Group By

- **Place:** After Metrics, with Then by as [Tables](../../standards/ui-conventions.md#tables) sets out.
- **Choices:** None, Manager, Feature teams, Position, State, and every list column.
- **Manager headings:** The manager's name, then their team's, such as Max Munk, Mobile team.

## Planned

- **The date row:** Drawn as the shared [strip](../../standards/ui-conventions.md#timelines).
