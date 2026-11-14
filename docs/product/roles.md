# Fathom: Roles

**Status:** Starting roles, with open points marked **proposal**
**Last updated:** 2026-11-13

The roles Fathom starts with, for controlling what each user can see, edit, and approve, built on the access decisions in the [Decisions Log](decisions.md). Roles are editable sets of permissions, as the Decisions Log records, decided by the owner on 2026-11-04, so these are a starting set: they can be edited and copied to make new roles, within the safeguards below, and each keeps what it grants today until it is changed. An account holds one or more roles, any roles, starting or made later, one of them its default, and acts as one of them at a time: what a user may do reads from the role they act as alone, never from their roles added up. Signing in acts as the role last chosen on that browser, or else the default, and a user switches role from their account's menu, as the [Decisions Log](decisions.md#people-and-privacy) records, decided by the owner on 2026-11-07. There is one starting role for each persona, granting what that persona's roles granted together when accounts held several building-block roles, decided by the owner on 2026-11-06. The owner has confirmed that Engineering Managers and the Executive see Personal data, that the Engineering Director plans, and the split between planning the plan and planning allocations. Items marked **proposal** are not yet agreed.

## Starting Roles

- **Team Member:** Sees the plan and people's General details.
- **Product Manager:** Edits projects, proposals, features, milestones, releases, products, customers, and estimates across the whole plan, approves or rejects drafts of the plan and releases, and sees people's General details and configuration.
- **Feature Lead:** Sees the plan and people's General details, edits features and estimates, and proposes feature teams.
- **Project Manager:** Edits the plan, sees people with their Personal and Confidential data and the hiring plan, and approves or rejects drafts of the data the role sees, including allocations and feature teams.
- **Engineering Manager:** Edits the plan and allocations, sees people, with everyone's Personal and Confidential data, the hiring plan, and configuration, and proposes feature teams.
- **Engineering Director:** Edits and approves the plan, features, allocations, people, feature teams, the hiring plan, and configuration, sees all Personal and Confidential data and moves data between classes, and sees accounts, roles, settings, and the access history without changing them.
- **Workforce Administrator:** Sees the plan, maintains people, teams, reporting lines, feature teams, the hiring plan, and planning configuration, and sees all Personal and Confidential data and moves data between classes. Held by Engineering Operations Managers.
- **Executive:** Sees the plan, people, with their Personal and Confidential data and the hiring plan, configuration, accounts, roles, settings, and both histories, without changing them.
- **Administrator:** Manages user accounts, roles, and system settings, and sees the access history, without access to the plan or people's data.

## What Each Role Can Do

