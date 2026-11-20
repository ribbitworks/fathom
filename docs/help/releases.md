# Releases

**Releases** holds your releases, their cycles and the schedules they belong to. Here you make releases, set up each schedule's cycles, and see them all on one timeline.

## What to Know First

- **Schedule:** a repeating set of cycles, such as one product line's, with releases where it ships them. **Platform** is one example.
- **Cycle:** a planning period, such as a quarter. A schedule makes its cycles from how long each lasts, such as 3 months, and names them by its **Name pattern**, such as `{YY}.{N}` for 27.1, 27.2 and on. Fathom lays cycles out two years ahead of today, so you can plan that far.
- **Release:** what ships the features that target its cycles. It covers one cycle, or several in a row, of one schedule.
- **Ships on:** the day a release ships. It's the end of its last cycle, unless another day was set.
- **Schedule ends:** a schedule's last day, or **No end date** if it keeps going. No cycle starts after that day, and the cycle holding it ends on it. Once that day has passed, the schedule shows **Ended** after its name. It stays on the page until you retire it.
- **Tabs:** the page has three tabs beside its heading: **Releases**, where it opens, **Cycles** and **Schedules**. Each tab has its own table, with a timeline of what the table lists above it. A search, a filter or a saved view narrows both.
- **Panel:** a record's details open in a panel beside the timeline and the table. To close it, select the **×** at its top right, or press Esc.
- **Drafts:** every change you make here is a draft. Nobody else sees it until you select **Publish** in the top bar. A dot before a name marks its draft.
- **Who changes what:** if your role can change **Features**, you make and change releases, and someone whose role approves features approves them. If your role can change **Plan** or **Configuration**, you add schedules and change their cycles, and someone whose role approves the plan or configuration approves them. Others see the page without these buttons and pencils.

Above each timeline are the search field, the **Draft** menu, the **Metrics** button, and the **Group by** and **Views** menus.

See [Drafts](drafts.md) for more.

## The Three Tabs

- **Releases** lists each release with its schedule, the day it ships, its cycles, the features that target them, and **Shipped** once its day has passed. Shipped releases are left out until you choose **Show shipped** in the **Views** menu. The timeline shows each release across its cycles.
- **Cycles** lists each cycle with its schedule, its first and last days, the release that covers it, and its features. The cycle holding today reads **Current**. Past cycles, and cycles that start after next quarter, are left out until you choose **Show past cycles** or **Show later cycles** in the **Views** menu. The timeline names each cycle, with the current one in bold.
- **Schedules** lists each schedule with its current cycle and that cycle's first and last days, the features targeting it, the next release to ship and its day, how long its cycles last now, and its **Schedule ends** day. The timeline shows each schedule's cycles, and where it ends.

Each tab starts as one list. To group **Releases** or **Cycles** by schedule, choose **Group by**, then **Schedule**. To group **Schedules** by **Current**, **Ended** and **Retired**, choose **Group by**, then **Status**. To turn the headings round, choose the second order after the groupings, such as **Reverse list order**.

## Main Tasks

### Find and Open a Record

1. Select the tab that lists it: **Releases**, **Cycles** or **Schedules**.
1. Type part of its name in the search field at the top of the page.
1. Point at its row.
1. Select the details button: the small box at the right of its name.

Cmd+F on a Mac, or Ctrl+F elsewhere, takes you to the search field. Instead of the details button, you can also right-click the row and select **Show details**, or select the record on the timeline. To clear the search, press Esc in the search field.

You're done when the record's panel is open, headed with its name.

### Follow a Record to Another

A record's panel names the records it's tied to, each as a link that opens it on its own tab:

- A release's panel links its **Schedule** and each of its **Cycles**.
- A cycle's panel links its **Release** and its **Schedule**.
- A schedule's panel links its **Current cycle** and **Next release**. Under its cycles, **Show its releases** and **Show its cycles** open those tabs, showing only that schedule's.

The **Features** row lists the features one to a line, each a link to it on **Features**. After the first five, select **Show all** under them to see the rest. **Show on Features** opens **Features** showing only those features, and **Show on the Board** opens the **Features** board at their cycle.

On the timeline, each release, cycle and schedule name opens its record too. From the keyboard, press Tab to reach it, then Enter.

You're done when the record you followed is open in its panel, on its own tab.

A release's and a schedule's panel shows its key under its name, such as **#RELEASE-3**. Select the key for **Copy link** and **Copy key**, to share a link that opens the record here. See [Keys and links](keys-and-links.md).

### Make a Release

1. On the **Releases** tab, select **New release**.
1. Choose the release's **Schedule**.
1. Type its name in **Name**.
1. Choose its **First cycle**.
1. Choose its **Last cycle**.
1. To ship it at the end of the last cycle, leave **Ships on** empty. Otherwise, type the day it ships.
1. Choose its **Colour**, the colour it's drawn in on the timeline.
1. Select **Make release**.

**New release** is greyed out while no schedule takes new releases, such as when every schedule is retired.

You're done when the release's panel opens, with a dot before its name until its draft is approved.

### Change or Remove a Release

To change a release:

1. Open the release.
1. Select the pencil beside **Release**, **Ships on**, **Cycles** or **Colour**.
1. Make the change.
1. Select **Save**.

To remove a release:

1. Select the **⋯** at the end of the release's row.
1. Select **Remove release**.

You're done when the release's row shows a dot for your draft.

### Write a Release's Note

A release can have one note, with formatting such as bold and lists, for anything worth knowing about it.

