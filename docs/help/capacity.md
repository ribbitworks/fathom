# Capacity

**Capacity** is about how much feature work people can deliver. It has two modes, and the switch beside the heading chooses between them:

- **People** shows what each person and planned hire works on, month by month, and how much of their month it takes.
- **Settings** holds the planning settings, which apply to everyone.

## What to Know First

- **Allocations:** an allocation is the share of someone's month planned for one feature, such as 50%.
- **Planned hires:** a planned hire is a job you plan to fill. It has a row like a person's, so the work planned for it shows too.
- **Person-months:** a person-month is one person's work for a month. The settings decide how many hours and days that is.
- **Who sees which mode:** your role decides which modes you see. If it sees only one, that mode shows alone, with no switch. If it sees neither, you don't have the page. The Pages Help page lists the permissions each mode needs.
- **Drafts:** a change to a setting is a draft. Nobody else sees it until you select **Publish** in the top bar, and it takes effect once someone whose role approves configuration approves it.

See [Drafts](drafts.md) for more.

## Main Tasks

### Choose a Mode

Select **People** or **Settings** in the switch beside the heading. The page opens on **People** for a role that sees it.

### Read Who Works on What

In **People**, the table opens at the current month. Scroll sideways to see the 12 months before it and the 11 after.

### Group the Rows

1. Select **Group by**.
1. Choose **Manager**, **Feature team** or **None**.

Each group ends with a total row. **Manager** is offered only to roles that see Confidential data, since a later month's manager can be a reorganization not yet announced.

### Find People

- To find people by name, type in the search box. You can also type a feature's name, such as `Checkout`, to find everyone allocated to it in any month.
- To filter one month by feature, open that month's column menu, select **Filter…**, and pick the features.

### Change a Setting

1. In **Settings**, select the setting's value.
1. Type the new value, and press Enter.
1. Select **Publish** in the top bar.
1. Ask someone whose role approves configuration to approve it.

To leave the value as it was, press Esc instead of Enter. If Fathom can't take a value, it stays in its field, with the reason in red under it.

While someone else has unpublished changes to the settings, you can't change them, and **Being changed by** names who.

You're done once it's approved, and the setting shows its new value with no dot.

### Approve or Reject a Draft of the Settings

You need the Approve Configuration permission to do this.

1. In **Settings**, select the **⋯** at the right of a changed setting.
1. Select **Approve…** or **Reject…**.
1. Confirm.

The menu lists every change in the draft, and approving or rejecting takes them all. You can also approve the draft on the [Drafts page](drafts-page.md).

You're done when the dot is gone and the setting shows its new value, or its old one if you rejected it.

### Add or Remove a Month of Ramp-Up

Ramp-up is how much of their full output a new starter delivers in each of their first months.

To add a month:

1. Select **Add month**. The new month starts at 100%.
1. To change it, point at it, and select its pencil.

Ramp-up holds up to 12 months. Once it's full, you can't select **Add month**.

To remove a month, select the **×** at the right of its row. The months after it move up one, and a notification offers **Undo**.

You're done when the months show your change, each with a yellow dot once you publish it.

### Undo a Change

Press Cmd+Z on a Mac, or Ctrl+Z elsewhere, straight after the change, before you leave the page.

## Marks and Terms

### In People

- **A line in a cell** names a feature, and the share of the month it takes, such as **50%**. Point at the name to see all of it.
- **Total**, under two or more features, adds up their shares.
- **Over**, in red, marks a month whose allocations add up to more than 100%. **Under**, in grey, marks one under 100%. Both show from the current month on, and features whose status means Possible don't count.
- **Planned hires** have rows of their own, under their manager and under **No feature team**. One with no name shows its position and ID in grey, such as **SDET, TBD-5**.
- **Total, PM**, in bold, ends each group, and **Organization, PM** stays at the foot of the table. PM is person-months.
- **A total**, such as **7.5 of 9**, is the person-months allocated that month, out of those available. The share is under it. Point at it to see it in words. Totals count only the rows shown.
- **Someone on a feature team with nothing allocated** reads **Under**, and counts as **0 of 1** in the totals. Being on a team doesn't allocate anyone to its features.
- **A green dot inside a line**, in the light green Live row under a drafted row, marks a feature the draft takes off or changes. With **Live only** chosen in the **Draft** menu, it marks each one a waiting draft would change.
- **People** is read only for now.

### In Settings

- **Hours a day**, **Working days a week** and **Working days a month** set what a person-day, person-week and person-month are, in the **Effort** column on **Features**. An estimate keeps its hours, so changing these changes what it reads in the larger units.
- **Default focus** is the share of a person's time that goes to feature work at all, after meetings, support and the like.
- **Default buffer** is a percentage added to a feature's effort before forecasting. The effort entered stays as it is.
- **Ramp-up for new starters** is the share of full output a new starter delivers in each of their first months. The last row, such as **From month 3**, shows that they deliver **100%** from then on.
- Nothing forecasts with focus, buffer or ramp-up yet.
- **A yellow dot** marks a setting a draft changes, with the live value under it after a green dot. **No month 3**, or the like, marks a month the draft adds or removes. **Draft**, above **Working time**, chooses how drafts show.

## Where Changes Go

Until a change to a setting is approved, the **Effort** column on **Features** keeps using the approved settings, which **Show in** names, such as **Person-days (8 hours)**. Every change is recorded in the change history.
