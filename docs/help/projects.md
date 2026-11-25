# Projects

**Projects** holds the work delivered to customers, and what goes with it. Each kind of record has its own tab.

## What to Know First

- **Projects:** a project is work delivered to one or more customers. A project with no customers is an internal project.
- **Proposals:** a proposal is work offered or requested that may become a project, such as a bid or a customer's request.
- **Customers:** a customer is whoever a project's work is for. Each can have a short **Description** and **Notes**, which hold formatting, as a feature's do. The **Customers** tab also lists the **Projects** and **Proposals** that name each customer, and its **Features**: those that name it, and those its projects need or its proposals propose. Fathom works these out from the links, so you change them on the project, proposal or feature.
- **Milestones:** the dated points in a project, such as a delivery to the customer.
- **Features:** a project or proposal names the features it needs. Features are planned on the [Features](features.md) page.
- **Drafts:** every change you make here is a draft. Nobody else sees it until you select **Publish** in the top bar. A hollow dot marks a change you haven't published yet.
- **Approval:** a draft goes live once someone whose role approves the plan approves it on the **Drafts** page.

See [Drafts](drafts.md) for more.

## Main Tasks

### Add a Project, Proposal, Customer or Milestone

1. Select the **Projects**, **Proposals**, **Customers** or **Milestones** tab.
1. Select **New project**, **New proposal**, **New customer** or **New milestone**.
1. Fill in the form.
1. Select **Add**.

To add one quickly, type in the empty row at the end of the table.

You're done when the new row shows with a hollow dot.

### See a Record's Details

1. Point at the record's row.
1. Select the details button: the small box at the right of its **Name** cell.

You can also right-click the row and select **Show details**. The details open beside the table.

Each customer, proposal and feature named there is a link to its own details. Milestones have no details of their own.

A customer's details show its **Name**, **Description** and **Notes** under **Details**. Select **Show more** under a long note to read all of it in a panel of its own.

The record's key is under its name, small and grey. Select it to copy a link to the record, or the key itself. See [Keys and links](keys-and-links.md) for more.

### Change a Record

1. Select a cell and start typing, or select a value in the details.
1. Press Enter to keep the change, or Esc to leave the value as it was.

You're done when the changed value shows a hollow dot.

### Choose the Features a Project Needs

1. Select the project's **Features** cell, and press Enter.
1. Pick each feature the project needs. The list stays open after each one.
1. Press Enter again to finish.

Esc closes the list and drops the features you picked.

You choose a proposal's features the same way. The **Features** page shows the same links, in its **Projects** and **Proposals** columns.

You're done when the cell lists the features, with a hollow dot.

### Give a Reason for Removing a Feature From a Proposal

When you take a feature off a proposal, here or on **Features**, it happens straight away, as a draft. You can say why while the removal is still a draft.

1. Open the proposal's details.
1. Under **Scope history**, select the removal's row.
1. Type the reason.
1. Press Enter.

To leave no reason, empty the box before you press Enter. Esc leaves the reason as it was.

You're done when the reason shows on the removal's row.

### See How a Project's or Proposal's Scope Changed

Open its details. **Scope history**, at the end, lists each feature added or removed, newest first.

Each row has the day the change was drafted, and the reason for a removal, if there is one. A change still waiting for approval has a yellow dot before it.

### Add a Milestone to a Project

1. Open the project's details.
1. Select **Add milestone**.
1. Type the milestone's **Name**.
1. Type its **Date**.
1. If the customer receives something then, tick **Customer delivery**.
1. Select **Add milestone**.

You're done when the milestone shows in the project's details.

To change a milestone there, select **Edit…** in its **⋯** menu. To remove it, select **Remove milestone** in the same menu.

### Go From a Project to Its Milestones or Features

- To see a project's milestones, select **Show milestones** in the project's **⋯** menu, or beside the **Milestones** heading in its details. **Milestones** opens, showing only that project's.
- To see the features a project or proposal names, select **Show features** in its **⋯** menu. **Features** opens, showing only those features.
- To see every feature a customer gets or asks for, select **Show all features** in the customer's **⋯** menu. **Features** opens with a filter named for the customer, such as **For Bluefin Harbour Authority**. See [Features](features.md#see-a-customers-features) for more.
- To go from a milestone to its project, select **Show project** in the milestone's **⋯** menu. The project's details open.

You're done when the page shows what you chose.

### Count a Tab's Records

1. Select **Metrics**. The **Metrics** panel opens beside the table.
1. Under **Break down by**, choose the column to count by.
1. To count by two columns at once, choose the second under **and by**.

The counts include every row the table shows, so a search or a filter changes them. You're done when the panel shows how many records hold each value of the column you chose.

See [Features](features.md#count-features) for more.

### Export a Tab

Exporting saves the tab's table as a file you can open in a spreadsheet.

1. Select the **Export** button at the right of the page's heading. Its icon is an arrow pointing down to a line.
1. Choose **CSV file** or **TSV file**.
1. Choose where to save it, if your browser asks.

The file holds what the tab shows, and is named after the tab, such as **fathom_projects_project-manager_drafts-and-live_2027-03-31.csv** for the **Projects** tab. You're done when the file is saved.

See [People](people.md#export-people) for what the file holds.

### Remove a Record

1. Open the record's **⋯** menu.
1. Select **Remove** and the record's kind, such as **Remove project**.

The row is struck through until the removal is approved. A project takes its milestones with it.

While a project, proposal or feature names a customer, **Remove customer** is greyed out, with a line under it naming one of them, such as "P-2001 Crane Control names this customer." Take the customer off that record first.

Fathom won't remove a proposal that another record still names. It also won't remove a project once people are allocated to it.

You're done when the row is struck through.

## Marks and Terms

- **Project ID** and **Proposal ID** show dimmed before the name wherever a project or proposal is named, so you can tell apart records with similar names.
- **First milestone**, **Last milestone** and **Next delivery** are a project's dates, and they come from its milestones. **Next delivery** is the next milestone marked **Customer delivery**.
- **Status** is a proposal's status, such as Open, Won, Lost or Withdrawn. Any status can follow any other.
- **Owner** names the person who owns the project or proposal.
- **An internal project** has no customers. Nothing marks it.

## Where Changes Go

A change to the features a project needs is a draft of the project.
