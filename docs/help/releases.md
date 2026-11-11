# Releases

Releases holds the release streams, such as **Platform**. Each stream is a sequence of releases with its own cycles. A cycle is a planning period, such as a quarter, and a release ships the features that target its cycles. The timeline below the table shows every stream side by side.

## Main Tasks

### Add a Release Stream

1. Select **New release stream**.
1. Type the **Name**, then select **Add stream**.
1. In the stream's panel, select **Set up cycles…** under **Cycle schedule**.
1. Choose when the **First cycle starts**, how long **Each cycle lasts**, and the **Names**, then select **Set up cycles**.

### Make a Release

1. Select the stream in the table.
1. Select **New release…** under **Releases**.
1. Type the **Name**, and choose the **First cycle** and **Last cycle**.
1. Leave **Ships on** empty to ship at the end of the last cycle, or type another day.
1. Select **Make release**.

### Change or Remove a Release

1. Select the **⋯** at the end of the release's row.
1. Select **Change…** to change its name, cycles, ship day or **Colour**, or **Remove** to remove it.

### Write a Release's Note

1. Select **Add note…** in the release's **⋯** menu.
1. Write the note, then select **Save**.

Once a release has a note, its name is underlined. Select the name to read the note. To change it, select **Editor**, make the change, and select **Save**.

### Change a Stream's Cycles

- **Length or names from a date:** Select **Change…** under **Cycle schedule**, then **Length or names from a date…**. Cycles before that date keep their names and dates.
- **How far ahead cycles are made:** Select the **Change…** below **Planned to**, then **Planned to…**.
- **One cycle's length:** Select **Change length…** in the cycle's **⋯** menu, in the **Cycles** table. Choose whether **Later cycles** **Move with it** or **Keep their dates**. Releases and features on cycles that move go with them.

### Rename or Retire a Stream

Select **Rename** or **Retire** at the top of the stream's panel. A retired stream is listed under **Retired**, and takes no new releases. **Restore** brings it back.

### Use the Timeline

- Choose a zoom, from **All** to **Days**, or use **−** and **+**.
- Select **Today** to go back to today, which a red line marks.
- Rest the pointer on a cycle or release to see its name and dates.

## Marks and Terms

- **Ships on** is the day a release ships. It's the end of its last cycle unless another day is set.
- **Planned to** is the last day cycles are made up to, so features far ahead can target a cycle.
- A **diamond** on the timeline marks the day a release ships. A dashed line joins it to the release's last cycle when it ships on another day.
- A **dashed edge** on the timeline marks a release with a draft.

## Where Changes Go

Every change is a draft. It goes live once someone whose role approves releases approves it. Changing one cycle's length makes several drafts, which are approved or discarded together. See [Drafts](drafts.md).
