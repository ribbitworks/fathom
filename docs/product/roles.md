# Fathom — Roles

**Status:** Starting roles, with open points marked **proposal**
**Last updated:** 2026-11-07

The roles Fathom starts with, for controlling what each user can see, edit, and approve, built on the access decisions in the [Decisions Log](decisions.md). Roles are editable sets of permissions, as the Decisions Log records, decided by the owner on 2026-11-04, so these are a starting set: they can be edited and copied to make new roles, within the safeguards below, and each keeps what it grants today until it is changed. Each account holds exactly one role, any role, starting or made later, so an account's access reads from that one role. There is one starting role for each persona, granting what that persona's roles granted together when an account could hold several, decided by the owner on 2026-11-06. The owner has confirmed that Engineering Managers and the Executive see Restricted data, that the Engineering Director plans, and the split between planning the plan and planning allocations. Items marked **proposal** are not yet agreed.

## Starting Roles

- **Team Member:** Sees the plan, including everyone's work assignments, and the org chart.
- **Product Manager:** Edits projects, proposals, features, milestones, releases, products, customers, and estimates across the whole plan, and approves or rejects drafts of the plan.
- **Feature Lead:** Sees the plan and people's General details, edits features, estimates, and allocations, and proposes feature teams.
- **Project Manager:** Edits the plan, sees people and the hiring plan, and approves or rejects drafts of the data the role sees, including feature teams.
- **Engineering Manager:** Edits the plan and allocations, sees people, with everyone's Restricted details, because people move between managers over time, and the hiring plan, colours teams on the org chart, and proposes feature teams.
- **Engineering Director:** Edits and approves the plan, features, allocations, people, feature teams, the hiring plan, and configuration, sees all Restricted and Confidential data, and sees accounts, roles, settings, and the access history without changing them.
- **Workforce Administrator:** Sees the plan, maintains people, teams, reporting lines, feature teams, the hiring plan, and planning configuration, and sees all Restricted and Confidential data. Held by Engineering Operations Managers.
- **Executive:** Sees the plan, people, with their Restricted and Confidential data and the hiring plan, configuration, accounts, roles, settings, and both histories, without changing them.
- **Resource Planner:** Sees the plan and people's General details, and edits allocations across the whole plan. No persona holds it by default; it shows what a reader who sees people without their Restricted details sees.
- **Administrator:** Manages user accounts, roles, and system settings, and sees the access history, without access to the plan or people's data.

## What Each Role Can Do

