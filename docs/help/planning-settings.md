# Planning settings

**Planning settings** holds the figures capacity and forecasts are worked out with, for the whole organization. It's in the sidebar under **Administration**, after **Lists**. You can also open it from the **Planning settings** link at the right of the **Capacity** heading.

## What to Know First

- **Who sees it:** your role needs View Configuration to see the page, and Edit Configuration to change it. Without Edit Configuration, the page is read only.
- **Drafts:** a change to a setting is a draft of the settings. Nobody else sees it until you select **Publish** in the top bar, and it takes effect once it's approved.
- **One draft:** all your changes to the settings make one draft, which is approved or rejected whole.

See [Drafts](drafts.md) for more.

## Main Tasks

### Change a Setting

1. Select the setting's value.
1. Type the new value, and press Enter.
1. Select **Publish** in the top bar.
1. Ask someone whose role approves configuration to approve it.

To leave the value as it was, press Esc instead of Enter. If Fathom can't take a value, it stays in its field, with the reason in red under it.

While someone else has unpublished changes to the settings, you can't change them, and **Being changed by** names who.

You're done once it's approved, and the setting shows its new value with no dot.

### Choose the Working Days

1. Select the value of **Working days**. A box shows for each day of the week, the working days tinted.
1. Select a day to tick it, or select it again to untick it.
1. Press Enter.
1. Select **Publish** in the top bar.

From the keyboard, the arrow keys move between the days, and Space ticks one.

At least one day must be a working day. With none ticked, **Working day needed** shows in red under the days, and nothing is saved until you tick one. To put the days back as they were, press Esc.

You're done when **Working days** names your days, such as **Mon to Fri**.

### Choose the Day a Week Starts On

1. Select the value of **Week starts on**.
1. Choose the day.
1. Select **Publish** in the top bar.

The days under **Working days** then start on it.

You're done when **Week starts on** names the day, after a dot.

### Approve or Reject a Draft of the Settings

You need the Approve Configuration permission to do this.

1. Select the **⋯** at the right of a changed setting.
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

You're done when the setting shows its value from before the change.

## Marks and Terms

- **Hours a day** and **Working days a month** set what a person-day and person-month are, in the **Effort** columns on **Features** and **Activities**. An estimate keeps its hours, so changing these changes what it reads in the larger units.
- **Working days** are the days people work, such as **Mon to Fri**. A person-week is a person-day for each of them.
- **Week starts on** is the first day of the organization's week.
- **Default focus** is the share of a person's time that goes to feature work at all, after meetings, support and the like.
- **Default buffer** is a percentage added to a feature's effort before forecasting. The effort entered stays as it is.
- **Ramp-up for new starters** is the share of full output a new starter delivers in each of their first months. The last row, such as **From month 3**, shows that they deliver **100%** from then on.
- Focus, buffer and ramp-up set the hours on **Capacity**'s **Allocations** grouped by **Allocated to**, and change no other figure.
- **A yellow dot** marks a setting a draft changes, with the live value under it after a green dot. **No month 3**, or the like, marks a month the draft adds or removes. **Draft**, above **Working time**, chooses how drafts show.

## Where Changes Go

Until a change is approved, the **Effort** columns on **Features** and **Activities**, and the hours on **Allocations**, keep using the approved settings. **Show in** names them, such as **Person-days (8 hours)**. Every change is recorded in the change history.
