# Capacity

**Capacity** is about who works where and how much feature work people can deliver. It has three tabs, beside the heading:

- **Feature teams** shows who is on which feature team, month by month.
- **Allocations** shows what each person and planned hire works on, month by month, and how much of their month it takes.
- **Settings** holds the planning settings, which apply to everyone.

## What to Know First

- **Feature teams:** a feature team is a group that works on features together, whoever its members report to. Being on a team doesn't say what someone works on. That's in **Allocations**.
- **Allocations:** an allocation is the share of someone's month planned for one feature, such as 50%.
- **Planned hires:** a planned hire is a job you plan to fill. It has a row like a person's, so the work planned for it shows too.
- **Person-months:** a person-month is one person's work for a month. The settings decide how many hours and days that is.
- **Who sees which tab:** your role decides which tabs you see. If it sees only one, that tab shows alone, with no tabs above it.
- **No tabs:** if your role sees none of the tabs, you don't have the page. The Pages Help page lists the permissions each tab needs.
- **Drafts:** a change to someone's teams or to a setting is a draft. Nobody else sees it until you select **Publish** in the top bar, and it takes effect once it's approved.

See [Drafts](drafts.md) for more.

## Main Tasks

### Choose a Tab

Select **Feature teams**, **Allocations** or **Settings** beside the heading. The page opens on the tab you used last.

### Move Through the Months

**Feature teams** and **Allocations** have the same table: a row for each person and planned hire, and a column for each month. It holds whole quarters, from the quarter a year back to the quarter eleven months ahead. It opens with the current month second, after last month, and the current month's heading is underlined in red.

- To scroll to a quarter, select it in the strip above the table. To move a quarter at a time, use **‹** and **›**.
- The quarters in view are tinted, and the current one is underlined. The quarter you chose stays filled blue until you scroll somewhere else.
- From the keyboard, press Tab to reach the strip's quarters, and the arrow keys to move between them. Press Enter or Space to choose the quarter you're on.
- To go back to the current month, select **Today**, at the end of the strip.

The count after **Group by**, such as **Apr 2027: 137 people, 10 planned hires**, is for one month: the one you moved to, second in view, whose heading is filled blue. It counts the people working that month and the planned hires expected by then, and changes as you scroll.

While a filter, a search or a month's own filter narrows the rows, the count says how many of that month's are shown, such as **Apr 2027: 6 of 137 people**. A kind none of which is shown is left out. Someone listed under two groups is counted once.

### Group the Rows

The table starts as one list. To put the rows under headings:

1. Select **Group by**.
1. Choose **Manager** or **Feature team**.

To turn the headings round, select **Group by** again, and choose **Z to A**. The heading for none, such as **No manager**, then comes first.

To show one list again, choose **Clear grouping**, at the end of the menu, or **None** under **Group by**.

On **Allocations**, grouped by **Manager**, someone who changed manager has a row under each one, holding only the months they reported to them. Grouped by **Feature team**, someone has a row under each team they're on, and one under **No feature team** for any months they're on none. Each group ends with a total row.

On **Feature teams**, someone on two feature teams has a row under each team. Grouped by **Manager**, each person is under the manager they report to today. **Manager** is offered only to roles that see Confidential data, since a later month's manager can be a reorganization not yet announced.

You're done when the rows show under the headings you chose.

### Find People

- To find people by name, type in the search box. You can also type a team's or a feature's name, such as `Payments core` or `Checkout`, to find everyone on it in any month.
- To filter one month by team or feature, open that month's column menu, select **Filter…**, and pick the teams or features.
- To see only who is over or under, on **Allocations**, select **Views**, then **Over** or **Under**. They keep the rows **Over**, or **Under** or **Not allocated**, in the current month or any later month in the table.
- To see who is either over or under, choose both. To turn one off, select it again.
- To see only who is on some teams or features in any month, select the button after the search box, and pick them. The button is **Feature teams** on the **Feature teams** tab, and **Allocations** on **Allocations**.
- To see who has none in any month, pick **No feature team** or **Not allocated** there.
- With teams or features picked, the months you scroll to don't change the rows. To clear what you picked, select the **×** on its pill.

### Keep a View of the Table

