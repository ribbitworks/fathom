# Fathom: Roles

**Last updated:** 2026-11-26

What each role can see, change and approve. The [Administration Pages](../design/pages/administration.md#roles) describe the Roles page.

- **Permissions, not code:** A role is a set of permissions kept in Fathom, not fixed in its code, so a new feature adds permissions rather than roles.
- **One role per persona:** Fathom starts with one role for each persona.
- **Changing roles:** Roles can be edited, and copied to make new ones, within the [safeguards](#safeguards-for-administrators).

## Starting Roles

- **Team Member:** Sees the plan and people's General details.
- **Product Manager:** Edits and approves the plan, features, releases, schedules and estimates, and sees people's General details and configuration.
- **Feature Lead:** Sees the plan and people's General details, edits features and estimates, and edits feature teams and which team each feature has.
- **Project Manager:** Edits the plan, sees people with their Personal and Confidential data and the hiring plan, and approves drafts of everything the role sees, allocations and feature teams included.
- **Engineering Manager:** Edits the plan and allocations, sees people with their Personal and Confidential data, the hiring plan and configuration, and edits feature teams and which team each feature has.
- **Engineering Director:** Edits and approves everything but administration, sees all Personal and Confidential data, classifies data, and sees accounts, roles, settings and the access history without changing them.
- **Workforce Administrator:** Held by Engineering Operations Managers. Sees the plan, maintains people, teams, reporting lines, feature teams, the hiring plan and configuration, sees all Personal and Confidential data, and classifies data. It stays apart from the Engineering Director so one person keeps the records and another approves them.
- **Executive:** Sees everything the Engineering Director does, without changing anything.
- **Administrator:** Manages accounts, roles and settings, and sees the access history, without access to the plan or people's data.

Personas are defined in the [Product Brief](brief.md#users). A person with two personas is given the role that grants more, or a role made for them that grants what both do.

## What Each Role Can Do

| Area | Team Member | Product Manager | Feature Lead | Project Manager | Engineering Manager | Engineering Director | Workforce Administrator | Executive | Administrator |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Plan: projects, proposals, milestones and customers | View | Edit, Approve | View | Edit, Approve | Edit | Edit, Approve | View | View | None |
| Features, activities and releases, with estimates, the cycles each release includes, and the columns added to Features and Activities | View | Edit, Approve | Edit | Edit, Approve | Edit | Edit, Approve | View | View | None |
| Schedules and their cycles | View | Edit, Approve | View | Edit, Approve | Edit | Edit, Approve | Edit | View | None |
| Allocations | View | View | None | View, Approve | Edit | Edit, Approve | View | View | None |
| People, teams, reporting lines, the org chart and the columns added to People | View | View | View | View, Approve | View | Edit, Approve | Edit | View | None |
| Feature teams | View | View | Edit | View, Approve | Edit | Edit, Approve | Edit | View | None |
| Hiring plan | None | None | None | View, Approve | View | Edit, Approve | Edit | View | None |
| Configuration: lists and the planning settings | None | View | None | View, Approve | View | Edit, Approve | Edit | View | None |
| Personal details | None | None | None | View | View | Edit | Edit | View | None |
| Confidential data | None | None | None | View | View | Edit | Edit | View | None |
| Classify data | None | None | None | None | None | Yes | Yes | None | None |
| Approve own drafts | None | None | None | None | None | Yes | None | None | None |
| Make private pages | None | Yes | Yes | Yes | Yes | Yes | Yes | None | None |
| Administration: accounts, roles, settings and the access history | None | None | None | None | None | View | None | View | Edit |

- **Edit includes View:** A role that may edit an area or class also views it, so nobody changes what they can't see.
- **Drafts and history:** A role sees the drafts and the change history of the data it sees. A project's or proposal's scope history comes with seeing the plan and features, since it lists features.
- **Records a change names:** The change history names a record a change links to, such as a project's feature, a feature's customer or the feature a proposal's removal reason is for, only to a role that sees its kind. Any other role is told only its kind, such as "A feature".
- **Plan and features:** Those who see the plan see the names of approved feature teams, to give features to them, without their members or leads. Everyone who sees the plan or features reads the planning settings' hours a day and working days, as the conversions between units of effort.
- **A feature's customers and commitments:** Which customers a feature is for, and which projects and proposals name it, are changed with Edit Plan, not Edit Features and releases, since they are the plan's call. So the Feature Lead sees them and doesn't change them.
- **A feature's feature team:** Which feature team a feature has is changed with Edit Feature teams, not Edit Features and releases alone, since those who edit feature teams decide who builds what. So the Product Manager and the Project Manager see it and don't change it.
- **Choices:** Everyone who sees data drawn from a list sees the list's choices, without needing the Lists page.
- **Lists made with a column:** Whoever sets up Features' or Activities' columns also drafts a new General list with a column, without Edit Configuration, as [A new list with a column](#columns-and-saved-views) sets out.
- **Team colours:** Edit People sets each reporting team's colour, and Edit Feature teams sets each feature team's.
- **Private pages:** Make private pages lets a person make pages of their own, each a table only they read; nobody else reads them, an Administrator included. Losing the permission hides a person's pages until it comes back. Their pages aren't built yet, so the Roles page doesn't show the permission until they are.
- **Exports:** Exporting needs no permission of its own: whoever opens a page exports what its table shows, so Product Managers export Features, and the [Plan](domain.md#planning-terms) once it is built.

## Permissions

- **An action on an area:** Each permission is View, Edit or Approve on an area, as the grid above shows. Administration and the two classes have View and Edit only; Classify data, Approve own drafts and Make private pages stand alone. Each feature adds its areas to the one list, so a role grows by a row, not a new role.
- **Edit means drafting:** Edit makes drafts. The few changes that skip drafts are marked on their page.
- **Splitting a permission:** When an upgrade splits a permission into finer ones, every role that held it gets all of them, so nobody's access changes.

## Accounts and the Acting Role

- **Several roles:** An account holds one or more roles, starting or made later, one of them its default.
- **One role at a time:** A session acts as one role, and only that role's permissions apply; an account's roles never add up. A user's own drafts are those made under any of their roles, so switching never lets them approve their own.
- **Publishing as the role in use:** Publishing publishes the changes made as the role in use, with whatever moved with them.
  - **Changes under another role:** A change made under another of the user's roles is published only if the role in use may make that kind of change. The rest stay unpublished, with the changes that go with them, for a role that may.
  - **Discarding:** Discarding takes back any of the user's own changes, whichever role made them, so nothing they made stays held.
- **Choosing the role:** Signing in acts as the role last chosen on that browser, or else the default. A user switches role from their account's menu without signing in again.
- **Naming the role:** Changes, drafts and approvals record the role they were made as, shown beside the name, such as "Feature Lead as Engineering Manager".
- **Your own account:** Every user, whatever their role, changes their own name and password from their account's menu. Their email address and roles stay with whoever manages accounts, since the email address signs them in.

## Approving

- **By area:** Each area with drafts has its own Approve. Rejecting a draft needs the same permission as approving it.
- **Columns:** A column's drafts are approved in its table's area, with the lists made with it, as [Columns and Saved Views](#columns-and-saved-views) sets out.
- **Seeing what a draft holds:** Approving never grants seeing. An Approver's role must see every detail a draft holds, so a draft with an end date needs a role that sees Personal data, and drafts of any column or list need one that sees people, since General values are people's details.
- **Drafts that use other drafts:** A draft may use drafts of another area. Approving a draft approves the drafts it uses, so it needs Approve on every area involved. A draft other drafts use is rejected only together with them, since rejecting it alone would leave them using a change that is going back to its maker.
- **Your own drafts:** Someone else approves a user's drafts, unless the role holds Approve own drafts. That is one permission for every area, and it applies only where the role also holds Approve.
- **Schedules and cycle patterns:** Edited with Edit Plan or Edit Configuration, and approved with Approve Plan or Approve Configuration, so either Approver may decide them.

## Data Classes

The classes, and each built-in detail's default class, are set out in the [Domain Model](../design/domain-model.md#data-classes).

- **Apart from pages:** A role views a class on every page it reaches, without needing People, such as employment dates on the Allocations grid.
- **Pages that need a class:** A role without a page's classes doesn't get the page, tab or grouping, as [A page without its data](../standards/ui-conventions/drafts-and-values.md#access) sets out, and the Roles page lists what each role misses and why.
  - **Personal:** Capacity's Feature teams and Allocations, and People and the Org chart on other dates need it, so Team Members, Product Managers and Feature Leads don't get them. Product Managers see only Capacity's Settings tab.
  - **Confidential too:** the Org chart's reporting view on future dates, and grouping Capacity's Feature teams or Allocations by manager.
  - **General versions:** Demand, the Plan, and On track or Late will have a General version for roles without Personal data, such as Product Managers and Team Members. It shows totals, with no names and no Personal details. Not built yet ([#209](https://github.com/ribbitworks/fathom/issues/209), [#204](https://github.com/ribbitworks/fathom/issues/204)).
- **Classify data:** Moves built-in details, lists and columns between classes, the hiring plan included. It is one permission across every class, and a move needs View on both the class left and the class entered.
- **Lists and columns:** Making or changing a list or column, a list's choices and their order included, and approving or rejecting their drafts, need sight of its class besides the permission that changes or approves it.
  - **The permission that changes or approves:** Edit or Approve Configuration for a list; for a column, Edit or Approve on its table's area. A new list drafted with a Features or Activities column takes only what the column takes, as [A new list with a column](#columns-and-saved-views) sets out.
  - **Sight of the class:** View People for General (General values are people's details), View Personal details for Personal, and View Confidential data for Confidential.
- **New lists and columns:** They start General; giving one another class needs Classify data.

## Who Sees Which People

- **Who is listed:** People not started yet, and people who have left, are hidden from roles that don't see both Start date's and End date's classes, so a start date isn't revealed early. Both are judged by the live dates while a draft waits, so a future end date shows nothing until it passes.
- **New employees:** A person may be added before their start date. Roles that see Personal data see them marked as not yet started.
  - **Other roles:** Other roles keep seeing the placeholder of the planned hire the person filled until the start date, even if it moves, and don't see a future starter who filled no hire. Until the person starts, those roles see none of their changes.
  - **Who fills a hire:** Shown only to roles that see Personal data, since it reveals a reporting line to come.
- **Owners:** Someone not started yet is offered as a project's or proposal's owner only to roles that see Personal data, as People lists them. To any other role, a project or proposal they own reads as having no owner, kept when that role saves it. A draft making them its owner is no change to that role, which can't approve or reject it, and the change history doesn't name them.
- **Changes of manager:** A change of manager is Personal in its draft and in the change history, since it names a past manager, so roles that see only General data see the new manager once the change is approved.
- **Other dates:** Feature teams and reporting lines on other dates need Personal data. Future reporting lines need Confidential data too, since future-dated reorganizations are Confidential.
  - **From a later date:** Anyone who edits feature teams and sees Personal data may change people on feature teams from a later date, so a Feature Lead changes them from today. A change dating only planned hires is the exception, under [Planned Hires in the Plan](#planned-hires-in-the-plan).
  - **From an earlier date:** Changing people on feature teams, and reporting lines, from an earlier date also needs Edit on the class of what it changes (feature team dates or past managers), which is Personal unless moved.
- **Positions:** A role that can't see the Positions list's class can't add people, since each needs one. Removing a person, or drafting a change to their position, needs the right to change their position.
- **Not staffed:** Everyone who sees features sees whether one is [Not staffed](../design/domain-model.md#feature), though reading the allocations needs Personal data.
- **The work an allocation names:** An allocation names its feature only to a role that sees features. A role that reads allocations but not features, which only an Administrator can make, is told only that it's a feature: on Capacity's Allocations, in drafts, in the change history and in a refusal.

## Planned Hires in the Plan

- **Placeholders:** Everyone who sees people sees each planned hire not yet filled, and each filled one whose person hasn't started, as a placeholder: a row of People and a card under its manager on the Org chart.
  - **What it shows:** Its name, ID, position, state, manager, Expected month, and its values in the columns it shares with people, each at its column's class.
  - **Classes:** Its name, ID, manager and Expected month are General; its position and state take the class of the Positions and Hiring states lists.
- **Feature teams:** Everyone who sees feature teams sees the planned hires on each, by name, or by ID when it has none, as they see people on them, since a hire's teams are General, as its manager is. Adding a hire to a team, taking it off, or making it the lead needs Edit Feature teams, as for a person.
  - **Its days:** A change dating only planned hires, such as adding hires or one hire taking over from another as the lead, is General, since it reveals no person's Personal details. Any role that edits feature teams chooses its day, earlier or later, and every reader of the team's draft sees it. Refusals name a hire's Expected month, never its target date, which stays in the hiring plan's class.
  - **With a person:** A change that also dates a person, such as adding a person and a hire from one day, or a hire taking over from a person as the lead, is a person's change: it needs Personal data, as above, and keeps every day it gives in Feature team dates' class, the hires' included.
- **Expected:** A month, never a day, so the placeholder doesn't leak the exact date. How it is worked out is in the [Domain Model](../design/domain-model.md#planned-hires).
- **Counts:** Counts, such as reports per manager, follow what each reader sees, so each hire or new employee counts once.
- **The hiring plan:** View Hiring plan shows every planned hire with its target date, drafts and history, and needs View People. Edit Hiring plan adds, changes and removes planned hires, and needs Edit People. Both also need the hiring plan's class, Confidential unless moved; View Confidential data alone doesn't show it.
- **Target dates:** A hire's target date shows in the Start column to everyone who sees the hiring plan, since it is part of the plan, while people's start dates stay Personal.
- **States:** Whoever may change planned hires makes every move between hiring states.

## Releases

- **Releases:** Roles that edit features and releases make releases and choose which cycles each includes.
- **Activities:** Roles that edit features and releases add, change and remove activities, whether an activity belongs to a release or a project, so the Feature Lead edits a project's activities as it edits the features the project needs.
- **Schedules:** Roles with Edit Plan or Edit Configuration add, rename, retire, restore and end schedules, and change their cycle lengths and naming patterns.
- **Moving with cycles:** Changing a cycle's length moves the releases and features on the cycles that move. A role that changes schedules may do this without edit rights on releases or features. Only a role that may change cycles discards those drafts.

## Columns and Saved Views

- **A table's columns go with its records:** Whoever edits a table's records, and sees people, adds, changes and removes its columns: Edit Features and releases for Features' and Activities' columns, Edit People for People's. Seeing people is what General lists and columns take, as Lists and columns sets out.
- **A table's columns are approved in its area:** Approve Features and releases approves Features' and Activities' columns, and Approve People approves People's. Approve Configuration approves none.
- **Columns on Features and Activities:** Everyone who edits features adds them, the Product Manager included. Everyone who sees the plan gets the General lists these columns draw on, and sees drafts of the columns and who made them. Drafts of those lists are shown only to roles that see Lists or People.
- **Filling a new column on Features or Activities:** Whoever edits features may give a feature or an activity a value in a column only drafted to be added, as on People.
  - **Approving:** approving the feature or activity approves the column with it, which Approve Features and releases decides too.
  - **A new choice made on Lists:** a feature or activity given a choice only drafted to be added on Lists also needs Approve Configuration for it. A role holding only one, such as the Product Manager, is refused, and another approver decides both.
- **A new list with a column:** New list, in a Features or Activities column's dialog, drafts a General list and its choices with the column, so whoever sets up those columns makes the lists they need, without Edit Configuration.
  - **Deciding:** whoever decides the column decides the list and its choices, alone or with it, while the list is only drafted to be added. A choice added to it on Lists, or a change to it there, is decided the same way, so one list has one Approver.
  - **Undoing and discarding:** the list is undone with the column, and discarded with the last column drawing on it, whether the one it was made with or another since, unless anything changed it since it was made. Rejecting the column alone leaves the list waiting; discarding the rejected column discards the list with it.
  - **Lists made on Lists:** Lists for People's columns are made on Lists. A list made on Lists stays with Approve Configuration, even when a Features column draws on it.
- **Saved views:** Everyone who opens a table's page can save personal views.
  - **Sharing:** Sharing a view on a table needs Edit on the area whose records the table holds:
    - **People and the Org chart:** Edit People.
    - **Features and Releases:** Edit Features and releases.
    - **Projects' tabs:** Edit Plan.
    - **Schedules and their cycles:** Edit Plan or Edit Configuration, as they are edited.
    - **Capacity:** Edit Allocations on its Allocations, and Edit Feature teams on its Feature teams.
    - **Accounts:** Edit Administration.
    - **Lists and Drafts:** Edit Configuration.
  - **Changing a shared view:** Only a shared view's maker, or a role that may share views on that table, updates, renames or deletes it. Only the maker stops sharing it, and only while they may still share.

## Setting Up the Plan's Tables

Whoever edits a table's records sets the table up, and whoever approves them approves its columns (owner, 2026-11-23), so there is no permission of its own; [Columns and Saved Views](#columns-and-saved-views) sets out what is built. The rest is not built yet ([#13](https://github.com/ribbitworks/fathom/issues/13)). Until it is, the rules for schedules under [Approving](#approving) and [Releases](#releases) hold. Then:

- **Schedules:** Schedules and cycle lengths become the plan's alone, edited with Edit Plan and approved with Approve Plan, so Edit Configuration and Approve Configuration no longer change them.

## Safeguards for Administrators

- **Edit Administration:** Managing accounts and editing roles are one permission. Whoever holds it gives any account any roles, their own included, so they can reach every role's access; the [access history](../security/security-plan.md#repudiation) is the safeguard. They manage their own account like any other.
- **Two guards:** No change to an account or role may leave no active account with Edit Administration, and nobody resets their own password from Accounts, since changing one's own password needs the current one.
- **No data for Administrators:** The Administrator role sees neither the plan nor people's data.
- **The first Administrator:** The install creates the Fathom Administrator account, holding the Administrator role, so no employee starts with full access. A person later given the Administrator role takes over from it, as [Securing Your Environment](../operations/securing-your-environment.md#accounts) sets out.
- **Changes take effect at once:** Changes to roles and to an account's roles are not drafts, since Approvers decide data, not who sees what. A second person's confirmation of changes granting Confidential data is deferred in [issue #8](https://github.com/ribbitworks/fathom/issues/8).
- **Updates never change grants:** An update never changes what an organization's roles grant. A changed starting role reaches an organization only when someone who may edit roles chooses Restore template and saves it, recorded like any change to a role. An update may add a new starting role, since it grants nothing until given to an account.
  - **One exception before the first release:** The migration that adds Make private pages also grants it to the six starting roles that make pages, as an earlier one granted View Confidential data to Project Managers and Engineering Managers. A new database's starting roles come from the migrations, and nothing is converted, since databases are reset rather than upgraded until the first release.