| Area | Team Member | Product Manager | Feature Lead | Project Manager | Engineering Manager | Engineering Director | Workforce Administrator | Executive | Administrator |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Plan: projects, proposals, milestones, and products and customers (**proposal**) | View | Edit | View | Edit | Edit | Edit | View | View | None |
| Features and releases: features and their estimates, with Edit Features apart from Edit Plan, decided by the owner on 2026-11-07, and releases and the cycles they include, one area since the owner's 2026-11-11 permissions | View | Edit | Edit | Edit | Edit | Edit | View | View | None |
| Allocations | View | View | None | View | Edit | Edit | View | View | None |
| People, teams, reporting lines, and the org chart (General), with Edit also choosing the colour each team is drawn in on the org chart, for every team until accounts are linked to people; Team Members and Product Managers see people since the org chart became part of People, decided by the owner on 2026-11-11 | View | View | View | View | View | Edit | Edit | View | None |
| Feature teams (General), changed as drafts: Edit adds, renames, and removes teams, changes their members and leads, from the days [Where feature teams are kept](decisions.md#workforce) allows, and chooses their colours | View | View | Edit | Approve | Edit | Edit and Approve | Edit | View | None |
| Personal employee details | None | None | None | View | View | Edit | Edit | View | None |
| Confidential data, seen by Project Managers and Engineering Managers since the owner's decision of 2026-11-13 | None | None | None | View | View | Edit | Edit | View | None |
| Classify data: moving built-in details, lists, and columns between the classes the role sees, as the [Decisions Log](decisions.md#people-and-privacy) sets out under Data classes, decided by the owner on 2026-11-11 | None | None | None | None | None | Edit | Edit | None | None |
| The hiring plan: every planned hire, with its target date, drafts, and history (decided by the owner on 2026-11-07), seen and changed only with its class too, Confidential unless the organization moves it, decided by the owner on 2026-11-13 | None | None | None | View | View | Edit | Edit | View | None |
| Planning configuration: release streams, their cycles and cycle names, seen by everyone who sees features and releases and changed as drafts approved with Approve Features, decided by the owner on 2026-11-09, and composition targets, with seeing them coming with seeing the plan (**proposal**) | View | View | View | View | View | Edit | Edit | View | None |
| The planning settings, on Capacity: hours a day and working days, which everyone who sees the plan or features reads as the conversions between units of effort, and focus, buffer and ramp-up, changed as drafts approved with Approve Configuration, and seen by Product Managers and Engineering Managers too, decided by the owner on 2026-11-11 | None | View | None | View | View | Edit | Edit | View | None |
| Lists of choices, and the columns added to People and Features (everyone with View Features and releases also sees the columns on Features and their values) | None | View lists | None | View lists, decided by the owner on 2026-11-01 | View lists | Edit | Edit | View lists | None |
| Draft rows of the data the role sees, made by editing it | View | Edit | Edit | Edit | Edit | Edit | Edit | View (**proposal**: none) | None |
| Approving drafts of the plan: projects, proposals, and the roadmap | None | Approve | None | Approve | None | Approve | None | None | None |
| Approving drafts of allocations (decided by the owner on 2026-11-09) | None | None | None | Approve | None | Approve | None | None | None |
| Approving drafts of features, releases, release streams, and cycle patterns, given to everyone who approved the plan or releases | None | Approve | None | Approve | None | Approve | None | None | None |
| Approving drafts of people, teams, and reporting lines | None | None | None | Approve | None | Approve | None | None | None |
| Approving drafts of planned hires | None | None | None | Approve | None | Approve | None | None | None |
| Approving drafts of lists of choices, of the columns added to People and Features, and of the planning settings | None | None | None | Approve | None | Approve | None | None | None |
| Approving drafts they changed themselves, in the areas they approve, which otherwise need another approver (decided by the owner on 2026-11-07) | None | None | None | None | None | Approve | None | None | None |
| Change history, for the data the role sees, seen with each area, decided by the owner on 2026-11-11 | View | View | View | View | View | View | View | View | None |
| Saved views of tables the role sees | Save personal views, and change their own | Save personal views, and change their own | Save personal views, and change their own | Save personal views, and change their own | Save personal views, and change their own | Save personal and shared views, share their own or take them back, and change their own and any shared view | Save personal and shared views, share their own or take them back, and change their own and any shared view | Save personal views, and change their own | None |
| Administration: user accounts and the role each holds, roles and what each grants, system settings, and the access history | None | None | None | None | None | View | None | View | Edit |

Of the starting roles, only the Engineering Director is to hold Export, in every area, as [A permission to export](decisions.md#people-and-privacy) sets out. Decided by the owner on 2026-11-12, and not built yet.

Allocations, Feature assignments, and People and the Org chart on other dates also need View on Personal details, and People and the Org chart's reporting view on future dates, and grouping Feature assignments and Capacity's People by manager, View on Confidential data too, as [Data classes](decisions.md#people-and-privacy) sets out. A role without them doesn't have a page that would show nothing, such as Feature assignments, or a mode, such as Capacity's People, and isn't offered a view or grouping it can't see, as [A page without its data](../design/conventions.md#access) sets out; the Org chart still says why in place of other dates, while People leaves its date row out. The Roles page lists what each role misses, and why.

Approving is granted area by area, and rejecting with it, as [Approving by area](decisions.md#people-and-privacy) records. Seeing data comes only from viewing permissions, never from approving. A user can approve only drafts whose values their role lets them see, so a draft holding a Personal detail, such as an end date, needs an Approver whose role also sees Personal data, such as the Engineering Director, and drafts of People's columns, and the values in them, need an Approver whose role sees people. Project Managers, who see people with their Personal and Confidential data and the hiring plan, approve drafts of people's details, Personal details included, of People's columns, and of planned hires, decided by the owner on 2026-11-07 and 2026-11-11, and can approve feature teams too, which the owner accepted on 2026-10-31.

**Proposal:** Seeing drafts is a permission of its own, like seeing the change history, so the Executive sees only approved data, and perhaps the Team Member too, as the owner suggested on 2026-11-11. Still open: whether the change history then leaves out edits to drafts for those who may not see drafts, and whether those who may not see drafts see Live only's green dots on what a waiting draft would change, or nothing of drafts at all. Until it is agreed, the Executive sees drafts, as every role that sees the data does.

The owner has decided that a role letting a user edit some data also lets them view it, so a Product Manager sees the plan and an Engineering Manager sees allocations without being granted to view them as well. Editing feature teams grants seeing them; those who see the plan also see the names of approved feature teams, to give features to them, without their members or leads. Every starting role but Administrator sees the plan, and every one but Administrator and Feature Lead holds View Allocations. Allocations, shown in Capacity's People mode, also need Personal data, as [Data classes](decisions.md#people-and-privacy) sets out, so Team Members don't have Capacity, and Product Managers see only its Settings mode. A project's and a proposal's scope history, read from the change history, comes with seeing the plan, with the rest of the change history for the areas the role sees.

Every starting role but Administrator sees people's General details, on People and the org chart, since the org chart became part of People, decided by the owner on 2026-11-11; Project Managers also see the hiring plan, decided by the owner on 2026-11-07. The choices of a list are seen by everyone who sees data drawn from it, such as People's columns, without seeing the Lists page.

## Custom Fields and Tables

Columns on Features are added and changed by the Product Manager and the Engineering Director, through a permission of their own, and no longer by the Workforce Administrator, nor by the Project Manager, Engineering Manager or Feature Lead, who edit features, as [Columns on Features](decisions.md#configuration) sets out. Decided by the owner on 2026-11-09, and not built yet: until it is, the table above holds.

**Proposal:** The Workforce Administrator defines custom fields on people, teams, and planned hires, and any custom field or table that links to people or holds personal information. Roles that edit the plan define other custom fields on the plan, such as on projects, and custom tables for reference lists. A user can assign a field or table only to a tier their own role lets them see. This waits for the [Roadmap](roadmap.md)'s stage for custom fields and tables.

## Releases

**Proposal:** Roles that edit the plan, such as Project Manager, make releases and choose which cycles each includes. The Workforce Administrator sets up release streams, their cycle lengths, and their naming patterns. Changing one cycle's length also moves the releases and features on cycles that move, which the Workforce Administrator may do without editing releases or features otherwise, as the [Decisions Log](decisions.md#planning) sets out.

## Access to Your Own Record and Your Reports

**Proposal:** Each person record holds the employee's work email address. When it matches a user account's email address, Fathom suggests linking the two, and an Administrator confirms the link, so a mistyped or reused address never grants access by itself. A linked user automatically sees, without editing, their own record and the records of everyone who currently reports to them, directly or through other managers, including Personal details; planned reporting changes grant nothing until they take effect. Access to anyone else's data still comes from the user's role, so the Engineering Manager role could then be narrowed from seeing Personal details for everyone. To stop an Administrator linking themselves to someone else's record, nobody confirms a link to their own account, changing a linked account's email address removes its link, and every link made or removed is recorded in the access history. The work email address is new personal data, brought to HR before it is added.

## Planned Hires in the Plan

**Decided:** A planned hire appears as a placeholder, while the [Decisions Log](decisions.md#workforce) says it shows one. Everyone who sees people sees it as a row of the People table, and with its manager's team, showing only its name, ID, position, state, manager, Expected month, and its values for the other columns it shares with people, such as site and level, each at its column's visibility; its name, ID, manager, and Expected month are General, and its position and state take the visibility of the Positions and Hiring states lists, which start General, decided by the owner on 2026-11-05, replacing the state being Confidential, decided on 2026-11-03. Everyone who sees the org chart sees it there as a placeholder under its manager, as the [Decisions Log](decisions.md#workforce) sets out. Team Members see it in the plan by its position, ID, and Expected month, or without its position if they cannot see the Positions list's visibility, as they see people by name, without the People table's details. Its exact target date, drafts, and history are seen only by the roles that grant View Hiring plan and see the hiring plan's class, as the [table above](#what-each-role-can-do) shows and the [Decisions Log](decisions.md#people-and-privacy) sets out, decided by the owner on 2026-11-07, replacing their being seen with Confidential data. This lets those who allocate see and allocate planned hires without seeing the hiring plan's details, decided by the owner on 2026-11-03; as rows of People, named by position and ID, decided by the owner on 2026-11-04.

## Safeguards for Administrators

**Decided:** Whoever may manage accounts, under any role that grants it, gives accounts their roles: any roles, their own account included. So any role that lets its holders manage accounts can reach every role's access, including editing roles and every tier of data; the access history, which marks each change to an account's roles as worth checking, is the safeguard. Managing accounts and editing roles are one permission, Edit Administration, since the 29 permissions. Those who may manage accounts manage their own account like any other: they can change its roles, default role, name, and email address, and deactivate it. Two guards remain: no change to an account or a role may leave no active account with Edit Administration, so no one can lock everyone out, and nobody resets their own password from the Accounts page, since changing one's own password needs the current one. A change granting Confidential data takes effect at once; a second person's confirmation is deferred in [issue #232](https://github.com/jlarue26/fathom/issues/232).

**Decided:** From the first deployment, a role's grants change only from within Fathom, never by an update, as **Migrations and roles' grants** in the [Decisions Log](decisions.md#platform-and-operations) sets out.

**Decided:** The first Administrator is the Fathom Administrator account, which the install creates, holding the Administrator role, as the [Decisions Log](decisions.md#people-and-privacy) records, decided by the owner on 2026-11-06; no person's account is. A person later given the Administrator role can take over from it.

**Proposal:** Every account created, change to an account's name, email address, or roles, sign-in and the role it starts as, switch of role, password reset, user's change of their own name or password, deactivation, and reactivation is recorded in the access history. Separation of duties applies to the Administrator role itself, which sees neither the plan nor people's data. While one person runs the Fathom Administrator account, these safeguards rely on the access history alone. Whoever may manage accounts can reach other roles' data by giving their own account another role and switching to it, or, with local passwords, by creating another account or resetting another user's password and signing in as them, and whoever may edit roles, by adding permissions to the role they hold; the access history is what reveals it.

## Roles by Persona

| Persona | Role |
| --- | --- |
| Product Manager | Product Manager |
| Project Manager | Project Manager |
| Engineering Manager | Engineering Manager |
| Feature Lead | Feature Lead |
| Engineering Director | Engineering Director |
| Engineering Operations Manager | Workforce Administrator |
| Executive | Executive |
| Team Member | Team Member |
| Fathom Administrator | Administrator |

Personas are defined in the [Product Brief](brief.md#users). A person with two personas, such as a Feature Lead who is also an Engineering Manager, is given the role that grants more, or a role made for them that grants what both do.

How Project Managers give input on whether teams are in place is an open question in the [Product Brief](brief.md), and may add to their role.

## First Stage

The first stage of the [Roadmap](roadmap.md) uses every starting role: Team Member, Product Manager, Feature Lead, Project Manager, Engineering Manager, Engineering Director, Workforce Administrator, Executive, and Administrator.
