# Fathom: Org Chart Page

**Last updated:** 2026-11-17

The Org chart draws the organization as cards, by reporting teams or by feature teams. It sits in the sidebar's People section, after People.

[Org chart help](../../help/org-chart.md) describes it for the people who use it. [Visual Design](../visual-design.md) covers what every page shares.

## Layout

- **Heading:** A switch at the right chooses Reporting teams or Feature teams. The person found stays centred across it.
- **Controls on the left:** Find a person or team, the Draft menu, Teams, then the Views menu.
  - The Draft menu only chooses the view, for every reader: it has no filter and decides no drafts.
  - Teams shows only to those who change people, as [Roles](../../product/roles.md#what-each-role-can-do) sets out.
- **Controls on the right:** Show levels, zoom, and Fit to screen.
- **Date row:** As [People's date row](people.md#date-row) sets out.
- **The chart:** Fills a panel to the foot of the window, drawn top to bottom.

## The Chart

- **Finder:** Lists people, then teams; choosing a team finds its manager. A key such as #TEAM-2 finds only its record.
- **Shape:** Reports who manage nobody stack under the manager's left edge, with managers side by side to their right, so a large organization grows down.
- **Opening:** On the top two levels, fitted, but never enlarged past the cards' own size.

## Cards

- **A person's card:** The name in semibold, the position dimmed, and the name of any team they lead.
- **Team band:** A card on a coloured team is topped by an 8-pixel band of its colour, and its line takes the colour. The colour only repeats the lines, so it needs no words.
- **A manager's card:** Has Show only this team, and Hide or Show and its count of reports.
- **A manager who has left:** A red Left box, only for readers who see Personal details. Others see the card unmarked, opening nothing, since People doesn't list them.
- **A person found:** Centred with a sea-blue ring, with hidden managers above opened.
- **Clicking a person:** Opens [Person details](people.md#person-details), keeping the card centred until the reader moves the chart.

## Teams

- **Colour and name:** For those who change people, a team's dot opens its colours and its name opens a field. A name is a draft; a colour saves at once.
- **Teams panel:** Lists every manager's team, named ones first.

## Drafts on the Chart

The views follow [The three Draft views](../../standards/ui-conventions.md#drafts), with marks of the chart's own.

- **A move:** Drawn under the new manager, with a faded, dashed copy left under the current one.
- **A draft from another day:** The card adds a From line, such as From Oct 1, 2026.
- **Live only:** Read only, without naming or colouring teams.

## Planned Hires

- **Card:** A placeholder with a grey dashed edge, after the people under its manager, opening nothing.
- **Status:** A grey Planned, expected box with its month.
- **A planned manager:** Heads their planned hires, but isn't in Teams until filled.

## Feature Teams

- **Chart:** Each team hangs under its lead's card, or a card reading No feature lead. Someone on two teams has two cards.
- **Cards:** No Show only this team, and no naming or colouring of reporting teams.
- **Feature teams menu:** Replaces Teams, ending with New feature team.
- **Team panel:** Opens beside the chart, with Name, Colour, Feature lead and Members. Membership changes are drafts from the date shown.
  - On any date but today, Name and Colour can't change and the team can't be removed, since they take no date.
- **Who sees what:** Those who only see feature teams can't change anything. Those who see the chart but not people see teams as approved.
