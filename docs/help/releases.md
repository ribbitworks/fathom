# Releases

Releases holds your release streams. Here you set up each stream's cycles, make its releases, and see every stream on one timeline.

## What to Know First

- **Release stream:** a sequence of releases with its own cycles, such as **Platform**.
- **Cycle:** a planning period, such as a quarter. A stream makes its cycles from a schedule, such as every 3 months.
- **Release:** what ships the features that target its cycles. It covers one cycle or several in a row.
- **Ships on:** the day a release ships. It's the end of its last cycle, unless you set another day.
- **Planned to:** the last day a stream's cycles are made up to. Features far ahead can only target a cycle that's made.
- **Panel:** a stream's details open in a panel beside the timeline and the table. Close it with the **×** at its top right, or press Esc.
- **Draft:** every change you make here is a draft. It goes live once someone whose role approves features and releases approves it.
- **Who changes what:** if your role changes planning settings, you add streams and change their cycles. If your role changes the plan, you make and change releases. Others see the page without these buttons.

The page shows a timeline of every stream, with a table of the streams under it. The table lists each stream's cycle schedule, its releases, the next release to ship, and its **Planned to** day. Above the timeline are the search field and the **Draft**, **Metrics**, **Group by** and **Views** menus.

## Main Tasks

### Find and Open a Stream

1. Type part of the stream's name in the search field at the top of the page. Cmd+F on a Mac, or Ctrl+F elsewhere, takes you there.
1. Select the arrow at the right of the stream's name. The stream opens in a panel beside the table.

Press Esc in the search field to clear it. To group the streams another way, choose **Group by**, then **Status** or **Cycle schedule**.

You're done when the stream's panel is open, headed with its name.

### Add a Release Stream

1. Select **New release stream**.
1. Type its name in **Name**.
1. Select **Add stream**. The new stream opens in its panel.
1. Under **Cycle schedule**, select **Set up cycles…**.
1. Choose when the first cycle starts, in **First cycle starts**.
1. Choose how long each cycle lasts, in **Each cycle lasts**.
1. Type how cycles are named, in **Names**.
1. Select **Set up cycles**.

You're done when the panel lists the stream's cycles under **Cycles**.

### Make a Release

1. Open the stream.
1. Under **Releases**, select **New release…**.
1. Type the release's name in **Name**.
1. Choose its **First cycle**.
1. Choose its **Last cycle**.
1. Leave **Ships on** empty to ship at the end of the last cycle, or type another day.
1. Select **Make release**.

You're done when the release shows under **Releases**, with a dot before it until its draft is approved.

### Change or Remove a Release

1. Select the **⋯** at the end of the release's row.
1. Select **Change…** to change its name, cycles, ship day or colour, or **Remove** to remove it.

You're done when the release's row shows a dot for your draft.

### Write a Release's Note

1. Select the **⋯** at the end of the release's row, then **Add note…**.
1. Write the note.
1. Select **Save**.

Once a release has a note, its name is underlined. Select the name to read the note. To change it, select **Editor**, make your change, and select **Save**.

### Change a Stream's Cycles

To change the length or names of cycles from a date on:

1. Under **Cycle schedule**, select **Change…**, then **Length or names from a date…**.
1. Choose the cycle to start from, in **From the start of**.
1. Change **Each cycle lasts**, **Names**, or both.
1. Select **Change cycles**.

Cycles before that date keep their names and dates.

To make cycles further ahead, or stop them sooner:

1. Under **Cycle schedule**, select **Change…**, then **Planned to…**.
1. Type the new day in **Planned to**.
1. Select **Save**.

To change just one cycle's length:

1. Under **Cycles**, select the **⋯** at the end of the cycle's row, then **Change length…**.
1. Change its **Length**.
1. Under **Later cycles**, choose **Move with it** or **Keep their dates**.
1. Select **Change length**.

Releases and features on cycles that move go with them. A new length makes several drafts, which are approved or discarded together.

You're done when the changed cycles show in the panel with dots for your drafts.

### Rename, Retire or Restore a Stream

A retired stream takes no new releases. Once its retirement is approved, it leaves the table. While any stream is retired, the **Views** menu offers **Show retired**, which lists them under **Retired** while the streams are grouped by **Status**.

1. To restore a retired stream, open the **Views** menu and choose **Show retired** first.
1. Open the stream.
1. Select **Rename**, **Retire** or **Restore** at the top of its panel.

You're done when the stream's heading shows your draft: a dot before a new name, or a **Retired** or **Restored** box.

### Use the Timeline

- Choose a zoom, from **All** to **Days**, or use **−** and **+**.
- Select a quarter in the strip above the timeline to scroll to it. Use **‹** and **›** to move a quarter at a time. The quarters in view are tinted, and the current one is underlined. The quarter you chose is filled blue until you scroll somewhere else.
- From the keyboard, Tab reaches the strip's quarters, and the arrow keys move between them. Press Enter or Space to choose the quarter you're on.
- Select **Today**, at the end of the strip, to go back to today. A red line marks today.
- Rest the pointer on a cycle or release to see its name and dates.

## Marks on the Page

- A **diamond** under a release on the timeline marks the day it ships. A dashed line joins it to the release when it ships on another day.
- A **dot** before a stream's or release's name marks its draft, on the timeline and in the table.
- With **Drafts beside live** chosen in the **Draft** menu, a release a draft moves also shows faded, after a green dot, in a lane under its stream's releases, where it is now. A release a draft removes stays, struck through.

See [Drafts](drafts.md) for how drafts are approved.
