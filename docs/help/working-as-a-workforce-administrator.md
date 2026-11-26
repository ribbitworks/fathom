# Working as a Workforce Administrator

As a Workforce Administrator, you keep Fathom's records: its people and planned hires, reporting lines, feature teams, lists, working time and schedules. You also choose who sees personal and confidential data. If Fathom is brand new, start with [Setting Up Fathom](setting-up-fathom.md).

## What to Know First

- **Drafts:** most of your changes are drafts. Nobody else sees them until you select **Publish** in the top bar. They go live once a Project Manager or the Engineering Director approves them.
- **Planned hires:** a planned hire is a job you plan to fill. Its **State** says where the hire stands, such as **Request to hire** or **Approved to hire**.
- **Feature teams:** a feature team is a group that works on features together, whoever its members report to.
- **Lists:** a list holds the choices a column offers, such as each site's name, so everyone's values are spelled the same way.

## Keep People Current

### Add a New Starter

1. On **People**, select **New person**.
1. In **State**, choose **Hired**.
1. Fill in the rest of the details, and select **Add**.
1. Select **Publish** in the top bar.

To add several at once, paste them in from a spreadsheet. See [People](people.md#add-a-person-or-a-planned-hire).

### Record Someone Leaving

1. On **People**, type the day they leave in the person's **End** cell. Don't remove them, so their row stays.
1. Select **Publish**.

Once that day has passed, they show as having left. See [People](people.md#remove-a-person-or-planned-hire).

### Give Someone a New Manager

1. If the new manager hasn't managed before, tick their **Manager?** on **People**.
1. Select **Publish** in the top bar, and wait for it to be approved.
1. On the person's row, choose their new **Manager**.
1. If the change took effect before today, type that day in **Manager assigned**.
1. Select **Publish**.

See [People](people.md#give-someone-a-new-manager).

## Plan the Hiring

A planned hire goes through three rounds, each published and approved before the next.

### Request a Hire

1. On **People**, select **New person**.
1. In **State**, choose **Request to hire**.
1. Fill in the rest of the details, and select **Add**.
1. Select **Publish**, and wait for the draft to be approved.

See [People](people.md#add-a-person-or-a-planned-hire).

### Mark a Hire Approved

1. Once the hire is agreed, change its **State** on **People** to **Approved to hire**.
1. Select **Publish**, and wait for the draft to be approved.

See [People](people.md#change-a-person).

### Fill a Hire

1. Once someone is hired, select **Fill** in the planned hire's **Name** cell.
1. Choose **New person**, or **Existing person** for someone already here.
1. Fill in the form, and select **Fill** under it.
1. Select **Publish**.

If the hire has allocations, remove them first, since Fathom doesn't move them to the person. See [People](people.md#fill-a-planned-hire).

## Staff the Feature Teams

### Put Someone on a Team From a Month

1. On **Capacity**, select **Feature teams**.
1. Select the person's cell in the month they move.
1. Press Delete to take them off their old team from that month.
1. Press Enter.
1. Type part of the new team's name, such as `Pay`.
1. Press Tab.
1. Select **Publish**.

The move starts on the first day of the month, or today for the current month. See [Capacity](capacity.md#put-someone-on-a-feature-team-from-a-month).

### Add, Rename or Remove a Team

On the **Org chart**, choose **Feature teams** in the switch beside the heading. Then:

- **To add a team:** open the **Feature teams** button's menu, and select **New feature team**. Fill in the panel, and select **Add**.
- **To rename or remove a team:** select the **Feature teams** button, and choose the team. In its panel, change its **Name**, or select **Remove feature team** at its foot.

Then select **Publish** in the top bar.

See [Org chart](org-chart.md#change-a-feature-team).

## Set Up the Choices People Pick From

Every change to a list is a draft, which goes live once someone whose role approves configuration approves it. A new list made with **New list** in a column's dialog on **Features** or **Activities**, and any change to it before it's approved, is approved by whoever approves features instead.

### Add Choices to a List

1. On **Lists**, select the list's name. Its choices open beside the table.
1. In the empty row at the end, type the choice's **Name**, and press Enter.
1. Select **Publish**.

To add many at once, paste one choice per line. See [Lists](lists.md#add-choices).

### Rename the Statuses Fathom Starts With

**Statuses**, **Proposal statuses** and **Hiring states** are built-in lists. Each choice has a meaning Fathom acts on, so you can call it whatever your organization does.

1. On **Lists**, open the list, such as **Hiring states**.
1. Select a choice, such as **Request to hire**.
1. Type its new name, and press Enter.
1. Select **Publish**.

See [Lists](lists.md#change-a-choice).

### Retire a Choice No Longer Used

1. In the list's panel, open the choice's **⋯** menu.
1. Select **Retire**.
1. Select **Publish**.

The choice stays on the records that hold it, but columns no longer offer it. See [Lists](lists.md#retire-or-remove-a-choice).

### Make a New List

1. On **Lists**, select **New list**.
1. Type the list's **Name**.
1. Choose its **Class**: **Personal** or **Confidential** if its values are private, or **General**.
1. Select **Create list**.
1. Add its choices.
1. Select **Publish**.

To use it on **People**, add a column that picks from it. See [Lists](lists.md#make-a-list).

## Set the Working Time and Cycles

### Set Hours and Working Days

1. On **Capacity**, select **Settings**.
1. Select the value of **Hours a day**, **Working days a week** or **Working days a month**.
1. Type the new value, and press Enter.
1. Select **Publish**.

Once it's approved, estimates on **Features** read differently in person-days, weeks and months. See [Capacity](capacity.md#change-a-setting).

### Set Ramp-Up for New Starters

Ramp-up is how much of their full output a new starter delivers in each of their first months.

1. On **Capacity**, in **Settings**, select **Add month** under **Ramp-up for new starters**.
1. Point at the new month, and select its pencil.
1. Type its share, such as `50`.
1. Select **Publish**.

To remove a month, select the **×** at the right of its row. See [Capacity](capacity.md#add-or-remove-a-month-of-ramp-up).

### Add a Schedule and Its Cycles

A schedule is a repeating set of cycles, such as one product line's quarters.

1. On **Releases**, select **Schedules**.
1. Select **New schedule**.
1. Type its **Name**, and select **Add schedule**.
1. In its panel, select the pencil beside **Name pattern**.
1. Type when the **First cycle starts**.
1. Type how long **Each cycle lasts**.
1. Select **Set up cycles**.
1. Select **Publish**.

See [Releases](releases.md#add-a-schedule).

## Choose Who Sees Personal and Confidential Data

A change of class takes effect straight away, with no draft and no **Undo**. It's recorded in the access history.

### See What Each Class Holds

1. Select the **Data classes** page, under **Administration**.
1. Read each row's class, and its **About**, which says where the data shows.

See [Data classes](data-classes.md#see-what-each-class-holds).

### Change a Class

1. On **Data classes**, select **Change class…** in the row.
1. Choose the class.
1. Select **Change**.

To go back, change the class again. See [Data classes](data-classes.md#change-a-class).

You're done when **People** shows everyone with their right manager and team, and nothing of yours is waiting for approval.
