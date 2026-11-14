# Capacity

Capacity is about how much feature work people can deliver. It has two modes, chosen in the switch under the heading:

- **People** shows what each person and planned hire works on, month by month, and how much of their month it takes.
- **Settings** holds the planning settings for the whole organization.

A role sees each mode it may: **People** needs View Allocations, View Feature teams, View People and Personal details, and **Settings** needs View Configuration. A role that sees only one mode sees it alone, with no switch, and a role that sees neither doesn't have the page.

## Main Tasks

### Choose a Mode

Select **People** or **Settings** in the switch under the heading. The page opens on **People** for a role that sees it.

### Read Who Works on What

In **People**, the table opens at the current month. Scroll sideways for the 12 months before it and the 11 after.

### Group the Rows

1. Select **Group by**.
1. Choose **Manager**, **Feature team** or **None**.

Each group ends with a total row. **Manager** is offered to roles that see Confidential data, since later months' managers are future reorganizations.

### Find People

- Type in the search box to find people by name, or by a feature in any month, such as **Checkout**.
- To filter one month by feature, open the month's column menu, select **Filter…**, and pick the features.

### Change a Setting

1. In **Settings**, select the pencil at the right of the setting, or the value itself.
1. Type the new value, then press Enter.
1. Select **Publish** in the top bar.

Esc leaves the value as it was. A value that won't do stays in its field, with the reason in red under it. While someone else has unpublished changes to the settings, they're read only, and **Being changed by** names who.

### Approve or Reject a Draft of the Settings

1. In **Settings**, select the **⋯** at the right of a changed setting.
1. Select **Approve…** or **Reject…**, then confirm.

The menu lists every change in the draft, and approving or rejecting takes them all. The draft is on the [Drafts page](drafts-page.md) too. Approving needs Approve Configuration.

### Add or Remove a Month of Ramp-Up

- **Add:** Select **Add month**. The new month starts at 100%; point at it and select its pencil to change it. Ramp-up holds up to 12 months, and **Add month** is turned off once it's full.
- **Remove:** Select the **×** at the right of the month's row. The months after it move up one. A notification offers **Undo**.

### Undo a Change

Press Cmd+Z on a Mac, or Ctrl+Z elsewhere, straight after the change, before leaving the page.

## Marks and Terms

### In People

- **A line in a cell** names a feature and the share of the month it takes, such as **50%**. Point at the name to see all of it.
- **Total** under two or more features adds up their shares.
- **Over**, in red, marks a month whose allocations add up to more than 100%. **Under**, in grey, marks one under 100%. Both show from the current month on, and Possible features don't count.
- **Planned hires** have rows of their own, under their manager and under **No feature team**. One with no name shows its position and ID in grey, such as **SDET, TBD-5**.
- **Total, PM**, in bold, ends each group, and **Organization, PM** stays at the foot of the table. PM is person-months. Each month reads the person-months allocated of those available, such as **7.5 of 9**, with the share under it. Point at it to see it in words. They count only the rows shown.
- **Someone on a feature team with nothing allocated** reads **Under**, and counts as **0 of 1** in the totals: being on a team doesn't allocate anyone to its features.
- **A green dot inside a line**, in the light green Live row under a drafted row, marks a feature the draft takes off or changes. With **Live only** chosen in the Draft menu, it marks each one a waiting draft would change.
- **People** is read only for now.

### In Settings

- **Hours a day** and **Working days a week** and **a month** set what a person-day, person-week and person-month are, in the **Effort** column on Features. An estimate keeps its hours, so changing them changes what it reads in the larger units.
- **Default focus** is the share of a person's time that goes to feature work at all, after meetings, support and the like.
- **Default buffer** is a percentage added to a feature's effort before forecasting. The effort entered stays as it is.
- **Ramp-up for new starters** is the share of full output a new starter delivers in each of their first months. The last row, such as **From month 3**, shows that they deliver **100%** from then on.
- Nothing forecasts with focus, buffer or ramp-up yet.
- **A yellow dot** marks a setting a draft changes, with the live value under it after a green dot. **No month 3**, or the like, marks a month the draft adds or removes. **Draft** above **Working time** chooses how drafts show, as [Drafts](drafts.md) sets out.

## Where Changes Go

A change to a setting is a draft. Once published, it waits for someone whose role approves configuration, and takes effect for everyone once approved. Until then, the **Effort** column on Features keeps using the approved settings, which **Show in** names, such as **Person-days (8 hours)**. Every change is recorded in the change history. See [Drafts](drafts.md).
