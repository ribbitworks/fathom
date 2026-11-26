# People

The **People** page lists everyone, one row each, with your planned hires beside them. A planned hire is a job you plan to fill. Each row holds the person's position, manager, team and dates, and any columns added to it.

## What to Know First

- **Tables:** the page is a table, much like a spreadsheet. Each row is a person or a planned hire, and each column is one thing about them.
- **State:** each row's **State** says what the row is. **Hired** or **Left** means a person. A hiring state, such as **Request to hire**, means a planned hire.
- **Lists:** many columns don't take free text. You pick the value from a list instead, such as a position from the list of positions, so everyone's values are spelled the same way. The lists are kept on the **Lists** page.
- **Classes:** each list and column has a class, which decides who sees it. **General** is seen by everyone who can open the page.
  - **Personal** is for people's private and HR details, and **Confidential** is for business data not yet announced. Only roles allowed to see Personal or Confidential data see those columns.
  - A symbol before a column's name shows its class: an eye with a line through it for **Personal**, and a lock with a keyhole for **Confidential**. Point at it to see the class's name.
- **Drafts:** almost every change you make here is a draft. Nobody else sees it until you select **Publish** in the top bar. A hollow dot marks a change you haven't published yet, and a yellow dot one that's waiting for approval.
- **Approval:** a draft goes live once an approver, such as a Project Manager or the Engineering Director, approves it on the **Drafts** page.
- **Managers:** **Manager?** is ticked for each person others can report to. A manager types their team's name in **Team name**, on their own row. Everyone who reports to them then shows that team in **Team**.
- **Feature teams:** if your role sees feature teams, **Feature teams** follows **Team** and names the teams each person is on, on the date the page shows. You can't change it here.
  - You change a team's members on the **Org chart**. See [Org chart](org-chart.md).

See [Drafts](drafts.md) for more.

## Main Tasks

### Add a Person or a Planned Hire

1. Select **New person**.
1. In **State**, choose **Hired** for a person, or a hiring state, such as **Request to hire**, for a planned hire.
1. Fill in the rest of the details, in the panel that opens beside the table.
1. Select **Add**, at the foot of the panel.

To add several people quickly, type each one in the empty row at the end of the table, and press Enter after each.

You can also paste rows in from a spreadsheet:

1. Put the spreadsheet's columns in the same order as the table's, from **Name** across.
1. Make each value that comes from a list match one of the list's choices. Capitals, and spaces at either end, don't matter.
1. Select the **Name** cell of the empty row at the end of the table.
1. Paste.

If a value fits more than one choice, such as the name of two managers, Fathom can't tell which you mean. It keeps that row unsaved, with the reason under it. Choose the value in the row's cell instead.

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
   - Each manager shows their position under their name, then the name of the team they're on, or who they report to if that team has no name. That way you can tell apart two people with the same name.
1. If the change happened before today, type the day it took effect in **Manager assigned**.
1. Select **Publish**, and ask your approver to approve it.

You're done once it's approved. The person's **Team** then shows their new manager's team.

### See Another Date

People can show another day, in the past or the future. Your role needs to see Personal data for past days, and Confidential data for future ones.

1. In the date row above the table, type a day in **Date**. You can also select an arrow to move a month, or drag the timeline.
1. To come back to today, select **Today**.

The count above the table names the day it counts, such as "137 people and 10 planned hires on Nov 20, 2026".

On another day, the table lists the people employed then, with their managers and teams as they were, or will be. A person's details beside the table show them as on that day.

A future day also lists every planned hire not yet filled. A past day lists none, since past plans aren't kept.

On a past day, you can change someone's manager in **Manager**, from the day shown, if your role changes Personal details. Everything else is changed on today. Otherwise, nothing can be changed on another day, and the table shows people as they're approved.

You're done when the table shows the day you chose.

### See Someone's Timeline

A person's timeline lists the days something about them changed, or will: the planned hire they filled, their start, each new manager, the feature teams they joined, led and left, and their end. Your role needs to see start and end dates.

1. Open the person's details. The **Timeline** section at the end shows the next change to come and the latest.
1. Select **Show timeline**. The timeline opens under the details, newest first, with planned days above the red **Today** line.
1. To see People on one of its days, select its date. Your role needs to see other days, and later days for a date still to come.

On a day someone isn't employed, such as after they've left, their details say so, then end with the **Timeline** section, as anyone's do. A timeline already open stays open.

You're done when the timeline shows the person's days.

### Fill a Planned Hire

When you hire someone for a planned job, you fill the planned hire with them. **Fill** shows once the hire's **State** is approved, such as **Approved to hire**, and the hire has no rejected draft. It doesn't show while a draft that adds the hire, or changes its manager, is still waiting.

Fathom doesn't move a planned hire's allocations to the person. An allocation is the time planned for someone on a feature. So if the hire has any, remove them first.

1. In the planned hire's **Name** cell, select **Fill**.
1. Choose **New person** to add someone new, or **Existing person** to move someone who's already here.
1. Fill in the form, which opens in the hire's details beside the table.
1. Select **Fill** under the form.
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
1. Select **Edit column…**.
1. Make your change.
1. Select **Save**.

