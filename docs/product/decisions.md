# Fathom — Decisions Log

**Last updated:** 2026-10-31

Detailed product decisions made so far. The [Product Brief](brief.md) holds the high-level picture. Domain terms are defined in [Domain Concepts](domain.md). Open questions at this level of detail are raised when the related feature is worked on.

## Planning

- **Planning granularity:** Monthly, open to revisiting.
- **Allocation unit:** A percentage of a person's month, chosen from 10%, 25%, 50%, 75%, 90%, or 100%. The default is 100%.
- **Multiple assignments:** Fathom warns, but does not block, when a person has more than two assignments in a month.
- **Project allocations:** People can be allocated to a project directly. See the [Domain Model](../design/domain-model.md) for how this may be modeled.
- **Project ownership:** Projects have an owner, such as a Software Project Manager.
- **Employment dates:** A person cannot be allocated before their start date or after their end date.
- **Plan approval:** Draft plan changes are approved by a user with an approver role before they reach the live plan.
- **Editing model:** No live collaboration. Saving a change (subject to approval) and refreshing to see others' changes is acceptable.
- **Cycles and releases:** Cycle length, which cycles a release includes, and patch frequency are all configurable in Fathom.
- **Cycle names:** Cycles are named by a configurable pattern, for example the last two digits of the year the cycle ends in and its number within that year.
- **Release candidates:** Every cycle is a candidate release until a user confirms it. Confirming one makes a release that includes every cycle since the previous release, and unconfirmed candidates are not releases.
- **Release contents:** Fathom records which features ship in which release.
- **Monthly resource grid:** Allocations are shown as a grid, with people and planned hires as rows and months as columns. Each cell shows what that person works on that month, and the ends of cycles and releases are marked as vertical lines.

## Workforce

- **Placeholder allocations:** Planned hires can be allocated to projects and features like current staff. When a role is filled, the new hire takes over its allocations.
- **Hiring entries:** A planned hire records role, level, team, manager, target date, status, and approval state. Budget is not tracked.
- **Hiring target date:** The date the new hire starts work. Onboarding time is handled with a reduced allocation percentage.
- **Hiring workflow:** Moving a planned hire between states is controlled by role.
- **Reporting lines:** Each person has exactly one manager. Dotted-line relationships, described in [Domain Concepts](domain.md), exist in some cases but are kept to a minimum. Future-dated manager reassignments, for example for a reorg, can be planned.
- **People ownership:** Software Engineering Managers own their people, including when those people work on features led by someone else.
- **Feature ownership:** Features are owned and delivered by a feature team. A feature's owner is the feature lead of its feature team.
- **Feature team membership:** A person can be on more than one feature team at a time. Membership changes can be planned ahead, like reporting changes.
- **Feature team approval:** Software Engineering Managers propose and maintain feature teams, and the Director reviews and approves them.
- **Team names:** Teams can be named.
- **Team composition:** Balance is evaluated for both teams and feature teams. The measures, their targets, and how positions count toward them are configurable. Planned hires count toward a manager's reports, with a filter to exclude them in a later stage or release.
- **Reporting view:** Reporting lines appear both as an org chart and within the unified people view.

## People and Privacy

