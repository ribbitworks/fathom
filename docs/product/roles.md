# Fathom — Roles

**Status:** Starting roles, with open points marked **proposal**
**Last updated:** 2026-11-05

The roles Fathom starts with, for controlling what each user can see, edit, and approve, built on the access decisions in the [Decisions Log](decisions.md). Roles are editable sets of permissions, as the Decisions Log records, decided by the owner on 2026-11-04, so these are a starting set: they can be edited and copied to make new roles, within the safeguards below, and each keeps what it grants today until it is changed. The owner has confirmed the role list, that People Managers and the Executive see Restricted data, that the Engineering Director plans, the split between Project Planner and Resource Planner, and that the Engineering Director is the first Administrator. Items marked **proposal** are not yet agreed.

## Starting Roles

- **Viewer:** Sees the plan, including everyone's work assignments. Every account gets this role unless it is left off, as for a person who runs Fathom without seeing people data.
- **Project Planner:** Edits projects, proposals, features, milestones, releases, products, customers, and estimates across the whole plan.
- **Resource Planner:** Sees people's General details, and edits allocations across the whole plan.
- **People Manager:** Sees people, including everyone's Restricted details, because people move between managers over time, and proposes feature teams.
- **Workforce Administrator:** Maintains people, teams, reporting lines, feature teams, the hiring plan, and planning configuration, and sees all Restricted and Confidential data.
- **Leadership:** Sees people, with their Restricted and Confidential data, without editing it.
- **Approver:** Approves or rejects draft rows, including feature teams and their own drafts.
- **Administrator:** Manages user accounts, role assignments, and system settings, without access to Restricted or Confidential data.

## What Each Role Can Do

| Area | Viewer | Project Planner | Resource Planner | People Manager | Workforce Administrator | Leadership | Approver | Administrator |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Plan: projects, proposals, features, milestones, releases and the cycles they include (**proposal**), products and customers (**proposal**), and estimates | View | Edit | View | View | View | View | View | None |
| Allocations | View | View | Edit | View | View | View | View | None |
| People, teams, and reporting lines (General) | None | None | View | View | Edit | View | None | None |
| Feature teams (General), with seeing them coming with seeing the plan (**proposal**) | View | View | View | Propose | Edit | View | Approve | None |
| Restricted employee details | None | None | None | View | Edit | View | None | None |
| Confidential data | None | None | None | None | Edit | View | None | None |
| Planning configuration: release streams, their cycles and cycle names, estimate conversions (**proposal**), and composition targets, with seeing them coming with seeing the plan (**proposal**) | View | View | View | View | Edit | View | View | None |
| Lists of choices, and People's columns and their order | None | None | None | None | Edit | None | View lists, and approve drafts of them, decided by the owner on 2026-11-01 | None |
| Draft rows of the data the role sees, made by editing it | View | Edit | Edit | Edit feature teams | Edit | None (**proposal**) | Approve | None |
| Change history, for the data the role sees (**proposal**) | View | View | View | View | View | View | View | None |
| Saved views of tables the role sees | Save, and change their own | Save, and change their own | Save, and change their own | Save, and change their own | Save, and change any | Save, and change their own | Save, and change their own | None |
| User accounts, role assignments, and system settings | None | None | None | None | None | None | None | Edit |
| Access history | None | None | None | None | None | None | None | View (**proposal**) |

**Proposal:** Until approving is split by area, seeing data comes only from roles, never from approving. A user can approve only drafts whose values their roles let them see, so a draft holding a Restricted detail, such as an end date, needs an Approver who also holds a role that sees Restricted data. Approvers approve every kind of draft their roles let them see, so drafts of People's columns, and the values in them, need an Approver who also holds a role that sees people, and Project Managers, who hold Approver by default, can approve feature teams too, which the owner accepted on 2026-10-31 until approving is split by area, the first of the finer permissions in the [Implementation Plan](../design/implementation-plan.md#editable-roles). Once it is, approving an area includes seeing it at the same tier, as the [Decisions Log](decisions.md#people-and-privacy) records.

**Proposal:** Seeing drafts is a permission of its own, like seeing the change history, so Leadership, held by the Executive, sees only approved data. Still open: whether the change history then leaves out edits to drafts for those who may not see drafts. Until it is agreed, Leadership sees drafts, as every role that sees the data does.

The owner has decided that a role letting a user edit some data also lets them view it, so a Project Planner sees the plan and a Resource Planner sees allocations without also holding Viewer. Feature teams are seen with the plan, so editing them grants no view of their own. The other roles' views of the plan and allocations come from the Viewer role, which every account has by default.

Seeing people is kept to the roles that work with them, so Product Managers, Project Managers, Feature Leads, and Team Members do not see the People table by default. The choices of a list are seen by everyone who sees data drawn from it, such as People's columns, without seeing the Lists page.

