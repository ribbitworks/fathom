# Fathom: Releases Page

**Last updated:** 2026-11-18

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

- **Columns:** Release, Schedule, Ships on, Cycles, Features and Status. Features shows only to those who see features.
- **Rows:** One list at first, or grouped by schedule; shipped releases show only with **Show shipped**.
- **New release:** For those who change releases. It asks for the schedule first, and is greyed out while no schedule takes new releases.

## Release Details

- **Pencils:** Release, Ships on, Cycles and Colour, for those who change releases, as [Releases](../../product/roles.md#releases) in Roles sets out.
- **No pencils:** On a release in a retired schedule, drafted to be removed, or held by another's unpublished changes.
- **Note:** Each release has one built-in note, and schedules have none. It opens in a panel beside the details, from the Note row's open button, or from **Add note…** in the row's menu while empty. Those who see releases read it, and those who change releases write it.

## Cycles Tab

- **Columns:** Cycle, Schedule, Starts, Ends, Current, Release and Features.
- **Rows:** One list at first, or grouped by schedule; past cycles and those after next quarter are hidden until chosen in **Views**.
- **No New button:** Cycles come only from their schedule.
- **Drafts:** A row is marked by the draft behind it, such as a change to its schedule's cycles.
  - **Two drafts:** Where that change and a draft of the cycle's own release both change a cycle that stays in that release, the menu names both drafts and credits the Release to the release's draft.
  - **Deciding both:** Approve and Reject decide both for a role that approves both, while the release's draft is waiting, published, held by nobody and needs no other approver; otherwise they decide the change behind the row alone.
  - **Discard and Resubmit:** Act on the change behind the row alone.
- **Duration:** Its pencil works as on a schedule's [cycles](#schedule-cycles).

## Schedules Tab

- **New schedule:** At the heading's right, for those who change schedules, as [Releases](../../product/roles.md#releases) in Roles sets out.
- **Columns:** Schedule, Current cycle, Cycle starts, Cycle ends, Features this cycle, Next release, Release date, Cycle length and Schedule ends. Features this cycle shows only to those who see features.
- **Row menu:** Only **Retire** or **Restore** and draft actions; all else is in the panel.
- **Ended:** A schedule past its last day has an **Ended** box.
- **Retired:** Hidden until **Show retired**.
- **Draft marks:** A draft of a schedule's cycles or releases marks only the cells it changes.

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
