# Releases

**Releases** holds your schedules. Here you set up each schedule's cycles and see your schedules on one timeline.

## What to Know First

- **Schedule:** a repeating set of cycles, such as one product line's, with releases where it ships them. **Platform** is one example.
- **Cycle:** a planning period, such as a quarter. A schedule makes its cycles from how long each lasts, such as 3 months, and names them by its **Name pattern**, such as `{YY}.{N}` for 27.1, 27.2 and on. Fathom lays cycles out two years ahead of today, so you can plan that far.
- **Release:** what ships the features that target its cycles. It covers one cycle, or several in a row. The page shows releases on the timeline and in the table. You can't make or change them here.
- **Ships on:** the day a release ships. It's the end of its last cycle, unless another day was set.
- **Schedule ends:** a schedule's last day, or **No end date** if it keeps going. No cycle starts after that day, and the cycle holding it ends on it. Once that day has passed, the schedule shows **Ended** after its name. It stays on the page until you retire it.
- **Panel:** a schedule's details open in a panel beside the timeline and the table. To close it, select the **×** at its top right, or press Esc.
- **Drafts:** every change you make here is a draft. Nobody else sees it until you select **Publish** in the top bar. A schedule's draft goes live once someone whose role approves the plan or configuration approves it. A dot before a name marks its draft.
- **Who changes what:** if your role can change **Plan** or **Configuration**, you add schedules and change their cycles. Others see the page without these buttons and pencils.

The page opens on its **Schedules** tab, beside the **Releases** heading. It shows a timeline of the schedules the table shows, with the table of schedules under it. A search, a filter or a saved view narrows both. For each schedule, the table shows its current cycle and that cycle's first and last days, the next release to ship and its day, how long its cycles last now, and its **Schedule ends** day, which is blank while it has no end date. Above the timeline are the search field, the **Draft** menu, the **Metrics** button, and the **Group by** and **Views** menus.

See [Drafts](drafts.md) for more.

## Main Tasks

### Find and Open a Schedule

1. Type part of the schedule's name in the search field at the top of the page.
1. Point at the schedule's row.
1. Select the details button: the small box at the right of its name.

Cmd+F on a Mac, or Ctrl+F elsewhere, takes you to the search field. Instead of the details button, you can also right-click the row and select **Show details**. To clear the search, press Esc in the search field. To group the schedules by **Current**, **Ended** and **Retired**, choose **Group by**, then **Status**.

You're done when the schedule's panel is open, headed with its name.

### Add a Schedule

Adding a schedule takes two parts: you add it, then you set up its cycles.

1. Select **New schedule**.
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

- To see the rest, select **Show all** under the list. **Show less** folds it again.
- To see the cycles before the current one, select **Earlier cycles** above the list. **Hide earlier cycles** folds them again.

### Change a Schedule's Cycles

You can change cycles in three ways. Each change is a draft, and releases and features on cycles that move go with them.

To change the length or names of cycles from a cycle on:

1. Under **Cycles**, select the pencil in that cycle's **Duration**.
1. Select **This and later cycles…**.
1. Change **Each cycle lasts**, **Names**, or both.
1. Select **Change cycles**.

Cycles before it keep their names and dates. The pencil beside **Name pattern** opens the same dialog, from the current cycle.

To change just one cycle's length:

1. Under **Cycles**, select the pencil in that cycle's **Duration**.
1. Select **This cycle only…**.
1. Change its **Length**.
1. Under **Later cycles**, choose **Move with it** or **Keep their dates**.
1. Select **Change length**.

A new length makes several drafts, which are approved or discarded together.

To end a schedule on a day:

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

A retired schedule takes no new releases, and its cycles take no new features. Features already on them keep their place. Once its retirement is approved, it leaves the table and the timeline. While a schedule is retired, or drafted to be, its panel has no pencils: restoring it is the only change it takes. While any schedule is retired, the **Views** menu offers **Show retired**, which a saved view keeps.

1. To restore a retired schedule, first open the **Views** menu, and choose **Show retired**.
1. Select the **⋯** at the end of the schedule's row.
1. Select **Retire** or **Restore**.

The same menu offers **Discard draft** for your own draft of the schedule, and **Resubmit** once its draft is rejected.

You're done when the schedule's row shows your draft: a **Retired** or **Restored** box.

### Use the Timeline

- To zoom, choose a zoom from **All** to **Days**, or use **−** and **+**.
- To scroll to a quarter, select it in the strip above the timeline. To move a quarter at a time, use **‹** and **›**. The quarters in view are tinted, and the current one is underlined. The quarter you chose stays filled blue until you scroll somewhere else.
- From the keyboard, press Tab to reach the strip's quarters, and the arrow keys to move between them. Press Enter or Space to choose the quarter you're on.
- To go back to today, select **Today**, at the end of the strip. A red line marks today.
- To see a cycle's or release's name and dates, point at it.

## Marks on the Page

- **A diamond** under a release on the timeline marks the day it ships. A dashed line joins it to the release when it ships on another day.
- **A dot** before a schedule's or release's name marks its draft, on the timeline and in the table.
- **A small square** before a release's name shows the release's colour, on the timeline, in the table and in the panel.
- With **Drafts & Live** chosen in the **Draft** menu, a release that a draft moves also shows faded, after a green dot, in a lane under its schedule's releases, where it is now. A release that a draft removes stays, struck through.