| Area | Team Member | Product Manager | Feature Lead | Project Manager | Engineering Manager | Engineering Director | Workforce Administrator | Executive | Resource Planner | Administrator |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Plan: projects, proposals, milestones, releases and the cycles they include (**proposal**), and products and customers (**proposal**) | View | Edit | View | Edit | Edit | Edit | View | View | View | None |
| Features and their estimates, with Edit Features apart from Edit Plan, decided by the owner on 2026-11-07 (not built yet) | View | Edit | Edit | Edit | Edit | Edit | View | View | View | None |
| Allocations | View | View | Edit | View | Edit | Edit | View | View | Edit | None |
| People, teams, and reporting lines (General) | None | None | View | View | View | Edit | Edit | View | View | None |
| The org chart: who reports to whom, with each person's name, position, and team; a card shows the person's details beside it only for those who see people | View | View | View | View | View | View | View | View | View | None |
| Teams' colours on the org chart, for every team until accounts are linked to people, then for Engineering Managers only the teams below them | None | None | None | None | Edit | Edit | Edit | None | None | None |
| Feature teams (General), with seeing them coming with seeing the plan (**proposal**) | View | View | Propose | Approve | Propose | Approve | Edit | View | View | None |
| Restricted employee details | None | None | None | None | View | Edit | Edit | View | None | None |
| Confidential data | None | None | None | None | None | Edit | Edit | View | None | None |
| The hiring plan: every planned hire, with its target date, drafts, and history (decided by the owner on 2026-11-07) | None | None | None | View | View | Edit | Edit | View | None | None |
| Planning configuration: release streams, their cycles and cycle names, estimate conversions (**proposal**), and composition targets, with seeing them coming with seeing the plan (**proposal**) | View | View | View | View | View | Edit | Edit | View | View | None |
| Lists of choices, and People's columns and their order | None | None | None | View lists, decided by the owner on 2026-11-01 | None | Edit | Edit | View lists | None | None |
| Draft rows of the data the role sees, made by editing it | View | Edit | Edit | Edit | Edit | Edit | Edit | View (**proposal**: none) | Edit | None |
| Approving drafts of the plan: features, projects, proposals, and the roadmap (not built yet) | None | Approve | None | Approve | None | Approve | None | None | None | None |
| Approving drafts of releases, release streams, and cycle patterns | None | None | None | Approve | None | Approve | None | None | None | None |
| Approving drafts of people, teams, and reporting lines | None | None | None | Approve | None | Approve | None | None | None | None |
| Approving drafts of planned hires | None | None | None | Approve | None | Approve | None | None | None | None |
| Approving drafts of lists of choices, and of People's columns and their order | None | None | None | Approve | None | Approve | None | None | None | None |
| Approving drafts they changed themselves, in the areas they approve, which otherwise need another approver (decided by the owner on 2026-11-07) | None | None | None | None | None | Approve | None | None | None | None |
| Change history, for the data the role sees (**proposal**) | None | View | View | View | View | View | View | View | View | None |
| Saved views of tables the role sees | Save, and change their own | Save, and change their own | Save, and change their own | Save, and change their own | Save, and change their own | Save, and change their own | Save, and change any | Save, and change their own | Save, and change their own | None |
| User accounts and the role each holds | None | None | None | None | None | View | None | View | None | Edit |
| Roles, and what each grants | None | None | None | None | None | View | None | View | None | Edit |
| System settings | None | None | None | None | None | View | None | View | None | Edit |
| Access history | None | None | None | None | None | View | None | View | None | View (**proposal**) |

