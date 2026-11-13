# People

People lists everyone in the organization, one row each, and the planned hires beside them. It holds each person's position, manager, team, dates and any columns the organization adds. The table works like a spreadsheet.

## Main Tasks

### Add a Person or a Planned Hire

1. Select **New**.
1. Choose the **State**.
1. Fill in the rest, then select **Add**.

**Hired** or **Left** adds a person, and a hiring state, such as **Request to hire**, adds a planned hire.

To add many quickly, type in the empty row at the end of the table and press Enter after each.

You can also paste rows copied from a spreadsheet. Put the spreadsheet's columns in the same order as the table's, from **Name** across, and make each value that comes from a list match a choice's name. Capitals and spaces at either end don't matter. Then select the **Name** cell of the empty row, and paste.

### Change a Person

1. Select a cell, then type, or press Enter, to change it.
1. Press Enter to save, or Esc to leave it as it was.

To work in a person's details instead, point at the row and select the button at the right of the **Name** cell, or select **Show details** in the row's **⋯** menu. Each value there has a pencil that changes it.

### Give Someone a New Manager

Fathom only lets you choose someone as a manager once their **Manager?** tick is approved. For someone new to managing, tick **Manager?** on their row, select **Publish**, and have it approved first. See [Drafts](drafts.md). Then:

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

### Export People

1. Choose the **Export** button, the arrow down onto a line, at the right of the page's heading.
1. Choose **CSV file** or **TSV file**.
1. Choose where to save it, if the browser asks.

The file holds what the table shows: the rows the search and filters leave, in their order, and the columns in theirs. While drafts show beside live, each changed row comes as its draft and then its live row, and the **Row** column says which, so a spreadsheet's filter can leave out either; the **Change** column says what each draft does. The file is named after the page, the saved view, who exported it and the day, such as **fathom_people_engineering-director_drafts-and-live_2027-03-31.csv**.

A file holding Personal or Confidential data, such as start dates or planned hires, asks first, naming what it holds. Once **Export** is chosen, the export is recorded in the access history.

### Remove a Person or Planned Hire

Select **Remove person** or **Remove planned hire** in the row's **⋯** menu. Fathom refuses while any of their allocations has a draft. A person who leaves the organization keeps their row: give them an **End** date instead.

## Marks and Terms

- **State** says whether a row is a person, **Hired** or **Left**, or a planned hire, in one of the organization's hiring states.
- **A planned hire with no name** shows its position and ID in grey, such as **SDET, TBD-5**. **TBD-** and a number is a temporary ID, until the hire has its own.
- **Expected** gives the month a planned hire is expected.
- **A planned hire's Start** is the date it's planned to start. You see it, and the hire's drafts, only if your role sees the hiring plan and the class the hiring plan is kept in. Otherwise you see the hire's name, ID, position, state, manager and **Expected** month.
- **Manager?** is ticked for those who can be someone's manager.
- **A red Left box** after a manager's name means they've left, with people still reporting to them.
- **A lock with Personal or Confidential**, in a grey box after a column's heading, gives its class: only roles that see that class see the column.
- **A value in red** can't be saved as it is. Point at the row's dot to see why.

## Where Changes Go

Every change to people, planned hires and columns is a draft, apart from changing a column's class. It goes live once an approver approves it. See [Drafts](drafts.md).