- **Employee details:** Preferred name, Employee ID, gender, site, position (for example Software Engineer, Test Engineer, SDET, Manager), level (for example P1–P5, M1–M5, co-op), role on the team (for example Team Lead, Design Authority), start date, and end date.
- **Built-in details:** Every person has a preferred name and an Employee ID, both required, and start and end dates, both optional; a person with no start date counts as current. The Employee ID is the ID the organization uses for them, free text of up to 40 characters, and no two people can have the same one, ignoring letter case. Site, position, level, role on the team, and other details are columns that draw on lists, as set out under [Configuration](#configuration).
- **Deleting people:** A person entered by mistake can be deleted while nothing uses them, and Undo brings them back. People who leave are given an end date instead.
- **Gender:** Recorded because the company works across several countries, and colleagues cannot always tell someone's gender from their name.
- **System of record:** Fathom holds a manually maintained copy of employee details from the HR system.
- **Use limits:** Fathom's data is used only for planning, not for performance evaluation or discipline.
- **Former employees:** People who leave are kept rather than deleted. A person is active from their start date until their end date passes; there is no separate flag.
- **Who is listed:** Users who cannot see Restricted data see only current staff, so the list does not reveal someone's start or end date before it arrives.
- **Access control:** Access is role-based, and a user can have one or more roles. Roles are proposed in [Roles](roles.md).
- **Sensitivity tiers:** Roles grant access to tiers of data, not to individual screens. Adding a field means assigning it to a tier. The initial tiers, subject to the privacy review, are:
  - *General:* preferred name, Employee ID, team, feature teams, feature leads, position, site, level, manager, and assignments. Level is General at the owner's direction, as it is commonly known across the company. Details held in columns that draw on lists take the visibility of their list.
  - *Restricted:* gender, start and end dates, and active status.
  - *Confidential:* the hiring plan and future-dated reorgs.
- **Consistent enforcement:** Exports, snapshots, and search results follow the same access rules as screens.
- **Access history:** Fathom records who viewed or changed Restricted or Confidential data, and every change to user accounts and their roles, without recording the values. A user viewing people's Restricted or Confidential details is recorded at most once a day, so frequent use does not bury other entries. Whose details changed is shown only to readers who may see people; others see that a change was made, and by whom.
- **Separation of duties:** Running the system, such as backups and updates, does not require access to people data in Fathom.
- **Data outside the app:** Backups are encrypted, server login is restricted, and backup files are kept only in approved locations.

## Privacy Law Context

The company is a private company in British Columbia, so BC PIPA is expected to govern employee personal information, unless the company is federally regulated. Employees in other countries may bring their own local laws. In particular, the company has employees and managers in India, whose personal data may be subject to Indian law, such as India's Digital Personal Data Protection Act, 2023. These notes are a general understanding, not legal advice, and are to be confirmed in the privacy review:

- Employers can generally collect and use employee information that is reasonably needed to manage employment without consent, if employees are told beforehand and given the purposes.
- Employees can ask to see or correct their information.
- Personal information used to make a decision that directly affects someone must be kept for at least one year after the decision, then destroyed or anonymized once no longer needed for legal or business purposes.

## Configuration

- **Flexible data model:** A fixed core of built-in tables, such as people, teams, projects, features, and allocations, with fixed key fields that Fathom's views and access rules rely on. Users extend it with custom fields on built-in tables and custom tables for reference lists, such as skills. How they are stored is proposed in [ADR 0005](../adr/0005-flexible-data-model.md).
- **Plain language:** Fields and tables are set up in everyday terms, such as "Must be filled in" and "Link to another table", never database terms.
- **Sensitivity of custom fields:** Every custom field and table is assigned a sensitivity tier when it is created. Custom fields that hold personal information need HR's approval before use.
- **Change history:** Every change to plan, people, and configuration data is recorded with its old and new values, who made it, and when, in a history that can only be added to. Changes saved together are grouped into a change set. Undoing a change makes a new change that puts back the old values, so the history is never rewritten.
- **Who changed what:** Kept in the change history rather than shown on every record, since it is audit detail. Where it is shown, a user sees only changes to data their roles let them see, so a change to a Restricted detail, such as an end date, is not revealed to others by its timing.
- **Lists:** People define their own lists of choices, such as locations or skills; none are built in, and a fresh Fathom starts with none. A list has a name of up to 40 characters, which must be unique, an optional description, and a visibility: the tier of the values chosen from it, General unless set otherwise. Its choices have names of up to 60 characters, unique within the list, an optional description, and an order the Workforce Administrator sets. Several choices can be added at once by pasting lines.
- **Using lists:** A list is used by adding a column that draws on it, such as a Location column on resources. The column, not the list, decides whether one choice or several can be picked, whether a value is required, and what the column is called, so one list can feed several columns.
- **Lowering a list's visibility:** Allowed while columns draw on the list, which shows the values already chosen to more people. The change is recorded in the change history and can be undone, like any other.
- **Columns on People:** The Workforce Administrator adds People's columns, each drawing on a list, ahead of the rest of custom fields. A column can be required only once everyone has a value, and can take only one choice only once no one has several. Its list cannot change while it has values.
- **Column order:** Every column on People, built-in or added, can be moved, by dragging its header, with Alt and the arrow keys, or from its menu. The order is the same for everyone.
- **Retiring and deleting:** Choices and lists can be [retired](domain.md#terms) and restored. Deleting is only for choices and lists nothing uses; a list cannot be retired or deleted while a column uses it. Every change to lists offers Undo.
- **Searching, filtering, and sorting:** Every table can be searched, and filtered and sorted by any column the user sees, with the same controls on every table. A table can be sorted by several columns in turn: each sort chosen is added after those already there, a column already sorted changes direction in place, and any level, the first included, can be removed on its own. People has them first, and other tables take them as they need them.
- **Rows stay put while edited:** A row keeps its place while it is edited, even once it no longer matches the filter or would sort elsewhere, and moves or drops out when the search, filters, or sort next change. People a user adds stay at the end of the table until then, whether or not they match; people added by someone else appear, also at the end, only if they match.
- **Views kept in the address:** A table's search, filters, and sort are kept in the page address, so they survive reloading, Back undoes them, and they can be shared as a link. How this is built is decided in [ADR 0006](../adr/0006-table-views-in-the-browser.md).
- **Undo:** Undoing a change undoes everything saved with it in one step, which either all happens or none of it does. Only the person who made a change can undo it, and only while nothing it changed has been changed again since.

## Platform and Operations

- **Tech stack:** Recorded in [ADR 0001](../adr/0001-tech-stack.md).
- **Authentication:** Local accounts managed in Fathom for v1.
- **Snapshots:** Taken both manually and on a schedule, and contain projects, features, and allocations only, with their custom field values. The schedule is to be decided.
- **Exports:** PDF, and CSV or TSV for use in Excel.
- **Backup operations:** Run and monitored by the owner's department, since IT is too busy to support custom applications.