To remove the column instead, select **Remove column** in the same menu, or in that dialog. It's removed as a draft, and you can undo it.

You're done when the column shows your change, with a hollow dot until you publish it.

If your role can set classes, the same menu also has **Change class…**, for a column that doesn't use a list. A column that uses a list always takes its list's class.

On an approved column, a change of class takes effect straight away, with no draft. On a new column that isn't approved yet, it changes the column's draft, and you can undo it. See [Data classes](data-classes.md).

### Write a Note

A **Note** column holds a short note for each person, with formatting such as bold and lists.

1. Select the person's cell in the **Note** column.
1. Press Enter. The note opens in a panel beside the table.
1. Write the note.
1. Select **Save**.

You're done when the cell shows the start of your note.

In a person's details, a long note shows only its first lines. Select **Show more** under it to read it all in its own panel. You can also open a note from the button at the right of its row, which shows when you point at the row.

A note stays open when you reload the page, whether you opened it from the details or from its cell, and a link to the page opens it for anyone who can see it. Anything you typed but didn't save is lost when you reload.

To give a note opened under the details the whole height, select **Maximize**, the button with four corners at its top right. Select **Restore**, in the same place, to bring the details back.

### Count People

1. Select **Metrics**. The **Metrics** panel opens beside the table.
1. Under **Break down by**, choose the column to count by.
1. To count by two columns at once, choose the second under **and by**.

The counts include every row the table shows, planned hires too. So a search or a filter changes them.

If the **Metrics** panel opens under another panel, such as a person's details, you can give it the whole height with **Maximize**, the button with four corners at its top right.

You're done when the panel shows how many rows hold each value of the column you chose.

### Group People

People starts as one list. You can put the rows under headings instead, such as one for each manager.

1. Select **Group by**, after **Metrics**.
1. Choose **Manager**, **Feature teams**, **Position**, **State**, or a column such as **Site**.

Grouped by manager, each heading names the manager, then their team's name if the team has one. People with no manager come last, under **No manager**. Each heading says how many people it holds.

Grouped by feature teams, someone on two teams shows under each, with a dimmed **+1** after their name. Point at it to see the other team. People on no team, and planned hires, come last, under **No feature team**.

To group each heading's rows again, such as each manager's people by site, select **Group by** again, and choose a column under **Then by**. The button then names both, such as **Group by: Manager, then Site**.

Each manager's heading then has a smaller heading for each site, with that site's people under it. A site with nobody under a manager has no heading there.

To turn the headings round, select **Group by** again, and choose the second order after the groupings, such as **Z to A** for managers, or **Reverse list order** for a list such as **Position**. The heading for none, such as **No manager**, then comes first. Choosing another grouping starts again with the first order.

To show one list again, choose **Clear grouping**, at the end of the menu, or **None** under **Group by**. Either clears **Then by** too.

Save a view to keep a grouping you use often. See [Saved views](saved-views.md).

You're done when the rows show under the headings you chose.

### Export People

Exporting saves the table as a file you can open in a spreadsheet.

1. Select the **Export** button at the right of the page's heading, before **New column** and **New person** if you have them. Its icon is an arrow pointing down to a line.
1. Choose **CSV file** or **TSV file**.
1. Choose where to save it, if your browser asks.

If the file would hold Personal or Confidential data, such as start dates or planned hires, Fathom asks first, and names what the file holds. Select **Export** to go ahead. That export is recorded in the access history, which roles that see administration can read.

The file holds what the table shows, in the same order. Rows that your search or filters hide are left out.

If the table shows **Drafts & Live**, each changed row comes twice, the draft first and then the live row. The **Draft** column says **Yes** on each draft row and is empty on the rest, so you can filter either out in a spreadsheet. The **Change** column says what each draft does.

The file is named after the page, the saved view if you applied one, who exported it, the drafts it holds, if any, and the day the table shows, such as **fathom_people_engineering-director_drafts-and-live_2027-03-31.csv**.

You're done when the file is saved.

### Remove a Person or Planned Hire

When someone leaves, don't remove them. Give them an **End** date instead, so their row stays.

Their **State** follows that date: once it has passed, they show as having left. A state that means Left is only for someone whose **End** date has passed.

To remove a row:

1. Open the row's **⋯** menu.
1. Select **Remove person** or **Remove planned hire**.

You're done when the row is struck through. It's removed once the removal is approved. The removal can't be approved while any of their allocations has a draft.

## Marks and Terms

- **A planned hire with no name** shows its position and ID in grey, such as **SDET, TBD-5**. **TBD-** and a number is a temporary ID, used until the hire has its own.
- **Expected** is the month the hire is expected to start, worked out from its **Start** date. You can't type it. It's empty for a hire with no **Start**, which is marked **Planned, no date**.
- **The hiring plan** holds the planned hires. Some roles may see it, and some may not.
- **A planned hire's Start** is the day it's planned to start. You see it, and the hire's drafts, only if your role may see the hiring plan. Otherwise you see the hire's name, ID, position, state, manager and **Expected** month.
- **A red Left box** after a manager's name means they've left, and people still report to them.
- **A value in red** can't be saved as it is. The reason shows under the row, in its first cell.
