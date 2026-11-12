# Feature assignments

Feature assignments shows everyone month by month, one row per person and a column for each month. **Teams** shows who is on which feature team each month, and **Allocations** shows what each person works on and how much of their month it takes. Allocations is to move to the [Capacity](capacity.md) page, as its People mode.

## Main Tasks

### Choose What the Table Shows

Select **Teams** or **Allocations** in the switch under the heading. The table opens at the current month. Scroll sideways for the 12 months before it and the 11 after.

### Group the Rows

1. Select **Group by**.
1. Choose **Manager**, **Feature team** or **None**.

Someone on two feature teams has a row under each. Someone who reported to two managers in the months shown has a row under each, holding only that manager's months.

### Find People

- Type in the search box to find people by name, or by a team in any month, such as **Payments core**.
- To filter one month by team, open the month's column menu, select **Filter…**, and pick the teams.

### Put Someone on a Feature Team From a Month

1. In **Teams**, select the person's cell in the month the change starts.
1. Press Enter. The team list opens.
1. Type part of the team's name, such as `Pay`, and press Tab.

The person is on the team from that month on. Press Delete in a cell to take its team away from that month on. The change starts on the first day of the month, or today in the current month.

### Change Several Members or a Team's Lead

Use the team's panel on the **Org chart**, under **Feature teams**. See [Org chart](org-chart.md).

## Marks and Terms

- **A team's label** names the team in its colour, or in grey when it has none. Point at a label to see the team's whole name.
- **Shaded months** come before someone started or after they left.
- **No feature team**, grouped by **Feature team**, heads the people on no team in those months.
- **A line in a cell**, in **Allocations**, names a feature and the share of the month it takes, such as **50%**. Point at the name to see all of it.
- **Total** under two or more features adds up their shares.
- **Over**, in red, marks a month whose allocations add up to more than 100%. **Under**, in grey, marks one under 100%. Both show from the current month on, and Possible features don't count.
- **Planned hires** have rows in **Allocations**. One with no name shows its position and ID in grey, such as **SDET, TBD-5**.
- **Total rows**, in bold, end each group, and **Organization** stays at the foot of the table. Each month reads the person-months allocated of those available, such as **7.5 of 9**, with the share under it. They count only the rows shown.
- **Allocations** is read only for now.

## Where Changes Go

A change to someone's teams is a draft of the team, approved with the team's other changes. Each month a draft changes has the draft's dot inside the team's label. See [Drafts](drafts.md).
