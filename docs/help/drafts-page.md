# Drafts page

The **Drafts** page, under **History** in the left-hand menu, lists the drafts in a table, newest first. Here approvers approve or reject drafts, and you publish or discard your own changes a few at a time.

## What to Know First

- **Draft:** a change that waits for someone to approve it before it goes live. See [Drafts](drafts.md) for what happens to a draft, and what its marks mean.
- **Who sees what:** you see the drafts of what your role lets you see, such as the plan, features, people or configuration.
- **Tabs:** the page has up to three tabs beside its heading. Each tab shows how many drafts it holds.
  - **To decide** holds the drafts you can approve or reject now. Only roles that approve drafts have it.
  - **Not published** holds your own changes that you haven't published yet. Only roles that make changes have it.
  - **All drafts** holds every published draft, waiting or rejected. Everyone who opens the page has it, and nothing is decided here.
- **Where it opens:** the page opens on the first tab your role has.
- **Rows:** each row is one draft. **Record** names what it changes. **What changes** shows each value, such as a new site. **State** reads **Waiting**, **Rejected** or **Not published**. **Reason** says why a rejected draft was rejected.
- **Tick boxes:** you tick rows to act on several at once. The buttons for them show at the right of the page's heading, only while rows are ticked.

## Main Tasks

### Find a Draft

1. Select the tab that holds it. Rejected drafts, and drafts you can't decide, are under **All drafts**.
1. Type in the search box: a name, a value, or who made the draft.

To see only some drafts, such as the rejected ones, open the **State** column's menu and filter by **Rejected**. You can also group the rows, such as by **Area** or **Made by**, with **Group by**, and count them with **Metrics**, as on any table. You can save the way you've set up the table as a view, and the view keeps its tab. A shared view saved on a tab your role doesn't have opens on your first tab. See [Saved views](saved-views.md).

You're done when the draft's row shows.

### See a Draft's Details

1. Point at the draft's row.
1. Select the details button: the small box at the right of its **Record** cell.

The details open beside the table. They show the draft's columns, and the other drafts approving or rejecting it takes along. If you can't decide it now, a line says why, such as that it's back with whoever made it, to change and resubmit. **Show on** and the page's name, such as **Show on People**, opens the record on its own page, if your role opens that page.

To close the details, select the **×** at their top right, or press Esc.

You're done when the details show the draft's record at their top.

### Approve Drafts

1. Select **To decide**.
1. Tick each draft you want to approve. To tick every draft shown, tick the box before **Record** in the table's header.
1. Select the **Approve** button at the right of the page's heading. It names how many you ticked, such as **Approve 3 drafts…**.
1. Check the dialog. It lists any other drafts these depend on, which are approved with them.
1. Select **Approve**.

You can also approve one draft from its row's **⋯** menu, or with **Approve…** in its details.

You're done when the drafts leave **To decide**. They're live straight away.

### Reject Drafts

1. Select **To decide**.
1. Tick each draft you want to reject.
1. Select **Reject…** at the right of the page's heading.
1. Type the **Reason**.
1. Select **Reject**.

Drafts that use the ones you rejected are rejected with them. Each one goes back to whoever made it, with your reason.

You're done when the drafts leave **To decide**. They're under **All drafts**, with a red dot in a ring and your reason.

### Publish Some of Your Changes

**Publish** in the top bar publishes all your changes at once. To publish only some of them:

1. Select **Not published**.
1. Tick each change you want to publish. Changes that must go with it are ticked too. Point at a tick box to see which changes it's linked to.
1. Select the **Publish** button at the right of the page's heading. It names how many are ticked, such as **Publish 2 changes**.

Changes are linked when one uses another, such as a new choice in a new list, or when you made them in one step, such as filling a planned hire. If a linked change is hidden by your search or filter, you can't tick the change until you show it.

You're done when the changes leave **Not published**. They now wait for approval, under **All drafts**.

### Discard Some of Your Changes

1. Select **Not published**.
1. Tick each change you want to discard. Changes that must go with it are ticked too.
1. Select the **Discard** button at the right of the page's heading, such as **Discard 2 changes…**.
1. Select **Discard**. Discarding can't be undone.

You're done when the changes leave **Not published**. The records are back as they were.

## Marks and Terms

- **A dot** before a record's name marks its draft: yellow while it waits, hollow while it's your own unpublished change, and red in a ring once rejected. The rows have no other draft marks. See [Drafts](drafts.md#marks).
- **Waits on a rejected draft**, in a grey box after the name, means the draft depends on one that was rejected. It can't be decided until that one is resubmitted.
- **Needs another approver**, in a grey box after the name, marks a draft you changed yourself. Someone else must approve it, though you can still reject it. A role with **Approve own drafts**, such as the Engineering Director, can approve its own.
- **A greyed-out tick box** on **Not published** is on a change linked to one your search or filter hides.
- **Another approver needed** opens when your role can't decide every draft involved. When you approve, that's the drafts you ticked and those they depend on. When you reject, it's the drafts you ticked and those that use them. It also opens when you approve drafts that depend on one you changed yourself. Nothing is approved or rejected.

## Where Changes Go

Approved drafts go live at once. Approving and rejecting are recorded in the [change history](change-history.md), and so are your changes, once you publish them.
