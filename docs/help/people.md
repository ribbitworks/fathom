# People

The **People** page lists everyone in your organization, one row each, with your planned hires beside them. A planned hire is a job you plan to fill. Each row holds the person's position, manager, team and dates, and any columns your organization adds. The table works much like a spreadsheet.

## What to Know First

- **State:** each row's **State** says what it is. **Hired** or **Left** means a person. A hiring state, such as **Request to hire**, means a planned hire. You can choose **Left** only once the person's **End** date has passed.
- **Lists:** many columns don't take free text. You pick the value from a list of choices instead, such as a position from the list of positions. You keep the lists on the **Lists** page.
- **Classes:** each list and column has a class, which decides who sees it. **General** is seen by everyone who can open the page. **Personal** is for people's private and HR details, and **Confidential** is for business data not yet announced; only roles allowed to see them do. A grey box with a lock and **Personal** or **Confidential** after a column's heading shows its class.
- **Drafts:** almost every change you make here is a draft. Nobody else sees it until you select **Publish** in the top bar, and it goes live once an approver approves it. A hollow dot marks a change you haven't published yet, and a yellow dot one that's waiting for approval. The one change that skips the draft is changing a column's class. See [Drafts](drafts.md).
- **Managers:** **Manager?** is ticked for each person others can report to. Each manager names their team in **Team name**, on their own row, and everyone who reports to them shows that team in **Team**.

## Main Tasks

### Add a Person or a Planned Hire

1. Select **New**.
1. Choose the **State**: **Hired** or **Left** for a person, or a hiring state for a planned hire.
1. Fill in the rest.
1. Select **Add**.

To add a lot of people quickly, type in the empty row at the end of the table, and press Enter after each one.

You can also paste rows from a spreadsheet:

1. Put the spreadsheet's columns in the same order as the table's, from **Name** across.
1. Make each value that comes from a list match one of its choices. Capitals and spaces at either end don't matter.
1. Select the **Name** cell of the empty row at the end of the table.
1. Paste.

### Change a Person

1. Select a cell.
1. Type, or press Enter, to change it.
1. Press Enter to save the change, or Esc to leave it as it was.

You can also work in a person's details beside the table. Point at their row, and select the button at the right of the **Name** cell, or select **Show details** in the row's **⋯** menu. To change a value there, select its pencil.

### Give Someone a New Manager

You can choose someone as a manager only once their **Manager?** tick is approved. For someone new to managing:

1. Tick **Manager?** on their row.
1. Select **Publish**.
1. Ask your approver to approve it on the **Drafts** page.

Once it's approved:

1. Choose the manager in **Manager**.
1. If the change happened before today, type the day it took effect in **Manager assigned**.

The person's **Team** then follows from their manager.

### Fill a Planned Hire

When you hire someone for a planned job, you fill the planned hire with them.

1. Select **Fill** in the planned hire's **Name** cell.
1. Choose **New person** to add someone new, or **Existing person** to move someone who's already here.
1. Fill in the form.
1. Select **Fill**.

You see **Fill** only once the hire is approved, such as **Approved to hire**, and only if none of its drafts was rejected. Once the fill is approved, the person takes the hire's place and takes over the work planned for it.

### Add a Column

1. Select **New column**.
1. Type the **Name**.
1. Choose the **Type**: **Choice from a list**, **Web link**, **Note** or **Number**.
1. If your role can set classes, choose the **Class** of a web link, note or number column. A column that picks from a list takes the list's class.
1. Select **Add column**.

### Change or Delete a Column

1. Open the column's menu from its heading.
1. Select **Edit column**.
1. Make the change.
1. Select **Save**.

To delete the column instead, select **Delete column** in the dialog.

If your role can set classes, you can also change an approved column's class with **Change class…** in the same menu. That change takes effect at once, with no draft. See [Data classes](data-classes.md).

### Write a Note

1. Select a cell in a **Note** column.
1. Press Enter. The note opens beside the table.
1. Write it.
1. Select **Save**.

### Count People

1. Select **Metrics**.
1. Choose a column under **Break down by** to count by it.
1. To count by two columns at once, choose the second under **and by**.

The figures count every row the table shows, planned hires included.

### Export People

1. Select the **Export** button, the one with an arrow pointing down to a line, at the right of the page's heading.
1. Choose **CSV file** or **TSV file**.
1. Choose where to save it, if your browser asks.

The file holds what the table shows, in the same order. Rows your search or filters hide are left out.

If the table shows drafts beside live, each changed row comes twice: the draft first, then the live row. The **Row** column says which is which, so a spreadsheet's filter can leave out either, and the **Change** column says what each draft does.

The file is named after the page, the saved view if one is applied, who exported it and the day, such as **fathom_people_engineering-director_drafts-and-live_2027-03-31.csv**.

If the file would hold Personal or Confidential data, such as start dates or planned hires, Fathom asks first, and names what it holds. Once you choose **Export**, the export is recorded in the access history, which roles that see administration can read.

### Remove a Person or Planned Hire

Select **Remove person** or **Remove planned hire** in the row's **⋯** menu. You can't remove them while any of their allocations, the time planned for them on each feature, has a draft.

When someone leaves the organization, don't remove them. Give them an **End** date instead, so their row stays.

## Marks and Terms

- **A planned hire with no name** shows its position and ID in grey, such as **SDET, TBD-5**. **TBD-** and a number is a temporary ID, until the hire has its own.
- **Expected** is the month you expect the hire to start.
- **A planned hire's Start** is the date it's planned to start. You see it, and the hire's drafts, only if your role may see the hiring plan, which holds your organization's planned hires, and the class it's kept in. Otherwise you see the hire's name, ID, position, state, manager and **Expected** month.
- **A red Left box** after a manager's name means they've left, and people still report to them.
- **A value in red** can't be saved as it is. Point at the row's dot to see why.
