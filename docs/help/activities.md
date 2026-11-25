# Activities

**Activities** lists the work your releases and projects need that isn't a feature, one row each, such as release testing, data migration or operator training.

## What to Know First

- **An activity:** work that needs staffing but isn't part of the product, such as testing a release or moving a customer's data. It belongs to exactly one release or one project.
- **Release and Project:** each activity has one of the two filled in. The other stays empty.
- **Like a feature:** an activity has a status, priority, size, risk, **Needed by**, effort and feature team, as a feature does, but no target cycle. Its release or project says when it happens.
- **Drafts:** every change you make here is a draft. Nobody else sees it until you select **Publish** in the top bar. A hollow dot marks a change you haven't published yet.
- **Approval:** a draft goes live once someone whose role approves features and releases approves it on the **Drafts** page.

See [Drafts](drafts.md) for more.

## Main Tasks

### Add an Activity

1. Select **New activity**.
1. Type the activity's **Name**.
1. Choose its **Release** or its **Project**, but not both.
1. Fill in anything else you know.
1. Select **Add**.

If you choose neither, Fathom says "Choose a release or a project" under **Release**, and adds nothing.

You're done when the activity shows in the table with a hollow dot.

### Change an Activity

1. Select the cell you want to change.
1. Start typing, or press Enter.
1. Press Enter to keep the change, or Esc to leave the value as it was.

You can also make changes in an activity's details, which open beside the table:

1. Point at the activity's row.
1. Select the details button: the small box at the right of its **Name** cell.
1. Select the value you want to change.

### Move an Activity

An activity can move to another release or project, such as when a migration moves from one project to another.

1. Select the activity's **Release** or **Project** cell.
1. Press Enter, and choose the release or project it moves to.
1. Press Enter.

Choosing a release clears its project, and choosing a project clears its release. You're done when the new release or project shows in the row, with a hollow dot.

### Find Activities

- Type in **Search** to find activities with every word you type.
- Choose **Release** or **Project** in **Group by** to see each one's activities together.

See [Saved views](saved-views.md) to keep a view you use often.

### Add a Column

You can add your own columns to Activities if your role edits features and sees people, as the Product Manager's does. They're Activities' own, apart from the columns on Features.

1. Select **New column**, at the right of the page's heading.
1. Type the column's **Name**.
1. Choose its **Type**: **Choice from a list**, **Web link**, **Note** or **Number**.
1. If you chose **Choice from a list**, choose a list. Only lists whose class is **General** are offered, since everyone who sees activities sees these columns.
1. Select **Add column**.

You're done when the new column shows in the table, with a hollow dot until you publish it.

### Count Activities

1. Select **Metrics**. The **Metrics** panel opens beside the table.
1. Under **Break down by**, choose the column to count by, such as **Release**.

You're done when the panel shows how many activities hold each value of the column you chose.

### Export Activities

1. Select the **Export** button at the right of the page's heading. Its icon is an arrow pointing down to a line.
1. Choose **CSV file** or **TSV file**.
1. Choose where to save it, if your browser asks.

The file holds what the table shows. You're done when the file is saved. See [People](people.md#export-people) for what the file holds.

### Remove an Activity

1. Open the activity's **⋯** menu.
1. Select **Remove activity**.

Fathom won't remove an activity once people are allocated to it, since that time was spent. Choose a status that means Cancelled instead.

You're done when the row is struck through. It's removed once the removal is approved.

## Marks and Terms

- **Release** names a release with its schedule, such as **Platform: Harbor 1**.
- **Project** names a project with its Project ID first, if it has one, such as **P-2001 Crane Control**.
- **None**, in **Release** or **Project**, means the activity belongs to the other one.
- **No team**, in red in the **Feature team** cell, marks a planned or in-progress activity that has no feature team yet.
- **Status** says how far along the activity is, from the same statuses features use, which are named on the **Lists** page. A new activity starts on the first status that means Possible.
- **Effort** is the work the activity needs, such as 2.5 PD for person-days. Point at it to see the hours.