To come back to a tab as you've set it up, with its grouping and search, save it as a view. Each of **Feature teams** and **Allocations** has views of its own. **Settings** has no views.

1. Set up the table the way you want it.
1. Select **Views**, the last button after the search box.
1. Select **Save view…**.
1. Type the view's **Name**.
1. Select **Save view**.

See [Saved views](saved-views.md#save-a-view).

You're done when the **Views** button shows the view's name.

### Put Someone on a Feature Team From a Month

1. In **Feature teams**, select the person's cell in the month the change starts.
1. Press Enter. The team list opens.
1. Type part of the team's name, such as `Pay`, and press Tab.

The person is on the team from that month on. The change starts on the first day of the month, or today if it's the current month. You can change earlier months only if your role changes Personal details.

To take someone off a team from a month on, select their cell in that month, and press Delete.

You're done when the team shows in the cell, with a dot for your draft.

### Change Several Members or a Team's Lead

Use the team's panel on the **Org chart**, under **Feature teams**. See [Org chart](org-chart.md#change-a-feature-team).

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

### In Feature Teams

- **A team in a cell** shows its name after a small square in its colour, or with no square when it has none. Point at a name to see all of it.
- **Shaded months** come before someone started or after they left.
- **Planned hires** have rows, but no teams yet, so their cells are empty.
- **No feature team**, when grouped by **Feature team**, heads the people who are on no team in all the months shown.
- **No manager**, when grouped by **Manager**, heads the people who report to nobody today.
- **A green dot before a team**, in the light green Live row under a drafted row, marks a team the draft takes away. With **Live only** chosen in the **Draft** menu, it marks each team a waiting draft would take away. Point at it to see the change.

### In Allocations

- **A line in a cell** names a feature, after a small square in its feature team's colour, and the share of the month it takes, such as **50%**. Point at the name to see all of it.
- **Over**, in red, ends a month whose allocations add up to more than 100%, with how much more at the right, such as **+25%**. **Under**, in red, ends one under 100%, with how much less, such as **−90%**.
- **Not allocated**, in red, ends a month with nothing allocated. A month at exactly 100% has no last line.
- **Over**, **Under** and **Not allocated** show from the current month on, and features whose status means Possible don't count. Point at **Over** or **Under** to see the month's total.
- **Planned hires** have rows of their own, under their manager and under **No feature team**. One with no name shows its position and ID in grey, such as **SDET, TBD-5**. Months before one is expected are shaded.
- **Total, person-months**, in bold, ends each group, and **Organization, person-months** stays at the foot of the table.
- **A total**, such as **7.5 of 9**, is the person-months allocated that month, out of those available. The share is under it.
- Point at a total to see it in words. Totals count only the rows shown.
- **Someone on a feature team with nothing allocated** reads **Not allocated**, and counts as **0 of 1** in the totals. Being on a team doesn't allocate anyone to its features.
- **A green dot inside a line**, in the light green Live row under a drafted row, marks a feature the draft takes off or changes. With **Live only** chosen in the **Draft** menu, it marks each one a waiting draft would change.
- **Allocations** is read only.

### In Settings

- **Hours a day**, **Working days a week** and **Working days a month** set what a person-day, person-week and person-month are, in the **Effort** column on **Features**. An estimate keeps its hours, so changing these changes what it reads in the larger units.
- **Default focus** is the share of a person's time that goes to feature work at all, after meetings, support and the like.
- **Default buffer** is a percentage added to a feature's effort before forecasting. The effort entered stays as it is.
- **Ramp-up for new starters** is the share of full output a new starter delivers in each of their first months. The last row, such as **From month 3**, shows that they deliver **100%** from then on.
- Focus, buffer and ramp-up don't change any figure Fathom shows.
- **A yellow dot** marks a setting a draft changes, with the live value under it after a green dot. **No month 3**, or the like, marks a month the draft adds or removes. **Draft**, above **Working time**, chooses how drafts show.

## Where Changes Go

A change to someone's teams is a draft of the team, and it's approved with the team's other changes. Each month the draft changes has the draft's dot before the team. See [Drafts](drafts.md).

Until a change to a setting is approved, the **Effort** column on **Features** keeps using the approved settings, which **Show in** names, such as **Person-days (8 hours)**. Every change is recorded in the change history.
