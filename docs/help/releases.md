# Releases

**Releases** holds your release streams. Here you set up each stream's cycles, make its releases, and see every stream on one timeline.

## What to Know First

- **Release stream:** a series of releases with its own cycles, such as one product line's. **Platform** is one example.
- **Cycle:** a planning period, such as a quarter. A stream makes its cycles from a schedule, such as every 3 months.
- **Release:** what ships the features that target its cycles. It covers one cycle, or several in a row.
- **Ships on:** the day a release ships. It's the end of its last cycle, unless you set another day.
- **Planned to:** the day by which a stream's last cycle starts, so the last cycle can end after it. A feature can only target a cycle that's been made, so this decides how far ahead you can plan.
- **Panel:** a stream's details open in a panel beside the timeline and the table. To close it, select the **×** at its top right, or press Esc.
- **Drafts:** every change you make here is a draft. Nobody else sees it until you select **Publish** in the top bar. It goes live once someone whose role approves features and releases approves it. A dot before a name marks its draft.
- **Who changes what:** if your role changes planning settings, you add streams and change their cycles. If your role changes features, you make and change releases. Others see the page without these buttons.

The page shows a timeline of every stream, with a table of the streams under it. The table lists each stream's cycle schedule, its releases, the next release to ship, and its **Planned to** day. Above the timeline are the search field and the **Draft**, **Metrics**, **Group by** and **Views** menus.

See [Drafts](drafts.md) for more.

## Main Tasks

### Find and Open a Stream

1. Type part of the stream's name in the search field at the top of the page.
1. Point at the stream's row.
1. Select the details button: the small box at the right of its name.

Cmd+F on a Mac, or Ctrl+F elsewhere, takes you to the search field. Instead of the details button, you can also right-click the row and select **Show details**. To clear the search, press Esc in the search field. To group the streams another way, choose **Group by**, then **Status** or **Cycle schedule**.

You're done when the stream's panel is open, headed with its name.

### Add a Release Stream

Adding a stream takes two parts: you add it, then you set up its cycles.

1. Select **New release stream**.
1. Type its name in **Name**.
1. Select **Add stream**. The new stream opens in its panel.
1. Under **Cycle schedule**, select **Set up cycles…**.
1. In **First cycle starts**, choose when the first cycle starts.
1. In **Each cycle lasts**, choose how long each cycle lasts.
1. In **Names**, type how the cycles are named.
1. Select **Set up cycles**.

You're done when the panel lists the stream's cycles under **Cycles**.

### Make a Release

1. Open the stream.
1. Under **Releases**, select **New release…**.
1. Type the release's name in **Name**.
1. Choose its **First cycle**.
1. Choose its **Last cycle**.
1. To ship it at the end of the last cycle, leave **Ships on** empty. Otherwise, type the day it ships.
1. Select **Make release**.

You're done when the release shows under **Releases**, with a dot before it until its draft is approved.

### Change or Remove a Release

1. Select the **⋯** at the end of the release's row.
1. Select **Change…** to change its name, cycles, ship day or colour, or **Remove** to remove it.

You're done when the release's row shows a dot for your draft.

### Write a Release's Note

A release can have one note, with formatting such as bold and lists, for anything worth knowing about it.

1. Select the **⋯** at the end of the release's row.
1. Select **Add note…**.
1. Write the note.
1. Select **Save**.

Once a release has a note, its name is underlined. To read the note, select the name. To change it, select **Editor**, make your change, and select **Save**.

You're done when the release's name is underlined.

### Change a Stream's Cycles

You can change cycles in three ways. Each change is a draft, and releases and features on cycles that move go with them.

To change the length or names of cycles from a date on:

1. Under **Cycle schedule**, select **Change…**.
1. Select **Length or names from a date…**.
1. In **From the start of**, choose the cycle to start from.
1. Change **Each cycle lasts**, **Names**, or both.
1. Select **Change cycles**.

Cycles before that date keep their names and dates.

To make cycles further ahead, or stop them sooner:

1. Under **Cycle schedule**, select **Change…**.
1. Select **Planned to…**.
1. Type the new day in **Planned to**.
1. Select **Save**.

To change just one cycle's length:

1. Under **Cycles**, select the **⋯** at the end of the cycle's row.
1. Select **Change length…**.
1. Change its **Length**.
1. Under **Later cycles**, choose **Move with it** or **Keep their dates**.
1. Select **Change length**.

A new length makes several drafts, which are approved or discarded together.

You're done when the changed cycles show in the panel, with dots for your drafts.

### Rename, Retire or Restore a Stream

A retired stream takes no new releases. Once its retirement is approved, it leaves the table. While any stream is retired, the **Views** menu offers **Show retired**. That lists retired streams under **Retired**, while the streams are grouped by **Status**.

1. To restore a retired stream, first open the **Views** menu, and choose **Show retired**.
1. Open the stream.
1. At the top of its panel, select **Rename**, **Retire** or **Restore**.

You're done when the stream's heading shows your draft: a dot before a new name, or a **Retired** or **Restored** box.

### Use the Timeline

- To zoom, choose a zoom from **All** to **Days**, or use **−** and **+**.
- To scroll to a quarter, select it in the strip above the timeline. To move a quarter at a time, use **‹** and **›**. The quarters in view are tinted, and the current one is underlined. The quarter you chose stays filled blue until you scroll somewhere else.
- From the keyboard, press Tab to reach the strip's quarters, and the arrow keys to move between them. Press Enter or Space to choose the quarter you're on.
- To go back to today, select **Today**, at the end of the strip. A red line marks today.
- To see a cycle's or release's name and dates, point at it.

## Marks on the Page

- **A diamond** under a release on the timeline marks the day it ships. A dashed line joins it to the release when it ships on another day.
- **A dot** before a stream's or release's name marks its draft, on the timeline and in the table.
- With **Drafts beside live** chosen in the **Draft** menu, a release that a draft moves also shows faded, after a green dot, in a lane under its stream's releases, where it is now. A release that a draft removes stays, struck through.
