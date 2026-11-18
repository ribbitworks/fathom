# Fathom: Org Chart Page

**Last updated:** 2026-11-18

The Org chart draws the organization as cards, by reporting teams or by feature teams. It sits in the sidebar's People section, after People.

[Org chart help](../../help/org-chart.md) describes it for the people who use it. [Visual Design](../visual-design.md) covers what every page shares.

## Layout

- **Heading:** A switch at the right chooses Reporting teams or Feature teams. The person found stays centred across it.
- **Controls on the left:** Find a person or team, the Draft menu, Teams, then the Views menu.
  - The Draft menu only chooses the view, for every reader: it has no filter and decides no drafts.
  - Teams shows only to those who change people, as [Roles](../../product/roles.md#what-each-role-can-do) sets out.
- **Controls on the right:** Show levels, zoom, and Fit to screen.
- **Views:** A saved view keeps the Draft choice, Reporting or Feature teams, the levels shown and the team shown alone, by Fathom's own ID rather than an Employee ID. It doesn't keep the day or the person found.
- **Date row:** As [People's date row](people.md#date-row) sets out.
- **The chart:** Fills a panel to the foot of the window, drawn top to bottom.

## The Chart

- **Finder:** Lists people, then teams; choosing a team finds its manager. A key such as #TEAM-2 finds only its record.
- **Shape:** Reports who manage nobody stack under the manager's left edge, with managers side by side to their right, so a large organization grows down.
- **Opening:** On the top two levels, fitted, but never enlarged past the cards' own size.

## Cards

- **A person's card:** The name in semibold, the position dimmed, and the name of any team they lead, so a team's name appears once.
  - The position shows only to readers who see the Positions list's class.
- **Team band:** A card on a coloured team is topped by an 8-pixel band of its colour, and its line takes the colour. The colour only repeats the lines, so it needs no words.
  - A colour reaches down through the teams below until one has its own. The top card of a team shown alone has none, since the team above isn't drawn.
- **A manager's card:** Has Show only this team, and Hide or Show and its count of reports.
- **A manager who has left:** A red Left box, only for readers who see Personal details. Others see the card unmarked, opening nothing, since People doesn't list them.
- **A person found:** Centred with a sea-blue ring, with hidden managers above opened.
- **Clicking a person:** Opens [Person details](people.md#person-details), keeping the card centred until the reader moves the chart.

## Teams

- **Colour and name:** For those who change people, a team's dot opens its colours and its name opens a field. A name is a draft.
- **Colour:** From the palette releases use, once the team's name is approved. It is how the chart is drawn, not a detail of anyone, so it is no draft: it saves at once for everyone, is undone from its notification, and isn't in the change history.
  - A renamed team keeps its colour; one whose name is removed loses it.
- **Teams panel:** Lists every manager's team, named ones first.

## Drafts on the Chart

The views follow [The three Draft views](../../standards/ui-conventions.md#drafts), with marks of the chart's own.

- **A move:** Drawn under the new manager, with a faded, dashed copy left under the current one.
- **A draft from another day:** The card adds a From line, such as From Oct 1, 2026.
- **Live only:** Read only, without naming or colouring teams.
- **Drafted names and positions:** Drawn over the live one, dimmed and marked Live. Positions only for readers who see the Positions list.
- **Who sees which drafts:** Manager changes show only to readers who see Personal details. A planned hire's drafts, its drafted manager included, show only to readers who see the hiring plan.

## Planned Hires

- **Who is drawn:** Every hire not yet filled, for every reader, and each filled one whose person hasn't started, for readers who don't see Personal details.
- **Card:** A placeholder with a grey dashed edge, after the people under its manager, named as its People row is, opening nothing.
- **Status:** A grey Planned, expected box with its month, never the day.
- **A hire whose manager hasn't started:** Drawn at the top until the manager starts, since the chart draws today.
- **A planned manager:** Heads their planned hires, a team that can be shown alone, but isn't in Teams until filled.

## Feature Teams

- **Where they're kept:** Here, rather than a page of their own or People, so team upkeep stays in one place.
- **Chart:** Each team hangs under its lead's card, or a card reading No feature lead. Someone on two teams has two cards.
- **Colours:** Chosen for each feature team from the same palette, and shown only on this chart, so they never meet reporting teams' colours.
- **Cards:** No Show only this team, and no naming or colouring of reporting teams.
- **Feature teams menu:** Replaces Teams, ending with New feature team.
- **Team panel:** Opens beside the chart, with Name, Colour, Feature lead and Members. Membership changes are drafts from the date shown.
  - On any date but today, Name and Colour can't change and the team can't be removed, since they take no date.
  - A lead is chosen from anyone; someone not yet a member joins in the same draft.
  - Readers without Personal details plan by month, from its first day, and aren't told when that day falls outside someone's employment. The Approver is told.
- **Who sees what:** Those who only see feature teams can't change anything. Those who see the chart but not people see teams as approved.

## Other Dates

The [date row](people.md#date-row) sets which dates each role reaches.

- **Who changes what:** Feature teams change on a later date for those who edit them, and on an earlier one only for those who may change Personal details. Others see an earlier date read only, as approved.
- **Managers on an earlier date:** A change replaces the person's current line, so it works only while that line was in force then ([issue #120](https://github.com/ribbitworks/fathom/issues/120)). Drafted managers are drawn as they would be then. The change history and Drafts give the earlier date as the line's new date.
- **Without Personal details:** Teams show neither members yet to start nor those who have left, and no disband date.
