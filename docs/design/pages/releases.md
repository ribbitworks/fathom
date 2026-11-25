---
title: "Releases Page"
category: "Design"
audience: "Contributors"
applies_to: ["apps/web/src/**"]
dependencies: ["docs/design/visual-design.md", "docs/standards/ui-conventions.md", "docs/help/releases.md"]
last_updated: "2026-11-25"
---

# Fathom: Releases Page

The Releases page holds releases, their cycles and the schedules they belong to, drawn on a timeline over a table. It sits in the sidebar's Plan section, after Features.

[Releases help](../../help/releases.md) describes it for the people who use it. [Visual Design](../visual-design.md) covers what every page shares.

## Layout

- **Tabs:** **Releases**, **Cycles** and **Schedules**, as [The Page Heading](../../standards/ui-conventions/pages-and-panels.md#the-page-heading) sets out, kept in the address.
- **Tables:** Each tab is the shared table, read only, with its own saved views. Records change only in their side panel.
- **Timeline:** The [shared timeline](../../standards/ui-conventions/dates-timelines-and-boards.md#timelines) sits above the table and draws the schedules holding what it lists, in its order, apart from retired ones, so a search, filter or saved view narrows both.
- **Scrolling:** The timeline and table scroll on their own; the timeline grows to about half the window.

## Timeline

- **Time as the axis:** Each day is the same width, so schedules with different cycle lengths line up.
- **Lanes:** As [the release layer](../../standards/ui-conventions/dates-timelines-and-boards.md#timelines) sets out. On the Releases tab, beside live adds a Live lane.
- **Drafted retirements:** A schedule drafted to be retired or restored is drawn as it is live.
- **Names that don't fit:** Left out rather than cut short; hovering names each mark.
- **A schedule's end:** Its cycle lane stops there, with a short upright grey line.
- **Marks on each tab:**
  - Releases: each release is a span over its schedule's faint cycles, with its diamond.
  - Cycles: named blocks, the current one bold and past ones faded.
  - Schedules: unnamed blocks, each shaded apart from the one before, and the end named.
- **Opening a record:** Every mark opens its record, on its own kind's tab.
- **Zoom, axis and scrolling:** as [The shared timeline](../../standards/ui-conventions/dates-timelines-and-boards.md#timelines) sets out.
- **Today:** a red line marks today, in Fathom's time zone, as [Settings](administration.md#settings) sets out.

## Release Colours

- **Palette:** Ten theme colours: indigo, violet, grape, pink, red, orange, yellow, lime, green and teal. Yellow and red stay, since the Draft and Rejected marks always carry their word.
- **No colour:** Drawn in sea, the accent, which the palette leaves out.
- **Names:** Stay in the body's text colour, since some colours' text shades are hard to read on their tint.

## Releases Tab

- **Columns:** Release, Schedule, Ships on, Cycles, Features, Activities and Status. Features and Activities show only to those who see features; Activities names each release's activities on one line, read only, since an activity moves on [Activities](activities.md).
- **Rows:** One list at first, or grouped by schedule; shipped releases show only with **Show shipped**.
- **New release:** For those who change releases. It asks for the schedule first, and is greyed out while no schedule takes new releases.

## Release Details

- **Activities:** for those who see features, an Activities row after Features lists the release's activities one to a line, each opening on [Activities](activities.md), folded past the first five, or None, as a project's details do on [Projects](projects.md#record-details).
  - **Show on Activities:** under the list whenever the release has an activity, opening Activities filtered to the release.
  - **Add activity:** under the list for those who edit features, opening Activities filtered to the release with New activity open and the release set; not in the Live view, or on a release being removed.
- **Pencils:** Release, Ships on, Cycles and Colour, for those who change releases, as [Releases](../../product/roles.md#releases) in Roles sets out.
- **No pencils:** On a release in a retired schedule, drafted to be removed, or held by another's unpublished changes.
- **Note:** Each release has one built-in note, and schedules have none. Those who see releases read it, and those who change releases write it.
  - **Opening:** The note opens in a panel beside the details, from the Note row's open button, or from **Add note…** in the row's menu while empty.
  - **Kept open:** An open note is kept in the address as [Kept in the address](../../standards/ui-conventions/tables.md#the-address) sets out.

## Cycles Tab

- **Columns:** Cycle, Schedule, Starts, Ends, Current, Release and Features.
- **Rows:** One list at first, or grouped by schedule; past cycles and those after next quarter are hidden until chosen in **Views**.
- **No New button:** Cycles come only from their schedule.
- **Drafts:** A row is marked by the draft behind it, such as a change to its schedule's cycles.
  - **Two drafts:** Where that change and a draft of the cycle's own release both change a cycle that stays in that release, the menu names both drafts and credits the Release to the release's draft, whose dot, in its own state, marks the Release.
  - **Deciding both:** Approve and Reject decide both for a role that approves both, while the release's draft is waiting, published, held by nobody and needs no other Approver; otherwise they decide the change behind the row alone.
  - **Publish draft…, Discard and Resubmit:** Act on the change behind the row alone, from its row or its details.
- **Duration:** Its pencil works as on a schedule's [cycles](#schedule-cycles).

## Schedules Tab

- **New schedule:** At the heading's right, for those who change schedules, as [Releases](../../product/roles.md#releases) in Roles sets out.
- **Columns:** Schedule, Current cycle, Cycle starts, Cycle ends, Features this cycle, Next release, Release date, Cycle length and Schedule ends. Features this cycle shows only to those who see features.
- **Row menu:** Only **Retire** or **Restore** and draft actions; all else is in the panel.
- **Ended:** A schedule past its last day has an **Ended** box.
- **Retired:** Hidden until **Show retired**.
- **Draft marks:** A draft of a schedule's cycles or releases marks only the cells it changes, each in the state of the drafts that change it, whatever the schedule's own draft is.

## Schedule Details

- **Name pattern:** The pattern as typed, such as {YY}.{N}, then the current cycle's name, dimmed. Its pencil changes cycles from the current one.
- **Schedule ends:** Its pencil opens the [End dialog](#end-dialog).
- **No pencils:** Under Live only, or while retired; **Restore** is a retired schedule's only change.

### Schedule Cycles

- **Folding:** Starts at the current cycle and shows six, as [A long list](../../standards/ui-conventions/pages-and-panels.md#details-panels) sets out.
- **Duration's pencil:** **This cycle only…** or **This and later cycles…**, the second also changing names.

## End Dialog

- **Field:** One field, **Schedule ends**; left empty, the schedule keeps going.
- **Preview:** Once a day is typed, it counts the cycles in all and lists the last ones.