1. Select the **⋯** at the end of the release's row.
1. Select **Add note…**. The note opens in a panel beside the release's details.
1. Write the note.
1. Select **Save**.

To read or change a note, open the release, then select the button at the right of its **Note** row. The note stays open when you reload the page, and a link to the page opens it for anyone who can see it.

You're done when the release's **Note** row shows the start of your note.

### Add a Schedule

Adding a schedule takes two parts: you add it, then you set up its cycles.

1. On the **Schedules** tab, select **New schedule**.
1. Type its name in **Name**.
1. Select **Add schedule**. The new schedule opens in its panel.
1. Select the pencil beside **Name pattern**.
1. In **First cycle starts**, type the day the first cycle starts.
1. In **Each cycle lasts**, type a number.
1. Choose **Weeks** or **Months** beside it.
1. In **Names**, type how the cycles are named. It starts as `{YY}.{N}`, so the first cycle that ends in 2027 is named **27.1**. The codes a name can hold are listed under it, and the first cycles it makes show below them.
1. Select **Set up cycles**.

You're done when the panel lists the schedule's cycles under **Cycles**.

### Read a Schedule's Cycles

A schedule's panel lists its cycles under **Cycles**, starting with the current one, marked **Current**, and the next five.

- To see the rest, select **Later cycles** under the list. **Hide later cycles** folds them again.
- To see the cycles before the current one, select **Earlier cycles** above the list. **Hide earlier cycles** folds them again.

You're done when you see the cycles you were looking for.

### Change a Schedule's Cycles

You can change cycles in three ways. Each change is a draft, and releases and features on cycles that move go with them.

To change the length or names of cycles from a cycle on:

1. Open the schedule, or the cycle on the **Cycles** tab.
1. Select the pencil in the cycle's **Duration**.
1. Select **This and later cycles…**.
1. Change **Each cycle lasts**, **Names**, or both.
1. Select **Change cycles**.

Cycles before it keep their names and dates. In a schedule's panel, the pencil beside **Name pattern** opens the same dialog, from the current cycle.

To change just one cycle's length:

1. Open the schedule, or the cycle on the **Cycles** tab.
1. Select the pencil in the cycle's **Duration**.
1. Select **This cycle only…**.
1. Change its **Length**.
1. Under **Later cycles**, choose **Move with it** or **Keep their dates**.
1. Select **Change length**.

A new length makes several drafts, which are approved or discarded together.

To end a schedule on a day:

1. Open the schedule.
1. Select the pencil beside **Schedule ends**.
1. Type the schedule's last day in **Schedule ends**. The dialog shows how many cycles there are in all, and the last ones.
1. Select **Save**.

The panel then reads **Schedule ends** and the day, and the timeline's cycles stop there. To let the schedule keep going again, empty **Schedule ends** and save. The panel then reads **No end date**.

You're done when the changed cycles show in the panel, with dots for your drafts.

### Rename a Schedule

1. Open the schedule.
1. Select the pencil beside **Schedule**.
1. Type its new name in **Name**.
1. Select **Save**.

You're done when the panel's heading shows the new name, with a dot before it.

### Retire or Restore a Schedule

A retired schedule takes no new releases, and its cycles take no new features. Features already on them keep their place. Once its retirement is approved, it leaves the table and the timeline. While a schedule is retired, or drafted to be, its panel has no pencils: the only change you can make is to restore it. While any schedule is retired, the **Views** menu offers **Show retired**, which a saved view keeps.

1. To restore a retired schedule, first open the **Views** menu, and choose **Show retired**.
1. Select the **⋯** at the end of the schedule's row.
1. Select **Retire** or **Restore**.

You're done when the schedule's row shows your draft: a **Retired** or **Restored** box.

### Discard or Resubmit a Draft

Each row's **⋯** menu offers **Discard draft** for your own draft, and **Resubmit** once its draft is rejected. On **Cycles**, a cycle's menu names the change behind it, such as a change to its schedule's cycles, and acts on that change.

Two drafts can change a cycle at once: a change to its schedule's cycles, and a draft of its release, such as a new name. Its menu then names both drafts, and who made each. **Discard draft** and **Resubmit** act only on the change to the schedule's cycles. **Approve draft…** and **Reject draft…** decide each of the two drafts that your role approves and that you can decide now. When that's only the release's draft, they name the release, such as **Approve Harbor 2's draft…**.

You're done when the row's dot is gone, or shows the draft waiting again.

### Use the Timeline

- To zoom, choose a zoom from **All** to **Days**, or use **−** and **+**.
- To scroll to a quarter, select it in the strip above the timeline. To move a quarter at a time, use **‹** and **›**. The quarters in view are tinted, and the current one is underlined. The quarter you chose stays filled blue until you scroll somewhere else.
- From the keyboard, press Tab to reach the strip's quarters, and the arrow keys to move between them. Press Enter or Space to choose the quarter you're on.
- To go back to today, select **Today**, at the end of the strip. A red line marks today.
- To see a cycle's or release's name and dates, point at it.

You're done when the timeline shows the time you wanted to see.

## Marks on the Page

- **A diamond** under a release on the timeline marks the day it ships. A dashed line joins it to the release when it ships on another day.
- **A dot** before a name marks its draft, on the timeline and in the table.
- **A small square** before a release's name shows the release's colour, on the timeline, in the tables and in the panels.
- **A short upright line** at the end of a schedule's cycles marks the day it ends.
- With **Drafts & Live** chosen in the **Draft** menu, a release that a draft moves also shows where it is now: faded, after a green dot, in a lane under its schedule's releases. A release that a draft removes stays, struck through.
