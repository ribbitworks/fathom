# Capacity

**Capacity** is about who works where and how much feature work people can deliver. It has two tabs, beside the heading:

- **Feature teams** shows who is on which feature team, month by month.
- **Allocations** shows what each person and planned hire works on, month by month, and how much of their month it takes.

If your role sees the planning settings, a **Planning settings** link at the right of the heading opens them. See [Planning settings](planning-settings.md).

## What to Know First

- **Feature teams:** a feature team is a group that works on features together, whoever its members report to. Being on a team doesn't say what someone works on. That's in **Allocations**.
- **Allocations:** an allocation is the share of someone's month planned for one feature, or one activity of a project or release, such as 50%. An activity is work that isn't a feature, such as data migration.
- **Planned hires:** a planned hire is a job you plan to fill. It has a row like a person's, so the work planned for it shows too.
- **Person-months:** a person-month is one person's work for a month. The planning settings decide how many hours and days that is.
- **Who sees which tab:** your role decides which tabs you see. If it sees only one, that tab shows alone, with no tabs above it.
- **No tabs:** if your role sees none of the tabs, you don't have the page. The Pages Help page lists the permissions each tab needs.
- **Drafts:** a change to someone's teams is a draft. Nobody else sees it until you select **Publish** in the top bar, and it takes effect once it's approved.

See [Drafts](drafts.md) for more.

## Main Tasks

### Choose a Tab

Select **Feature teams** or **Allocations** beside the heading. The page opens on the tab you used last.

You're done when the tab you chose is underlined.

### Move Through the Months

**Feature teams** and **Allocations** have the same table: a row for each person and planned hire, and a column for each month. It holds whole quarters, from the quarter a year back to the quarter eleven months ahead. It opens with the current month second, after last month, and the current month's heading is underlined in red.

- To scroll to a quarter, select it in the strip above the table. To move a quarter at a time, use **‹** and **›**.
- The quarters in view are tinted, and the current one is underlined. The quarter you chose stays filled blue until you scroll somewhere else.
- From the keyboard, press Tab to reach the strip's quarters, and the arrow keys to move between them. Press Enter or Space to choose the quarter you're on.
- To go back to the current month, select **Today**, at the end of the strip.

The count after **Group by**, such as **Apr 2027: 137 people, 10 planned hires**, is for one month: the one you moved to, second in view, whose heading is filled blue. It counts the people working that month and the planned hires expected by then, and changes as you scroll.

While a filter, a search or a month's own filter narrows the rows, the count says how many of that month's people and planned hires are shown, such as **Apr 2027: 6 of 137 people**, leaving out planned hires when none are shown. The rows stay the same as you scroll, so someone who has left by the month counted stays listed but isn't counted. Someone listed under two groups is counted once.

You're done when the month you want is second in view.

### Group the Rows

The table starts as one list. To put the rows under headings:

1. Select **Group by**.
1. Choose **Manager** or **Feature team**, or, on **Allocations**, **Allocated to**.

To turn the headings round, select **Group by** again, and choose **Z to A**. The heading for none, such as **No manager**, then comes first.

To show one list again, choose **Clear grouping**, at the end of the menu, or **None** under **Group by**.

On **Allocations**, grouped by **Manager**, someone who changed manager has a row under each one, holding only the months they reported to them. Grouped by **Feature team**, someone has a row under each team they're on, and one under **No feature team** for any months they're on none. Each group ends with a total row.

Grouped by **Allocated to**, each feature or activity is a heading, an activity's naming its project or release, and someone has a row under each one they're allocated to, showing it alone; those allocated to nothing come last, under **Not allocated**. The heading reads its hours:

- **Effort:** its estimate.
- **Allocated:** the hours its allocations give it, after focus and ramp-up, each from its first month to the work's end: a feature's target cycle's last month, else its **Needed by**; an activity's **Needed by**, else its project's last milestone or its release's last cycle. For work with none of these, through this month.
- **Remaining:** Effort with the buffer the planning settings add, less Allocated. Past what it needs, it reads in red with a minus sign, such as **−6 h**. It reads **None** for done or cancelled work.

Work with no estimate reads **Allocated** alone.

**Allocated to** is offered to roles that see the planning settings, since the hours follow from them.

Each group ends with an **Allocated** row, the hours it's given each month. A row for one feature or activity holds part of someone's month, so it marks no **Over** or **Under**; the **Over** and **Under** choices still keep someone's rows by their whole month.

