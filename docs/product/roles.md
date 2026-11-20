# Fathom: Roles

**Last updated:** 2026-11-19

What each role can see, change and approve. A role is a set of permissions kept in Fathom, not fixed in its code, so a new feature adds permissions rather than roles. Fathom starts with one role for each persona. Roles can be edited, and copied to make new ones, within the [safeguards](#safeguards-for-administrators). The [Administration Pages](../design/pages/administration.md#roles) describe the Roles page.

## Starting Roles

- **Team Member:** Sees the plan and people's General details.
- **Product Manager:** Edits and approves the plan, features, releases, schedules and estimates, and sees people's General details and configuration.
- **Feature Lead:** Sees the plan and people's General details, edits features and estimates, and edits feature teams.
- **Project Manager:** Edits the plan, sees people with their Personal and Confidential data and the hiring plan, and approves drafts of everything the role sees, allocations and feature teams included.
- **Engineering Manager:** Edits the plan and allocations, sees people with their Personal and Confidential data, the hiring plan and configuration, and edits feature teams.
- **Engineering Director:** Edits and approves everything but administration, sees all Personal and Confidential data, classifies data, and sees accounts, roles, settings and the access history without changing them.
- **Workforce Administrator:** Held by Engineering Operations Managers. Sees the plan, maintains people, teams, reporting lines, feature teams, the hiring plan and configuration, sees all Personal and Confidential data, and classifies data. It stays apart from the Engineering Director so one person keeps the records and another approves them.
- **Executive:** Sees everything the Engineering Director does, without changing anything.
- **Administrator:** Manages accounts, roles and settings, and sees the access history, without access to the plan or people's data.

Personas are defined in the [Product Brief](brief.md#users). A person with two personas is given the role that grants more, or a role made for them that grants what both do.

## What Each Role Can Do

| Area | Team Member | Product Manager | Feature Lead | Project Manager | Engineering Manager | Engineering Director | Workforce Administrator | Executive | Administrator |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Plan: projects, proposals, milestones and customers | View | Edit, Approve | View | Edit, Approve | Edit | Edit, Approve | View | View | None |
| Features and releases, with estimates and the cycles each release includes | View | Edit, Approve | Edit | Edit, Approve | Edit | Edit, Approve | View | View | None |
| Schedules and their cycles | View | Edit, Approve | View | Edit, Approve | Edit | Edit, Approve | Edit | View | None |
| Allocations | View | View | None | View, Approve | Edit | Edit, Approve | View | View | None |
| People, teams, reporting lines and the org chart | View | View | View | View, Approve | View | Edit, Approve | Edit | View | None |
| Feature teams | View | View | Edit | View, Approve | Edit | Edit, Approve | Edit | View | None |
| Hiring plan | None | None | None | View, Approve | View | Edit, Approve | Edit | View | None |
| Configuration: lists, the columns added to People and Features, and the planning settings | None | View | None | View, Approve | View | Edit, Approve | Edit | View | None |
| Personal details | None | None | None | View | View | Edit | Edit | View | None |
| Confidential data | None | None | None | View | View | Edit | Edit | View | None |
| Classify data | None | None | None | None | None | Yes | Yes | None | None |
| Approve own drafts | None | None | None | None | None | Yes | None | None | None |
| Administration: accounts, roles, settings and the access history | None | None | None | None | None | View | None | View | Edit |

- **Edit includes View:** A role that may edit an area or class also views it, so nobody changes what they can't see.
- **Drafts and history:** A role sees the drafts and the change history of the data it sees. A project's or proposal's scope history comes with seeing the plan.
- **Plan and features:** Those who see the plan see the names of approved feature teams, to give features to them, without their members or leads. Everyone who sees the plan or features reads the planning settings' hours a day and working days, as the conversions between units of effort.
- **Choices:** Everyone who sees data drawn from a list sees the list's choices, without needing the Lists page.
- **Team colours:** Edit People sets each reporting team's colour, and Edit Feature teams sets each feature team's.

## Permissions

- **An action on an area:** Each permission is View, Edit or Approve on an area, as the grid above shows. Administration and the two classes have View and Edit only; Classify data and Approve own drafts stand alone. Each feature adds its areas to the one list, so a role grows by a row, not a new role.
- **Edit means drafting:** Edit makes drafts. The few changes that skip drafts are marked on their page.
- **Splitting a permission:** When an upgrade splits a permission into finer ones, every role that held it gets all of them, so nobody's access changes.

## Accounts and the Acting Role

- **Several roles:** An account holds one or more roles, starting or made later, one of them its default.
- **One role at a time:** A session acts as one role, and only that role's permissions apply; an account's roles never add up. A user's own drafts are those made under any of their roles, so switching never lets them approve their own.
- **Choosing the role:** Signing in acts as the role last chosen on that browser, or else the default. A user switches role from their account's menu without signing in again.
- **Naming the role:** Changes, drafts and approvals record the role they were made as, shown beside the name, such as "Feature Lead as Engineering Manager".
- **Your own account:** Every user, whatever their role, changes their own name and password from their account's menu. Their email address and roles stay with whoever manages accounts, since the email address signs them in.

## Approving

- **By area:** Each area with drafts has its own Approve. Rejecting a draft needs the same permission as approving it.
- **Seeing what a draft holds:** Approving never grants seeing. An Approver's role must see every detail a draft holds, so a draft with an end date needs a role that sees Personal data, and drafts of People's columns need one that sees people.
- **Drafts that use other drafts:** A draft may use drafts of another area. Approving a draft approves the drafts it uses, and rejecting a draft rejects the drafts that use it, so both need Approve on every area involved.
- **Your own drafts:** Someone else approves a user's drafts, unless the role holds Approve own drafts. That is one permission for every area, and it applies only where the role also holds Approve.
- **Schedules and cycle patterns:** Edited with Edit Plan or Edit Configuration, and approved with Approve Plan or Approve Configuration, so either Approver may decide them.

## Data Classes

The classes, and each built-in detail's default class, are set out in the [Domain Model](../design/domain-model.md#data-classes).

- **Apart from pages:** A role views a class on every page it reaches, without needing People, such as employment dates on the Allocations grid.
- **Pages that need a class:** A role without a page's classes doesn't get the page, mode or grouping, as [A page without its data](../standards/ui-conventions/drafts-and-values.md#access) sets out, and the Roles page lists what each role misses and why.
  - **Personal:** Allocations, Feature assignments, and People and the Org chart on other dates need it, so Team Members, Product Managers and Feature Leads don't get them. Product Managers see only Capacity's Settings mode.
  - **Confidential too:** the Org chart's reporting view on future dates, and grouping Feature assignments or Capacity's People by manager.
- **Classify data:** Moves built-in details, lists and columns between classes, the hiring plan included. It is one permission across every class, and a move needs View on both the class left and the class entered.
- **Lists and columns:** Making a list or column, or changing its name or description, needs Edit Configuration and sight of its class: View People for General (General values are people's details), View Personal details for Personal, and View Confidential data for Confidential. New lists and columns start General; giving one another class needs Classify data.

## Who Sees Which People

- **Who is listed:** People not started yet are hidden from roles that don't see Start date's class, so a start date isn't revealed early. People who have left are hidden from roles that don't see End date's class. Both are judged by the live dates while a draft waits, so a future end date shows nothing until it passes.
- **New employees:** A person may be added before their start date. Roles that see Personal data see them marked as not yet started. Other roles keep seeing the placeholder of the planned hire the person filled until the start date, even if it moves, and don't see a future starter who filled no hire. Until the person starts, those roles see none of their changes. Who fills a hire is shown only to roles that see Personal data, since it reveals a reporting line to come.
- **Changes of manager:** A change of manager is Personal in its draft and in the change history, since it names a past manager, so roles that see only General data see the new manager once the change is approved.
- **Other dates:** Feature teams and reporting lines on other dates need Personal data. Future reporting lines need Confidential data too, since future-dated reorganizations are Confidential. Anyone who edits feature teams may change them from a later date. Changing them from an earlier date also needs Edit on the class of what it changes (feature team dates or past managers), which is Personal unless moved.
- **Positions:** A role that can't see the Positions list's class can't add people, since each needs one. Removing a person, or drafting a change to their position, needs the right to change their position.
- **Not staffed:** Everyone who sees features sees whether one is [Not staffed](../design/domain-model.md#feature), though reading the allocations needs Personal data.

## Planned Hires in the Plan

- **Placeholders:** Everyone who sees people sees each planned hire not yet filled, and each filled one whose person hasn't started, as a placeholder: a row of People and a card under its manager on the Org chart. It shows its name, ID, position, state, manager, Expected month, and its values in the columns it shares with people, each at its column's class. Its name, ID, manager and Expected month are General; its position and state take the class of the Positions and Hiring states lists.
- **Expected:** A month, never a day, so the placeholder doesn't leak the exact date. How it is worked out is in the [Domain Model](../design/domain-model.md#planned-hires).
- **Counts:** Counts, such as reports per manager, follow what each reader sees, so each hire or new employee counts once.
- **The hiring plan:** View Hiring plan shows every planned hire with its target date, drafts and history, and needs View People. Edit Hiring plan adds, changes and removes planned hires, and needs Edit People. Both also need the hiring plan's class, Confidential unless moved; View Confidential data alone doesn't show it.
- **Target dates:** A hire's target date shows in the Start column to everyone who sees the hiring plan, since it is part of the plan, while people's start dates stay Personal.
- **States:** Whoever may change planned hires makes every move between hiring states.

## Releases

- **Releases:** Roles that edit features and releases make releases and choose which cycles each includes.
- **Schedules:** Roles with Edit Plan or Edit Configuration add, rename, retire, restore and end schedules, and change their cycle lengths and naming patterns.
- **Moving with cycles:** Changing a cycle's length moves the releases and features on the cycles that move. A role that changes schedules may do this without edit rights on releases or features. Only a role that may change cycles discards those drafts.

## Columns on Features and Saved Views

- **Columns on Features:** Added and changed with Edit Configuration, and approved with Approve Configuration. Removing one also needs Edit Features, since it removes features' values. Everyone who sees the plan gets the General lists these columns draw on, and sees drafts of the columns and who made them. Drafts of those lists are shown only to roles that see Lists or People.
- **Saved views:** Everyone who opens a table's page can save personal views. Sharing a view needs Edit Configuration, or Edit Administration on Accounts. Only a shared view's maker, or a role that may share views on that table, updates, renames or deletes it. Only the maker stops sharing it, and only while they may still share.

## Safeguards for Administrators

- **Edit Administration:** Managing accounts and editing roles are one permission. Whoever holds it gives any account any roles, their own included, so they can reach every role's access; the [access history](../security/security-plan.md#repudiation) is the safeguard. They manage their own account like any other.
- **Two guards:** No change to an account or role may leave no active account with Edit Administration, and nobody resets their own password from Accounts, since changing one's own password needs the current one.
- **No data for Administrators:** The Administrator role sees neither the plan nor people's data.
- **The first Administrator:** The install creates the Fathom Administrator account, holding the Administrator role, so no employee starts with full access. A person later given the Administrator role takes over from it, as [Securing Your Environment](../operations/securing-your-environment.md#accounts) sets out.
- **Changes take effect at once:** Changes to roles and to an account's roles are not drafts, since Approvers decide data, not who sees what. A second person's confirmation of changes granting Confidential data is deferred in [issue #8](https://github.com/ribbitworks/fathom/issues/8).
- **Updates never change grants:** An update never changes what an organization's roles grant. A changed starting role reaches an organization only when someone who may edit roles chooses Restore template and saves it, recorded like any change to a role. An update may add a new starting role, since it grants nothing until given to an account.