Approving is granted area by area, and rejecting with it, as [Approving by area](decisions.md#people-and-privacy) records. Seeing data comes only from viewing permissions, never from approving. A user can approve only drafts whose values their role lets them see, so a draft holding a Restricted detail, such as an end date, needs an Approver whose role also sees Restricted data, such as the Engineering Director, and drafts of People's columns, and the values in them, need an Approver whose role sees people. Project Managers, who see people and the hiring plan, approve drafts of people's General details, of People's columns, and of planned hires, decided by the owner on 2026-11-07, and can approve feature teams too, which the owner accepted on 2026-10-31.

**Proposal:** Seeing drafts is a permission of its own, like seeing the change history, so the Executive sees only approved data. Still open: whether the change history then leaves out edits to drafts for those who may not see drafts. Until it is agreed, the Executive sees drafts, as every role that sees the data does.

The owner has decided that a role letting a user edit some data also lets them view it, so a Product Manager sees the plan and a Resource Planner sees allocations without being granted to view them as well. Feature teams are seen with the plan, so editing them grants no view of their own. Every starting role but Administrator sees the plan and allocations.

Seeing people is kept to the roles that work with them, so Product Managers and Team Members do not see the People table; Project Managers see it, with the hiring plan, decided by the owner on 2026-11-07. They do see the org chart, with each person's name, position, and team, as the [Decisions Log](decisions.md#workforce) sets out. The choices of a list are seen by everyone who sees data drawn from it, such as People's columns, without seeing the Lists page.

## Custom Fields and Tables

**Proposal:** The Workforce Administrator defines custom fields on people, teams, and planned hires, and any custom field or table that links to people or holds personal information. Roles that edit the plan define other custom fields on the plan, such as on projects and features, and custom tables for reference lists. A user can assign a field or table only to a tier their own role lets them see. This waits for the [Roadmap](roadmap.md)'s stage for custom fields and tables.

## Releases

**Proposal:** Roles that edit the plan, such as Project Manager, make releases and choose which cycles each includes. The Workforce Administrator sets up release streams, their cycle lengths, and their naming patterns. Changing one cycle's length also moves the releases on cycles that move, which the Workforce Administrator may do without editing releases otherwise, as the [Decisions Log](decisions.md#planning) sets out.

## Access to Your Own Record and Your Reports

**Proposal:** Each person record holds the employee's work email address. When it matches a user account's email address, Fathom suggests linking the two, and an Administrator confirms the link, so a mistyped or reused address never grants access by itself. A linked user automatically sees, without editing, their own record and the records of everyone who currently reports to them, directly or through other managers, including Restricted details; planned reporting changes grant nothing until they take effect. Access to anyone else's data still comes from the user's role, so the Engineering Manager role could then be narrowed from seeing Restricted details for everyone. To stop an Administrator linking themselves to someone else's record, nobody confirms a link to their own account, changing a linked account's email address removes its link, and every link made or removed is recorded in the access history. The work email address is new personal data, brought to HR before it is added.

## Planned Hires in the Plan

**Decided:** A planned hire appears as a placeholder, while the [Decisions Log](decisions.md#workforce) says it shows one. Everyone who sees people sees it as a row of the People table, and with its manager's team, showing only its name, ID, position, state, manager, Expected month, and its values for the other columns it shares with people, such as site and level, each at its column's visibility; its name, ID, manager, and Expected month are General, and its position and state take the visibility of the Positions and Hiring states lists, which start General, decided by the owner on 2026-11-05, replacing the state being Confidential, decided on 2026-11-03. Team Members see it in the plan by its position, ID, and Expected month, or without its position if they cannot see the Positions list's visibility, as they see people by name, without the People table's details. Its exact target date, drafts, and history are seen only by the roles that grant View Hiring plan, as the [table above](#what-each-role-can-do) shows and the [Decisions Log](decisions.md#people-and-privacy) sets out, decided by the owner on 2026-11-07, replacing their being seen with Confidential data. This lets Team Members and Resource Planners see and allocate planned hires without seeing the hiring plan's details, decided by the owner on 2026-11-03; as rows of People, named by position and ID, decided by the owner on 2026-11-04.

## Safeguards for Administrators

**Decided:** Whoever may manage accounts, under any role that grants it, gives accounts their role: any role, their own account included. So any role that lets its holders manage accounts can reach every role's access, including editing roles and every tier of data; the access history, which marks each change of role as worth checking, is the safeguard. Editing roles stays a permission of its own: it separates changing what roles grant, not who holds them. Those who may manage accounts manage their own account like any other: they can change its role, name, and email address, and deactivate it. Two guards remain: no change to an account or a role may leave no active account able to manage accounts, or none able to edit roles, so no one can lock everyone out, and nobody resets their own password from the Accounts page, since changing one's own password needs the current one. A change granting Confidential data takes effect at once; a second person's confirmation is deferred in [Issues](../issues.md#roles).

**Decided:** The first Administrator is the Fathom Administrator account, which the install creates, holding the Administrator role, as the [Decisions Log](decisions.md#people-and-privacy) records, decided by the owner on 2026-11-06; no person's account is. A person later given the Administrator role can take over from it.

**Proposal:** Every account created, change to an account's name, email address, or role, password reset, user's change of their own name or password, deactivation, and reactivation is recorded in the access history. Separation of duties applies to the Administrator role itself, which sees neither the plan nor people's data. While one person runs the Fathom Administrator account, these safeguards rely on the access history alone. Whoever may manage accounts can reach other roles' data by giving their own account another role, or, with local passwords, by creating another account or resetting another user's password and signing in as them, and whoever may edit roles, by adding permissions to the role they hold; the access history is what reveals it.

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

The first stage of the [Roadmap](roadmap.md) uses every starting role: Team Member, Product Manager, Feature Lead, Project Manager, Engineering Manager, Engineering Director, Workforce Administrator, Executive, Resource Planner, and Administrator.
