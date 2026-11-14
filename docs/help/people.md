# People

The **People** page lists everyone in your organization, one row each, with your planned hires beside them. A planned hire is a job you plan to fill. Each row holds the person's position, manager, team and dates, and any columns your organization adds.

## What to Know First

- **Tables:** the page is a table, much like a spreadsheet. Each row is a person or a planned hire, and each column is one thing about them.
- **State:** each row's **State** says what the row is. **Hired** or **Left** means a person. A hiring state, such as **Request to hire**, means a planned hire.
- **Lists:** many columns don't take free text. You pick the value from a list instead, such as a position from the list of positions, so everyone's values are spelled the same way. The lists are kept on the **Lists** page.
- **Classes:** each list and column has a class, which decides who sees it. **General** is seen by everyone who can open the page. **Personal** is for people's private and HR details, and **Confidential** is for business data not yet announced; only roles allowed to see them do. A grey box with a lock after a column's heading shows its class.
- **Drafts:** almost every change you make here is a draft. Nobody else sees it until you select **Publish** in the top bar. It goes live once an approver, such as a Project Manager or the Engineering Director, approves it on the **Drafts** page. A hollow dot marks a change you haven't published yet, and a yellow dot one that's waiting for approval.
- **Managers:** **Manager?** is ticked for each person others can report to. A manager types their team's name in **Team name**, on their own row. Everyone who reports to them then shows that team in **Team**.

See [Drafts](drafts.md) for more.

## Main Tasks

### Add a Person or a Planned Hire

1. Select **New**.
1. In **State**, choose **Hired** for a person, or a hiring state, such as **Request to hire**, for a planned hire.
1. Fill in the rest of the form.
1. Select **Add**.

To add several people quickly, type each one in the empty row at the end of the table, and press Enter after each.

You can also paste rows in from a spreadsheet:

1. Put the spreadsheet's columns in the same order as the table's, from **Name** across.
1. Make each value that comes from a list match one of the list's choices. Capitals, and spaces at either end, don't matter.
1. Select the **Name** cell of the empty row at the end of the table.
1. Paste.

You're done when the new rows show in the table, each with a hollow dot until you publish it.

### Change a Person

1. Select the cell you want to change.
1. Start typing, or press Enter.
1. Press Enter to keep the change, or Esc to leave the value as it was.

You can also make changes in a person's details, which open beside the table:

1. Point at the person's row.
1. Select the details button: the small box at the right of the **Name** cell.
1. Select the value you want to change.

Instead of the details button, you can also right-click the row and select **Show details**.

You're done when the changed value shows a hollow dot.

### Give Someone a New Manager

You can choose someone as a manager only once their **Manager?** tick is approved. So if they're new to managing, it takes two rounds.

First, make them a manager:

1. Tick **Manager?** on their row.
1. Select **Publish**.
1. Ask your approver to approve it on the **Drafts** page.

Once it's approved, give the person their new manager:

1. On the person's row, choose the manager in **Manager**.
1. If the change happened before today, type the day it took effect in **Manager assigned**.
1. Select **Publish**, and ask your approver to approve it.

You're done once it's approved. The person's **Team** then shows their new manager's team.

### Fill a Planned Hire

When you hire someone for a planned job, you fill the planned hire with them. **Fill** shows once the hire's **State** is approved, such as **Approved to hire**, and the hire has no rejected draft. It doesn't show while a draft that adds the hire, or changes its manager, is still waiting.

Fathom can't move a planned hire's allocations to the person yet. An allocation is the time planned for someone on a feature. So if the hire has any, remove them first.

1. In the planned hire's **Name** cell, select **Fill**.
1. Choose **New person** to add someone new, or **Existing person** to move someone who's already here.
1. Fill in the form.
1. Select **Fill**.
1. Select **Publish**, and ask your approver to approve it.

You're done once the fill is approved. The person then takes the hire's place.

### Add a Column

1. Select **New column**.
1. Type the column's **Name**.
1. Choose its **Type**: **Choice from a list**, **Web link**, **Note** or **Number**.
1. If you chose **Choice from a list**, choose the list. The column takes the list's class.
1. For any other type, choose the column's **Class**, if your role can set classes.
1. Select **Add column**.

You're done when the new column shows in the table, with a hollow dot until you publish it.

### Change or Remove a Column

1. Open the menu on the column's heading.
1. Select **Edit column**.
1. Make your change.
1. Select **Save**.

To remove the column instead, select **Remove column** in that dialog.

You're done when the column shows your change, with a hollow dot until you publish it.

If your role can set classes, the same menu also has **Change class…**, for an approved column that doesn't use a list. A column that uses a list always takes its list's class. A change of class takes effect straight away, with no draft. See [Data classes](data-classes.md).

### Write a Note

A **Note** column holds a short note for each person, with formatting such as bold and lists.

1. Select the person's cell in the **Note** column.
1. Press Enter. The note opens in a panel beside the table.
1. Write the note.
1. Select **Save**.

You're done when the cell shows the start of your note.

### Count People

1. Select **Metrics**.
1. Under **Break down by**, choose the column to count by.
1. To count by two columns at once, choose the second under **and by**.

The counts include every row the table shows, planned hires too. So a search or a filter changes them.

You're done when the counts show under the column you chose.

### Export People

Exporting saves the table as a file you can open in a spreadsheet.

1. Select the **Export** button at the right of the page's heading. Its icon is an arrow pointing down to a line.
1. Choose **CSV file** or **TSV file**.
1. Choose where to save it, if your browser asks.

If the file would hold Personal or Confidential data, such as start dates or planned hires, Fathom asks first, and names what the file holds. Select **Export** to go ahead. That export is recorded in the access history, which roles that see administration can read.

The file holds what the table shows, in the same order. Rows that your search or filters hide are left out. If the table shows drafts beside live, each changed row comes twice, the draft first and then the live row. The **Row** column says which is which, so you can filter out either one in a spreadsheet, and the **Change** column says what each draft does.

The file is named after the page, the saved view if you applied one, who exported it and the day, such as **fathom_people_engineering-director_drafts-and-live_2027-03-31.csv**.

You're done when the file is saved.

### Remove a Person or Planned Hire

When someone leaves the organization, don't remove them. Give them an **End** date instead, so their row stays. Their **State** follows that date: once it has passed, they show as having left. A state that means Left is only for someone whose **End** date has passed.

To remove a row:

1. Open the row's **⋯** menu.
1. Select **Remove person** or **Remove planned hire**.

You're done when the row is struck through. It's removed once the removal is approved. The removal can't be approved while any of their allocations has a draft.

## Marks and Terms

- **A planned hire with no name** shows its position and ID in grey, such as **SDET, TBD-5**. **TBD-** and a number is a temporary ID, used until the hire has its own.
- **Expected** is the month the hire is expected to start, worked out from its **Start** date. You can't type it.
- **The hiring plan** holds your organization's planned hires. Some roles may see it, and some may not.
- **A planned hire's Start** is the day it's planned to start. You see it, and the hire's drafts, only if your role may see the hiring plan. Otherwise you see the hire's name, ID, position, state, manager and **Expected** month.
- **A red Left box** after a manager's name means they've left, and people still report to them.
- **A value in red** can't be saved as it is. The reason shows under the row, in its first cell.
