# People

People lists everyone in the organization, one row each, and the planned hires beside them. It holds each person's position, manager, team, dates and any columns the organization adds. The table works like a spreadsheet.

## Main Tasks

### Add a Person or a Planned Hire

1. Select **New**.
1. Choose the **State**.
1. Fill in the rest, then select **Add**.

**Hired** or **Left** adds a person, and a hiring state, such as **Request to hire**, adds a planned hire.

To add many quickly, type in the empty row at the end of the table and press Enter after each. Rows copied from a spreadsheet can be pasted there too.

### Change a Person

1. Select a cell, then type, or press Enter, to change it.
1. Press Enter to save, or Esc to leave it as it was.

To work in a person's details instead, point at the row and select the button at the right of the **Name** cell, or select **Show details** in the row's **⋯** menu. Each value there has a pencil that changes it.

### Give Someone a New Manager

1. Choose the manager in **Manager**.
1. To date the change earlier than today, type the day in **Manager assigned**.

**Team** follows from the manager. A manager names their own team in **Team name**, on their own row.

### Fill a Planned Hire

1. Select **Fill** in the planned hire's **Name** cell.
1. Choose **New person** to add someone new, or **Existing person** to move someone already here.
1. Fill in the form, then select **Fill**.

**Fill** shows only on a planned hire in an approved state, such as **Approved to hire**, with no rejected draft. The person takes the hire's place once the fill is approved, along with its allocations.

### Add a Column

1. Select **New column**.
1. Type the **Name**, and choose the **Type**: **Choice from a list**, **Web link**, **Note** or **Number**.
1. If the role may classify data, choose the **Class** of a **Web link**, **Note** or **Number** column. A choice column takes its list's class.
1. Select **Add column**.

To change or delete a column, open its column menu and select **Edit column** or **Delete column**. A role that may classify data changes an approved column's class with **Change class…** in the same menu, at once and with no draft, as [Data classes](data-classes.md) explains.

### Write a Note

Select a cell in a **Note** column, and press Enter. The note opens beside the table. Write it, then select **Save**.

### Count People

Select **Metrics**, then choose a column under **Break down by**. Choose a second column under **and by** to cross the two. The figures count only the rows shown.

### Remove a Person or Planned Hire

Select **Remove person** or **Remove planned hire** in the row's **⋯** menu. Fathom refuses while any of their allocations has a draft. A person who leaves the organization keeps their row: give them an **End** date instead.

## Marks and Terms

- **State** says whether a row is a person, **Hired** or **Left**, or a planned hire, in one of the organization's hiring states.
- **A planned hire with no name** shows its position and ID in grey, such as **SDET, TBD-5**. **TBD-** and a number is a temporary ID, until the hire has its own.
- **Expected** gives the month a planned hire is expected.
- **Manager?** is ticked for those who can be someone's manager.
- **A red Left box** after a manager's name means they've left, with people still reporting to them.
- **A lock with Personal or Confidential**, in a grey box after a column's heading, gives its class: only roles that see that class see the column.
- **A value in red** can't be saved as it is. Point at the row's dot to see why.

## Where Changes Go

Every change to people, planned hires and columns is a draft, apart from changing a column's class. It goes live once an approver approves it. See [Drafts](drafts.md).