## Custom Fields and Tables

**Proposal:** The Workforce Administrator defines custom fields on people, teams, and planned hires, and any custom field or table that links to people or holds personal information. Project Planners define other custom fields on the plan, such as on projects and features, and custom tables for reference lists. A user can assign a field or table only to a tier their own roles let them see. This waits for the [Roadmap](roadmap.md)'s stage for custom fields and tables.

## Releases

**Proposal:** Project Planners, such as Project Managers, make releases and choose which cycles each includes. The Workforce Administrator sets up release streams, their cycle lengths, and their naming patterns. Changing one cycle's length also moves the releases on cycles that move, which the Workforce Administrator may do without editing releases otherwise, as the [Decisions Log](decisions.md#planning) sets out.

## Access to Your Own Record and Your Reports

**Proposal:** Each person record holds the employee's work email address. When it matches a user account's email address, Fathom suggests linking the two, and an Administrator confirms the link, so a mistyped or reused address never grants access by itself. A linked user automatically sees, without editing, their own record and the records of everyone who currently reports to them, directly or through other managers, including Restricted details; planned reporting changes grant nothing until they take effect. Access to anyone else's data still comes from roles, so the People Manager role could then be narrowed from seeing Restricted details for everyone. To stop an Administrator linking themselves to someone else's record, nobody confirms a link to their own account, changing a linked account's email address removes its link, and every link made or removed is recorded in the access history. The work email address is new personal data, brought to HR before it is added.

## Planned Hires in the Plan

**Decided:** A planned hire appears as a placeholder, while the [Decisions Log](decisions.md#workforce) says it shows one. Everyone who sees people sees it as a row of the People table, and with its manager's team, showing only its Kind, ID, position, state, manager, Expected month, and its values for the other columns it shares with people, such as site and level, each at its column's visibility; its ID, manager, and Expected month are General, and its position and state take the visibility of the Positions and Hiring states lists, which start General, decided by the owner on 2026-11-05, replacing the state being Confidential, decided on 2026-11-03. Viewers see it in the plan by its position, ID, and Expected month, or without its position if they cannot see the Positions list's visibility, as they see people by name, without the People table's details. Its exact target date and other hiring details are seen only by the Workforce Administrator and Leadership, as Confidential data, until planned hires become a permission area of their own in the Editable Roles slice, when the roles that grant that area decide who sees them. This lets Viewers and Resource Planners see and allocate planned hires without seeing the hiring plan's details, decided by the owner on 2026-11-03; as rows of People, named by position and ID, decided by the owner on 2026-11-04.

## Safeguards for Administrators

**Decided:** Administrators manage their own account like any other: they can change its roles, name, and email address, and deactivate it. Two guards remain: no change to an account or a role may leave no active account able to manage accounts, or none able to edit roles, so no one can lock everyone out, and nobody resets their own password from the Accounts page, since changing one's own password needs the current one. A change granting Confidential data takes effect at once; a second person's confirmation is deferred in [Issues](../issues.md#roles).

**Proposal:** Every account created, change to an account's name, email address, or roles, password reset, user's change of their own name or password, deactivation, and reactivation is recorded in the access history. The first Administrator's roles are assigned when Fathom is set up. Separation of duties applies to the Administrator role itself; a person who also holds other roles sees what those roles allow. While the Engineering Director is the only Administrator, these safeguards rely on the access history alone. A second person should take the Administrator role later. An Administrator can reach other roles' data by giving their own account those roles, or, when they may edit roles, by adding permissions to a role they hold, or, with local passwords, by creating another account or resetting another user's password and signing in as them; the access history is what reveals it.

## Default Roles by Persona

| Persona | Roles |
| --- | --- |
| Product Manager | Viewer, Project Planner |
| Project Manager | Viewer, Project Planner, Approver |
| Engineering Manager | Viewer, Project Planner, Resource Planner, People Manager |
| Feature Lead | Viewer, Project Planner |
| Engineering Director | Viewer, Project Planner, Resource Planner, Leadership, Approver |
| Engineering Operations Manager | Viewer, Workforce Administrator |
| Executive | Viewer, Leadership |
| Team Member | Viewer |
| Fathom Administrator, initially the Engineering Director | Administrator |

Personas are defined in the [Product Brief](brief.md#users). A Feature Lead who is also an Engineering Manager has both personas' roles.

How Project Managers give input on whether teams are in place is an open question in the [Product Brief](brief.md), and may add to their roles.

## First Stage

The first stage of the [Roadmap](roadmap.md) uses every role: Viewer, Project Planner, Resource Planner, People Manager, Workforce Administrator, Leadership, Approver, and Administrator.