On **Feature teams**, someone on two feature teams has a row under each team. Grouped by **Manager**, each person is under the manager they report to today. **Manager** is offered only to roles that see Confidential data, since a later month's manager can be a reorganization not yet announced.

You're done when the rows show under the headings you chose.

### Find People

- To find people by name, type in the search box. You can also type a team's, a feature's or an activity's name, such as `Payments core`, `Checkout` or `Data migration`, to find everyone on it in any month.
- To filter one month by team, feature or activity, open that month's column menu, select **Filter…**, and pick them.
- To see only who is over or under, on **Allocations**, select **Views**, then **Over** or **Under**. They keep the rows **Over**, or **Under** or **Not allocated**, in the current month or any later month in the table.
- To see who is either over or under, choose both. To turn one off, select it again.
- To see only who is on some teams, features or activities in any month, select the button after the search box, and pick them. The button is **Feature teams** on the **Feature teams** tab, and **Allocations** on **Allocations**.
- To see who has none in any month, pick **No feature team** or **Not allocated** there.
- With teams, features or activities picked, the months you scroll to don't change the rows. To clear what you picked, select the **×** on its pill.

You're done when the table shows the people you're looking for.

### Keep a View of the Table

To come back to a tab as you've set it up, with its grouping and search, save it as a view. Each of **Feature teams** and **Allocations** has views of its own.

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

### Undo a Change

Press Cmd+Z on a Mac, or Ctrl+Z elsewhere, straight after the change, before you leave the page.

You're done when the cell shows its value from before the change.

## Marks and Terms

### In Feature Teams

- **A team in a cell** shows its name after a small square in its colour, or with no square when it has none. Point at a name to see all of it.
- **Shaded months** come before someone started or after they left.
- **Planned hires** have rows, but Capacity shows no teams for them, so their cells are empty.
- **No feature team**, when grouped by **Feature team**, heads the people who are on no team in all the months shown.
- **No manager**, when grouped by **Manager**, heads the people who report to nobody today.
- **A green dot before a team**, in the light green Live row under a drafted row, marks a team the draft takes away. With **Live only** chosen in the **Draft** menu, it marks each team a waiting draft would take away. Point at it to see the change.

### In Allocations

- **A line in a cell** names a feature or an activity, after a small square in its feature team's colour, and the share of the month it takes, such as **50%**. Point at the name to see all of it, with an activity's project or release, such as **General (Crane Control)**.
- **Over**, in red, ends a month whose allocations add up to more than 100%, with how much more at the right, such as **+25%**. **Under**, in red, ends one under 100%, with how much less, such as **−90%**.
- **Not allocated**, in red, ends a month with nothing allocated. A month at exactly 100% has no last line.
- **Over**, **Under** and **Not allocated** show from the current month on, and features and activities whose status means Possible don't count. Point at **Over** or **Under** to see the month's total.
- **Planned hires** have rows of their own, under their manager and under **No feature team**. One with no name shows its position and ID in grey, such as **SDET, TBD-5**. Months before one is expected are shaded.
- **Total, person-months**, in bold, ends each group, and **Organization, person-months** stays at the foot of the table. Grouped by **Allocated to**, an **Allocated** row ends each group, and **Allocated, all work** stays at the foot, both in hours.
- **A total**, such as **7.5 of 9**, is the person-months allocated that month, out of those available. The share is under it.
- Point at a total to see it in words. Totals count only the rows shown.
- **Someone on a feature team with nothing allocated** reads **Not allocated**, and counts as **0 of 1** in the totals. Being on a team doesn't allocate anyone to its features.
- **A green dot inside a line**, in the light green Live row under a drafted row, marks a feature or activity the draft takes off or changes. With **Live only** chosen in the **Draft** menu, it marks each one a waiting draft would change.
- **A dot before a feature's or activity's name** marks a draft renaming it, red once the rename is rejected. With **Drafts applied** chosen in the **Draft** menu, a rejected rename shows the name as it is. With **Live only**, every feature and activity shows its name as it is.
- **Allocations** is read only.

## Where Changes Go

A change to someone's teams is a draft of the team, and it's approved with the team's other changes. Each month the draft changes has the draft's dot before the team. See [Drafts](drafts.md).

Every change is recorded in the change history.
