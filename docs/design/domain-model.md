---
title: "Domain Model"
category: "Domain"
audience: "Contributors"
applies_to: ["packages/shared/src/**", "packages/db/**", "apps/server/src/**"]
dependencies: ["docs/product/domain.md", "docs/product/roles.md"]
last_updated: "2026-11-27"
---

# Fathom: Domain Model

Fathom's core entities, how they relate, and the rules that always hold for them. It describes concepts, not database tables.

- **Terms:** defined in [Domain Concepts](../product/domain.md).
- **Who may do what:** in [Roles](../product/roles.md).
- **How each page shows the data:** in its [page design](pages/).
- **Proposals:** items marked **proposal** are suggested modelling choices that have not been agreed.

## Overview

Fathom in one picture: what's planned, when it ships, and who works on it. Each arrow points from a record to what it belongs to or serves.

- **One drawing:** Help's [How Fathom Fits Together](../help/how-fathom-fits-together.md#how-they-connect) shows the same file, kept in `docs/help/diagrams/`.
- **Each area:** its entities, with their full relationships, follow below.

![How Fathom's records fit together](../help/diagrams/how-fathom-fits-together.svg)

- **Plan:** projects and proposals are for customers. A project is committed work, and a proposal is work offered to a customer that may or may not be won. Both name the features they need, and a feature ships in a cycle of a release.
- **People:** people are on feature teams, which deliver features, and are allocated to features and activities month by month.
- **Activities:** work that isn't a feature, such as release testing, each in one release or one project, done by a feature team.

A feature needs none of these links: one with no project or proposal is an idea not yet committed to anything.

## Planning Entities

### Project

- **Fields:** a name, required and unique ignoring letter case. Optionally a Project ID, unique ignoring letter case when entered, an owner, who is a person, customers, and the proposals it links to.
- **Dates:** from its milestones, never entered: its first and last milestone and its next customer delivery.
- **Scope:** the features it needs, held in the project's draft whichever side they are edited from. Linking a feature is enough to show the project funds it. Time spent on the project that isn't a feature goes to one of its [activities](#activity), since people are allocated to features and activities, never to projects.
- **Removing:** removes its milestones in the same draft. A project with activities can't be removed yet ([issue #207](https://github.com/ribbitworks/fathom/issues/207)).

### Activity

- **What it is:** work a project or a release needs that isn't a product feature, such as data migration or release testing. It belongs to exactly one project or one release and ends with it. Nothing makes one: an activity named General is an ordinary one a team adds.
- **Fields:** a [feature](#feature)'s fields, but none that say where a feature is committed: a name, required and unique within its project or release, ignoring letter case, since release work repeats in every release; a status, required, from the same built-in list as a feature's; optionally a priority, size, risk, Needed by, estimate, feature team, description and note, as a feature's are; and a colour from the palette.
- **Its own columns:** columns added to activities hold values of their own, never Features' columns.
- **Never a feature:** it has no target cycle, customers, projects, proposals or milestones, since its project or release says when it happens, and it is never shown on Features, the Board or the roadmap.
- **Drafts and access:** every change is a draft, made with Edit Features and releases and approved with Approve Features, and activities are seen with View Features, whether an activity belongs to a release or a project.
- **Moving:** an activity moves to another release or project as a draft, clearing the one it had; the server refuses one that names neither or both.
- **Removing:** an activity someone is allocated to can't be removed, as a feature can't, and a project or release with activities can't be removed yet ([issue #207](https://github.com/ribbitworks/fathom/issues/207)).
- **Built so far:** activities are kept, drafted and shown on the [Activities page](pages/activities.md) and in their project's and release's details, and Capacity shows and counts allocations to them beside features'; the [fictional data](development-setup.md#fictional-data) has some, with allocations. Picking an activity when allocating comes with allocating from the grid ([issue #206](https://github.com/ribbitworks/fathom/issues/206)).

### Proposal

- **What it is:** work offered or requested that may become a project, such as a bid or a customer request. Projects link to proposals; a proposal is never made into a project, and nothing marks it Won.
- **Fields:** a name, required and unique ignoring letter case, and a status, required, starting as the first status offered, Open to start. Optionally a Proposal ID, unique ignoring letter case when entered, a web link, an owner, who is a person, and customers, picked directly from Customers.
- **Status:** a choice of the built-in Proposal statuses, with no rules tied to them, so any status may follow any other.
- **Scope:** the features it proposes, which count toward the forecast by their own status. Each change, from either side, is a draft of the proposal. It keeps the reason given for each feature removed from it while that feature is not in it.
- **A new feature from a proposal:** a feature added from a proposal's details is a draft of its own, and the proposal's link to it a draft of the proposal that uses it, so approving the proposal takes the feature along, which needs an approver of features too.

### Feature

- **Fields:** a name, required and unique ignoring letter case, and a status, required.
  - **Optional:** a description, plain text up to 200 characters, its Needed by month, customers likely to want it, a note, a target cycle, an estimate, a size, a priority, a risk, a feature team, and the projects and proposals that name it.
  - **Added columns:** its values in the columns added to Features are part of its draft. Kind, product, initiative, theme and complexity are columns users add.
- **Status:** a choice of the built-in Statuses list, a list with meanings that activities share. Fathom acts on the meaning, while each organization names and divides its statuses its own way.
  - **Possible:** a new feature starts in the first status meaning Possible. A possible feature is the same record a planned one is, so it is planned, staffed and released without being copied.
  - **What counts:** possible features count toward the forecast but not toward over-allocation, and Done or Cancelled ones raise no warnings.
- **Needed by:** a month and year, the Product Manager's rough wish. It is kept apart from the target cycle, the commitment made in planning, so a rough wish never reads as one.
- **Timing:** it targets a cycle, or none, and is then in Later.
  - **Release:** it ships in the release that includes its target cycle.
  - **Months:** its start and end months follow from its allocations, and one with no allocations is placed only by its target cycle. Only milestones have dates to the day.
- **Ownership:** it has no owner of its own: its owner is its feature team's lead. A feature whose status means Planned or In progress and has no feature team is warned about.
- **Not staffed:** a feature whose status means Planned or In progress and has no allocations. A planned hire's allocation staffs a feature as a person's does. Whether a feature has allocations is a fact about the feature, not about anyone allocated, so [Roles](../product/roles.md#who-sees-which-people) shows it to everyone who sees features.
- **Size, Priority and Risk:** each optional, and each a choice of a [built-in list](#built-in-lists). Size has no unit and is never converted to effort. Priority is how much the feature matters to the organization, not within a cycle, and is kept apart from status, so a Long shot can be Critical.
- **Removing:** refused while a project or proposal names it, as for any record another links to, and while it has allocations, since allocations are time spent; it is cancelled instead.

### Milestone

- A dated point in one project or one feature, with a name, which says whether it is a customer delivery date. Milestones are kept in a table of their own.
- Other kinds of milestone are a column users add. A feature's milestones are not linked to its projects' milestones.
- Only project milestones are built.

### Allocation

- **What it is:** one person or one planned hire, never both, on one feature or one activity, never both, at a percentage of their month: 10%, 25%, 50%, 75%, 90% or 100%, starting at 100%. Each has at most one allocation to a feature or activity.
- **Months:** one allocation holds its months: the percentage from each month it changes, or none when it stops, each in force until the next, as reporting lines are kept. It may run with no end.
  - **A range:** such as 50% from January to June, holds 50% from January and none from July.
  - **One month within a range:** changing it adds up to two months, so the months around it keep their percentage.
- **One draft:** every change to an allocation, of any of its months, is one draft, approved or rejected whole, so an Approver never approves a range's start without its stop. A change that leaves no months drafts its removal, and allocating again changes that draft.
- **Drafted features and activities:** a feature or activity only drafted to be added cannot be allocated until it is approved, so an allocation's draft never waits on a draft of the plan.
- **Employment dates:** a person cannot be allocated before their start month or after their end month, nor a planned hire before its first month that can be allocated. Past months can be allocated, as corrections.
  - **A date moving later:** allocations left outside employment are kept rather than removed, so whoever allocates decides. They count in neither capacity nor demand.
- **Capacity:** a full month for everyone, including the months a person starts and ends in, and none before the start month or after the end month. A planned hire has none before its first month that can be allocated.
- **Removing:** removing a person or planned hire removes their allocations in the same draft, refused while any of those allocations has a draft. A feature or activity with allocations is never removed.
- **Planned hires:** a planned hire with allocations cannot be filled yet, and a filled one is not allocated.

**Proposal:** When variable capacity is added after v1, give each person a monthly capacity, defaulting to a full month, so existing data needs no change, and mark it wherever the person appears, to discourage it.

### Estimate

- **What it is:** a feature's one estimate, its total effort, kept as one value in hours and shown in the unit the reader picks, so the unit is not part of the data.
- **Units:** hours, the default, person-days, person-weeks, person-months, and person-quarters, always three person-months. There are no person-cycles, since cycle lengths differ between schedules and change over time.
- **Conversions:** the [planning settings](#planning-settings) convert between units. A changed conversion keeps each estimate's hours, so what it shows in other units changes.
- **Apart from Size:** a feature's Size is a rough size, never converted to effort. Marking an estimate as a ROM or a SWAG is a column users add.

### Planning Settings

One record for the whole of Fathom, which capacity and forecasts are worked out with. How they are shown and changed is in [Administration § Planning Settings](pages/administration.md#planning-settings).

- **Changes:** a change is a draft of the whole record, approved with Approve Configuration, and recorded in the change history.
- **Estimates:** a draft changes no estimate's units until it is approved.
- **Person-weeks:** a person-week holds a person-day for each working day.
- **Weeks:** the rules for working days and for cutting time into weeks are in `packages/shared/src/working-week.ts`.

| Setting | Starting value | Allowed |
| --- | --- | --- |
| Hours a day | 8 | 0.5 to 24, in whole or half hours |
| Working days | Monday to Friday | At least one day of the week |
| Week starts on | Monday | Any day of the week |
| Working days a month | 20 | 1 to 31 whole days |
| Default focus | 80% | 1% to 100% |
| Default buffer | 0% | 0% to 100% |

Percentages are whole.

### Customers and Products

- **Customer:** a row of the built-in Customers table, with a name, required and unique, picked directly by projects, proposals, and features. Optionally a description, plain text up to 200 characters, and a note, formatted as a feature's is ([Notes](visual-design.md#components)).
- **Product:** a built-in table with a name, required and unique. Features are part of products through a column users add. Not built yet.

## Release Entities

- **Schedule:** `ReleaseStream` in the code. It groups its cycles and releases, and Fathom starts with none.
  - **Fields:** a name, its place in the order of schedules, whether it is retired, and, for a schedule that ends, its last day, which cuts its last cycle short.
  - **Its cycles:** worked out whenever they are read, never stored, two years ahead of today, or to its last day, or as far as a release or feature on them reaches.
  - **Not modelled:** what a release is for, such as a patch, is up to the organization. Gaps between cycles, such as freezes, are not modelled.
  - **Ending:** a schedule's last day may move later freely, and earlier only while no release includes, and no feature targets, a cycle that would start after it, and never before its first cycle starts. Once the day has passed, the schedule is Ended, but not retired, since its releases and features are still worth seeing.
  - **Retired:** a retired schedule's cycles take no new features: a feature's draft onto one is refused unless the feature's live record already targets a cycle of that schedule, so a feature already there keeps its place and moves with its cycle.
- **Cycle pattern:** A schedule's cycle length, in weeks or months, and its naming pattern, from a given date until the schedule's next pattern starts. A schedule has one or more, so a change of length leaves the cycles made before it as they are.
  - **Naming:** a naming pattern numbers cycles within the year they end in, or counts them from the schedule's first cycle without restarting, as in Sprint 1, 2, 3.
  - **One cycle's length:** changing it, the person chooses whether the cycles after it move by the same amount or the next cycle keeps its end date. Fathom writes the patterns that give that result.
  - **What moves:** releases on cycles that move, and features targeting them, move with them. A release's Ships on date stays as set, and a change that would put the release's first cycle after it is refused.
  - **Its drafts:** the new patterns and the moved releases and features are drafts approved, rejected and discarded only together. Only someone who may change cycles can discard them.
- **Cycle:** A planning period in one schedule, with a name, a start date, and an end date, made ahead from the pattern in force.
  - **Releases:** it is in at most one release. One in no release is not released yet, with no separate candidate state.
  - **Not stored:** cycles are worked out from the patterns rather than stored, so a cycle is known by its schedule and start date, as [ADR 0010](../adr/0010-cycles-from-patterns.md) sets out.
  - **Months:** a month in more than one cycle counts toward each in proportion to its days in it, for allocations, capacity and demand alone.
- **Release:** A named delivery in one schedule, its name unique within the schedule, which includes one or more of its cycles, consecutive in the schedule.
  - **Date and contents:** its date is its Ships on date, the end of its last cycle unless set earlier or later. Its contents are the features that target those cycles.
  - **Colour:** it can have a colour from the palette, chosen by whoever makes or changes it, never given automatically, and drafted and approved with the release. One with none has the default colour.
  - **Note:** it can have a note, as a Note column holds.

## Workforce Entities

### People

- **Person:** An employee, current or former, with their preferred name, ID, and position, all required, start and end dates, both optional, whether they are flagged as a manager, values for the columns added to People, and their work email address if the link to user accounts proposed below is adopted.
- **Active:** from their start date until their end date passes, with no separate flag; a person with no start date counts as current. People who leave are kept, with their end date.
- **ID:** the Employee ID the organization uses, free text up to 40 characters. No two rows of the ID column, people or planned hires, have the same one, ignoring letter case.
- **Position:** a choice of the built-in Positions list, required for people and planned hires alike.
- **Gender:** not built in. An organization that records it adds a column of its own on People, in the Personal class.
- **Manager flag:** General, and not the Engineering Manager role. Only people flagged as managers can be named as a manager, of a person or of a planned hire.
  - **Clearing:** the flag cannot be cleared while anyone reports to its person, now or from a later date, or while a planned hire not yet filled names them.
- **Removing:** a person entered by mistake is removed as a draft, approved like any other, with their allocations, as [Allocation](#allocation) sets out. Removing is refused, when drafted and again when approved, for anyone who:
  - is or was anyone's manager, live or in a draft, since past lines are kept
  - leads a feature team, today, later or in a draft, or is named as a member in a team's draft
  - is named by a planned hire, live or in a draft, as its manager or as the person who filled it
  - is named by any record, live or in a draft

### Reporting Teams

- **Reporting line:** Links a person to their manager, or records that they have none, from a given date until the person's next line starts. A person has at most one manager at a time. Past lines are kept, so past managers are, and future-dated lines represent planned changes.
  - **Manager optional:** for the top of the organization and for anyone whose manager is not in Fathom.
  - **Rules:** loops are refused, so nobody reports to themselves or to anyone who reports to them. A line's date is on or after the person's start date, and its manager is active on that date.
  - **A manager leaving:** a manager whose end date passes while people still report to them is warned about, not blocked.
  - **Dates:** a change takes effect from today unless an earlier date is given, such as for a change already made in the HR system, and approving it does not move that date. Until planned reporting changes are built, a line's date is today or earlier, except a new employee's first line, which starts on their start date.
  - **People report to people:** a person's manager is never a planned hire.
- **Team:** One manager's direct reports. Its members follow from their reporting lines.
  - **Name:** optional, up to 60 characters and unique ignoring letter case. It stays with the manager when reports move.
  - **Colour:** once its name is approved, an optional colour from the palette, held by name so the palette can change without a migration. The colour is set directly, never drafted.
  - **Known by its manager:** a team is known by its manager, and stored only once named, so a link to a team points to its manager.

### Feature Teams

- **Feature team:** Links a set of features and activities to its members. Membership is separate from reporting lines.
  - **Name:** required, up to 60 characters and unique ignoring letter case, since one person may lead several teams and leads change.
  - **Colour:** optional, from the palette, for the feature team chart. Its name and colour each keep one value, not dated.
  - **Disbanded:** from the first month with none of its members from then on, worked out from its membership records and not stored. A team that has never had a member has not disbanded, and one that disbanded comes back if someone joins it.
- **Feature team lead:** Records who leads a feature team, a person or a planned hire, or that no one does, from a given date, in force until the team's next record, so past and planned leads are kept.
  - **Who may lead:** the lead is optional, and is one of the team's members on that date, so their time counts in its capacity. On a day they are not, the team has no lead. A lead chosen who is not a member joins the team in the same draft.
  - **No lead:** a team with no lead is marked, since its features then have no owner.
- **Feature team membership:** Records that a person or a planned hire joins or leaves a feature team from a given date, never both in one record, in force until their next record for that team. Past memberships are kept, as reporting lines are, and future-dated records represent planned changes.
  - **Several teams:** a person or planned hire may be on several feature teams at once.
  - **Planned hires:** a planned hire joins, leaves and leads teams as a person does, through the same drafts, and is named by its name, or by its ID when it has none.
    - **From its Expected month:** it joins a team from the first day of its Expected month, never before, and counts in a team's capacity from then. It may leave earlier, as when its target date moves later. It has no end date, so it never leaves on one.
    - **Its days are General:** the days a change dating only planned hires gives are General, since they reveal no person's Personal details, so any role that edits feature teams chooses them, before or after today, and every reader of a team's draft sees them. They are held apart from people's days, and a refusal names the Expected month, never the target date.
    - **With a person:** a change that also dates a person, as when a hire takes over from a person as the lead, judged by the live lead and the new one, is a person's change: every day it gives is held with people's, in Feature team dates' class, and needs Personal details to choose.
    - **Which hires:** a filled hire, or one drafted to be removed, can't join or lead a team.
    - **Removing:** removing a hire is refused, when drafted and again when approved, while it leads a team, today, later or in a draft, or a team's draft names it as a member. Approving its removal takes it off its teams, recording the change, and clears it as a past lead.
    - **Filling:** filling a hire carries its teams and any lead to its person, as [Planned Hires](#planned-hires) sets out.
  - **Leaving:** once someone's end date has passed, they are off every feature team from the next day. They no longer count as a member, a team they led has no lead, and their past membership is kept.

### Planned Hires

- **Planned hire:** A role to be filled, kept as a record apart from people, so plans never mix with HR facts and are filled rather than converted. It is shown beside them as a row of the People table.
  - **Fields:** an optional name, its requisition, or a temporary ID until it has one, a position, a state, and optionally a target date, its manager, whether it is flagged as a manager itself, and values for the columns it shares with people.
  - **ID:** its requisition, free text up to 40 characters, shares the ID column with people's Employee IDs. Until it has one, it has a temporary ID, TBD- and the next number, never reused. An ID typed in cannot start with TBD-, and clearing a requisition gives the hire a new temporary ID.
  - **Target date:** the day the new hire starts work. Its first month that can be allocated, its Expected month, is the month of its target date, or of its person's start date once filled; a hire with no target date is expected from the current month.
  - **Manager:** a person or a planned hire flagged as a manager, a planned manager, whose team it joins, never both and never itself, and its managers never loop.
  - **A planned manager:** its flag cannot be cleared, nor the hire removed, while a planned hire not yet filled, live or in a draft, reports to it. A planned team has no name until its planned manager is filled.
  - **Columns:** it has values for the columns it shares with people. Every column added to People is offered on planned hires too, with no setting to switch it off. People's End column is not offered.
  - **Optional values:** every value is optional on a hire, even where People requires it.
  - **Removing:** a hire is cancelled by removing it, which removes its allocations in the same draft and takes it off its feature teams, as [Feature team membership](#feature-teams) sets out. The change history keeps it.
  - **Filling:** links the hire to the person who fills it, a new person or one already in Fathom, as one draft, approved or rejected whole. Once filled, it leaves People.
    - **Which hires:** only a hire in a state meaning Open, with no rejected draft, can be filled. A person may fill several over time, but not a second while the hire they filled before has not started.
    - **A new person:** takes the hire's position, the manager chosen and the hire's values in the shared columns, and is asked for any value People requires that the hire has none for.
    - **Someone already in Fathom:** changes only their position, to the hire's, and their manager, from the day given. Given no manager, they keep their own, and one already reporting to the manager chosen keeps their line.
    - **The manager chosen:** becomes the hire's too when the fill is approved.
    - **Managers:** a hire whose manager is still a planned hire needs a person chosen as manager. Filling a planned manager moves the planned hires that report to it to the person who fills it, in the same draft, and flags that person as a manager.
    - **Feature teams:** approving a fill gives the person the hire's feature teams and leads, as one change to each team. Nothing changes on the teams until then, and rejecting or discarding the fill leaves them as they were.
      - **The day:** each of the hire's membership and lead records in force on the day of approval or later becomes the person's, from the latest of its own day, the person's start date and the day of approval, so no earlier day changes. The hire's own records end from that day. A team the hire leaves before then carries nothing.
      - **Already on the team:** a person on one of the hire's teams on the day of approval or later keeps their own records there, and the hire's end.
      - **The lead:** a lead the hire holds passes to the person only for the days they are on the team, by the records carried or by their own. The team has no lead before they join it or after they leave it, so a lead is always a member.
      - **Refused:** a fill is refused, when drafted and again when approved, while a team's draft names the hire or is of a team the hire is on or leads on that day or later, published or not. Approving such a team draft together with the fill approves the team draft first. A fill is also refused when it would put the person on a team, or leading one, after their end date; at drafting, only for a drafter who sees end dates, so the refusal never tells anyone else when the person leaves.
    - **Approving:** a fill that changes a person names who fills the hire, so it needs an Approver who sees the classes of start and end dates. A fill carrying feature teams gives the person days on them, which can reveal their start date, so it needs an Approver who sees feature teams, Personal details and Feature team dates' class. Approving, rejecting or resending any part of a fill does so for all of it.
    - **Discarding:** discarding one record's part of a fill takes the fill out of its other drafts, keeping their other changes. Discarding on the Drafts page discards the whole fill.
  - **While a fill waits:** what it sets is held, so a hire with a fill waiting cannot be named as another hire's manager, and a hire it moves cannot be removed. Approving refuses a fill whose person has left by then.
- **Hiring state:** A choice in the built-in list of hiring states, a list with meanings, each meaning Proposed, Open, Hired, or Left. There is no state for someone who has not yet started.
  - **A planned hire:** is in one meaning Proposed or Open, starts in the first choice meaning Proposed unless another is given, and moves between them in any order.
  - **A person:** keeps a state of their own meaning Hired, or Left once their end date has passed, starting on the first choice of that meaning. A choice that comes to have the other meaning shows them the first choice of the meaning their end date gives.
  - **Changing a meaning:** a choice cannot be given the meaning Hired or Left while a planned hire is in it.

**Proposal:** Measure team composition from people's positions and their team or feature team membership, and compare it with configurable composition targets, starting with reports per manager, as [issue #208](https://github.com/ribbitworks/fathom/issues/208) sets out.

## Access Entities

- **User:** A local account holding one or more roles, one of them its default, and acting as one at a time. It signs in with a password.
  - **Name and email address:** it is identified by its name and email address, which is also its user name. Its name is plain text up to 100 characters, unique ignoring letter case.
  - **A generated password:** it is marked while its password is one Fathom generated, which its user must change before doing anything else.
  - **Deactivating:** an Administrator deactivates an account rather than removing it, so it can no longer sign in, and the changes it made still name it. Reactivating lets it sign in again.
- **Session:** A signed-in user's visit, which records the network address and browser it started from, for investigating security problems, and the role the user is acting as. It ends as set in [ADR 0002](../adr/0002-libraries.md).
- **Role:** A named set of permissions, kept in the database so it can be edited and copied, which grants view or edit access to data classes, and permissions such as approving plan changes.
  - **Starting roles:** the roles Fathom starts with keep a key, so setup and seed data find them whatever they are renamed.
  - **Deleting:** a role held by any account cannot be deleted.
- **Access record:** Records who did what, when, and to whom, without the values: a change to a user account, or a view or change of sensitive data. Records can only be added, never changed or removed.
- **Data class:** The class, General, Personal or Confidential, the organization keeps one of Fathom's built-in details in, stored once moved from its default. Lists and columns hold their own class. Class checks happen in the data access layer, as set in [ADR 0001](../adr/0001-tech-stack.md).

**Proposal:** Allow a user account to be linked to the person record for the same employee, so Fathom can tell who a user is in the org chart and give them access to their own record and their reports, as [issue #219](https://github.com/ribbitworks/fathom/issues/219) sets out. Not every user needs one.

### Data Classes

Each built-in detail starts in a class, and those that can move are kept in whichever class the organization moves them to:

| Class | Built-in details it starts with |
| --- | --- |
| General | Name, ID, today's position, current manager, team, feature teams, and assignments |
| Personal | Start and end dates, so people not yet started and people who have left; past managers and the dates reporting lines changed; the dates people join and leave feature teams, but not planned hires' |
| Confidential | Future-dated reorganizations, and the hiring plan |

- **Can move:** start date, end date, past managers with their dates, the dates people join and leave feature teams, future-dated reorganizations, and the hiring plan. Position and Hiring state move with their lists.
- **Never move:** name, ID, current manager, team, feature teams and assignments stay General, since every page finds its rows by them.
- **Stay General:** which feature teams someone was on, month by month, and past counts of reports by manager.
- **Confidential runs out:** a future-dated reorganization becomes the org chart on its date, and a planned hire becomes a person once filled.
- **New lists and columns:** start General unless another class is given when they are made.

## Configuration Entities

Fathom has a fixed core of built-in tables, such as people, teams, projects, features, and allocations, with fixed key fields that its views and access rules rely on. A built-in table has only the columns Fathom itself acts on, and the fewest of them required, so each organization shapes the rest with columns it adds.

How custom fields and tables are stored is proposed in [ADR 0005](../adr/0005-flexible-data-model.md).

### Tables and Columns

- **Field definition:** A custom field on a built-in or custom table, with a name, [field type](#field-types), class, and whether it must be filled in or be unique. A Person or Link field also names the table it links to.
  - **Built:** columns are built on People, planned hires, Features and Activities, with the field types below. Unique columns, Person and Link fields are not built yet.
  - **Choice from a list:** names its list, takes its class from the list's, and says whether it takes one choice or several.
  - **Other types:** a Text, Number, Date, Checkbox, Web link or Note field has a class of its own.
  - **Checkbox:** is never required, since an unticked box is a value, No.
  - **On People:** planned hires have every field too, as [Planned Hires](#planned-hires) sets out.
  - **Changing:** its type is fixed once it is added. It can be made required only once every record has a value, and single-choice only once none has several. Its list cannot change while it has values.
- **Column order:** A table's own order of its columns, built-in and custom alike, which every view starts from. A view may hold an order of its own.
- **Saved view:** A table's view saved under a name, with the table it belongs to, one of a fixed set, the user who saved it, and whether it is personal to them or shared.
  - **What it holds:** the table's search, filters, sort, what its Draft menu shows, the columns its metrics break down by and the one they add up (or Nothing), kept with or without a breakdown, its grouping, the columns it hides, and its page's own choices, such as the schedule the Features Board shows.
  - **Name:** unique, ignoring letter case, among the table's shared views and among each user's personal views on it.
  - **Sensitivity:** that of the most sensitive column it filters, sorts, breaks down, adds up, or groups by, and of the data its grouping needs. A People view may also filter on drafts, which is General, since each user is sent only the drafts they may see.
- **Last view:** The view an account last showed on a page with a Views menu, one for each account and page.
  - **What it holds:** the table shown, which on Projects and Releases is its tab, the view as a saved view holds it, the saved view it started from, if any, and the page's mode, such as Features' Board.
  - **The account's own setting:** never a draft, with no change history, and removed only if the account is. Deleting the saved view it started from keeps the rest of it.
- **Custom table:** A table users define, with a name, a class, and its field definitions. Not built yet.
- **Custom record:** One row of a custom table, holding values for its fields.
- **Custom value:** The value of one custom field for one record, built-in or custom.

### Field Types

| Type | Holds | Limits |
| --- | --- | --- |
| Text | Plain text, with no formatting, never empty | One line, up to 200 characters |
| Choice from a list | One choice, or several | Choices of its list only |
| Web link | An address, and optionally text shown in its place | Address up to 2,000 characters, text up to 200 |
| Note | Rich text, as GitHub-flavoured Markdown | Up to 10,000 characters |
| Number | A whole or decimal number, positive or negative | Up to 15 digits, at most 6 after the point; 0 is a value |
| Date | A day, with no time | A day that exists, such as 2026-03-14 |
| Checkbox | Yes or No | Yes is kept; No is no value |

- **Not built yet:** Link to another table. The database already holds its values and settings, such as the table a Link field links to, as [ADR 0005](../adr/0005-flexible-data-model.md#what-is-built) records.
- **Web link:** only http and https addresses, on the internet or a local network, by name or IP address. An address typed without a scheme is taken as https only when its host has a dot. What else is refused, and why, is in the [Security Plan](../security/security-plan.md#tampering).
- **Note:** what a note may hold, including the one HTML tag it may hold for text colour, is in [Visual Design](visual-design.md#components) under Notes.
- **Plain text:** built-in text, such as names and a feature's description, and a Text field's value hold no control characters or marks that change which way text runs.

### Lists

- **List:** A list of choices, with a name, up to 40 characters and unique, an optional description, the class of the values chosen from it, General unless set otherwise, and whether it is retired.
  - **Who defines them:** most are defined by people. The [built-in lists](#built-in-lists) are drawn on by built-in columns and cannot be removed or retired. A fresh Fathom starts with only the built-in lists.
  - **Columns:** columns elsewhere draw on lists. The column, not the list, says whether one choice or several are picked, whether a value is required, and what it is called.
- **Choice:** One entry in a list, with a name, up to 60 characters and unique within its list, an optional description, its place in the list's order, and whether it is retired.
  - **Meaning:** in a list with meanings, the meaning it is tied to.
  - **Weight:** in the list of feature sizes, how many of the size S it counts as.
- **Retiring and removing:** choices and lists are retired and restored. Only choices and lists nothing uses are removed. A list cannot be retired or removed while a column draws on it.
- **Lists with meanings:** the last choice offered for a meaning cannot be retired, removed, or given another meaning.
- **Lowering a list's class:** allowed while columns draw on it, which shows the values already chosen to more people. It is a move to another class, recorded, and moved back rather than undone.

### Built-in Lists

Each organization renames, adds to, reorders and retires these lists' choices. Choices are kept in the order shown. Each list keeps a choice offered: its last choice offered, or in a list with meanings the last for each meaning, cannot be retired or removed.

| List | Choices Fathom starts with | Rules |
| --- | --- | --- |
| Positions | Employee, Manager | No meanings. The last position offered cannot be retired or removed, so everyone can be given one. |
| Hiring states | Request to hire, Approved to hire, Hired, Left | Meanings Proposed, Open, Hired and Left, one choice each to start. |
| Statuses | Possible, Planned, In progress, Done, Cancelled | Meanings Possible, Planned, In progress, Done and Cancelled, one choice each to start. Features and activities share it. |
| Proposal statuses | Open, Won, Lost, Withdrawn | No meanings, since no rules are tied to them. |
| Feature sizes | XS, S, M, L, XL | Each with a weight relative to S, starting at 0.5, 1, 2, 3 and 4: more than 0 and at most 9,999.99, to two decimal places. A changed weight is a draft of its choice. |
| Feature priorities | Critical, High, Medium, Low | Ordered, no meanings. |
| Feature risks | Low, Medium, High | Ordered, no meanings. |

## Private Pages

A person's own pages, each a table of free rows that only they read and change, as [Roles](../product/roles.md#what-each-role-can-do) sets out. Their screens are not built yet; the entities, their reads and saving them are.

```mermaid
erDiagram
  ACCOUNT ||--o{ PRIVATE_PAGE : makes
  PRIVATE_PAGE ||--|{ FIELD_DEFINITION : "has columns"
  PRIVATE_PAGE ||--o{ PRIVATE_ROW : holds
  PRIVATE_ROW ||--o{ CUSTOM_VALUE : owns
  FIELD_DEFINITION ||--o{ CUSTOM_VALUE : "of column"
  RANDOM_KEY |o--|| PRIVATE_PAGE : names
  RANDOM_KEY |o--|| PRIVATE_ROW : names
```

- **Private page:** A page under its maker's Mine, with its maker, a name unique among their pages ignoring letter case, its place in their order, and its first column.
  - **Its columns:** [field definitions](#tables-and-columns) on the private table, each naming its page, with every field type's settings and class. A column's name is unique within its page, ignoring letter case, and it has no record key.
  - **First column:** always first and always required, since its value names each row.
  - **Removing:** removes its columns, rows and values with it.
- **Private row:** A row of a page, with its place in the order rows were added. Its values are custom values it owns, as a person owns theirs; it has no name of its own.
- **Random key:** A page's or a row's short code, such as K7QM in #PAGE-K7QM, as [ADR 0014](../adr/0014-random-keys.md) sets out.
  - **Codes:** four characters from 30 that can't be taken for one another, widening to five once a tenth of a kind's four-character codes are used.
  - **Kept:** made once for a record, held apart from it, and never given again, even once the record is removed.
  - **Made with its record:** a page and a row get their key when made, and a page as read carries its key and each row's. Pages and rows made before keys were have none.
  - **Links:** a link by a key, such as `/go/ROW-4X9T`, goes to the page's address, `/mine/<page>`, with the row's details asked for, only for the page's maker; for anyone else it finds nothing. It opens there once Mine's page is built.
- **Who reads them:** only the page's maker, while their role may make private pages. A column of a class the maker's role no longer sees is left out, with its values.
- **Saved at once:** making, renaming, moving and removing a page, adding, changing and removing its columns, and adding, changing and removing its rows and their values, save at once, with no drafts and no approval, since the data is one person's own. A column's type never changes, and its first column is never removed.
  - **Recorded:** every change is recorded in the change history with each field's class, a row's values each with its column's class.
  - **History and Undo:** the change history shows these changes to the page's maker alone, while their role may make private pages, removals included, and only the maker undoes them.
- **Order:** a maker's pages keep the order they move them into, a new one going last; a page's rows keep the order they were added in.

## Change and History Entities

- **Change set:** Changes saved together, with who made them, the role they acted as, and when.
  - **Kinds:** saved changes, approved, rejected or discarded drafts, rejected drafts sent again unchanged, and a user's unpublished changes discarded all at once.
  - **Private:** it is marked while it holds private changes, which only its maker sees; publishing clears the mark.
- **Change:** One field of one record changed in a change set, with its class, its old and new values, and whether it changed the record's draft or the live record.
  - **Kept by a discard:** a change in a discard that leaves its record's draft in place, as taking a fill out of the fill's other drafts does, is marked so. It counts as a change to that draft, so its makers stay, rather than as the draft's end.
- **Private change:** A user's change to a record not yet published, which only they see, as [ADR 0008](../adr/0008-unpublished-drafts.md) sets out. It is kept for the record and the user, in the user's private set, with the value each field its maker changed started from. It holds those fields over whatever the published draft holds; a record its maker adds, or a change of action such as a removal, holds the whole draft. A record has at most one, and nobody else may change, approve or reject it until the user publishes or discards it. Publishing makes it a draft row.
- **Private set:** A user's private changes, made with their first one.
- **Draft row:** The values a record is to have once approved: all of them for a record to be added, those that differ from the live record for a change, or none for a removal. Each record has at most one, waiting or rejected with a reason.
  - **What has drafts:** people, planned hires, feature teams, lists, choices, columns, schedules, cycle patterns, releases, features, activities, customers, proposals, projects, milestones, allocations and the planning settings, and the order of each list's choices, held whole, as [ADR 0007](../adr/0007-draft-rows.md) sets out.
- **Record key:** A record's number within its kind, such as 123 for #FEATURE-123, shown after a # so it isn't taken for another tool's key.
  - **Held apart:** it is held apart from the record, so a record drafted to be added has one, and a removed record's key still names it.
  - **Numbers:** they count up from 1 for each kind and are never reused, even when a draft is discarded. Each kind keeps the last number it gave.
  - **Kinds:** FEATURE, ACTIVITY, PROJECT, PROPOSAL, CUSTOMER, MILESTONE, RELEASE, SCHEDULE, PERSON, HIRE, TEAM (a feature team), LIST, COLUMN, ACCOUNT and ROLE, each whole, never shortened. Cycles have none, since they are named with their schedule.
  - **Reading:** a key is read in any letter case, with or without the #. It is General data, telling nothing about its record, and stands beside an organization's own IDs rather than replacing them.
  - **Private records:** pages and rows have [random keys](#private-pages) instead, so their keys don't count them.
- **Snapshot:** A point-in-time copy of the plan, taken by hand or on a schedule, holding projects, features, and allocations only, with their custom field values. Not built yet.

### Drafts and Approval

- **What needs approval:** everything users change, except saved views, last views, team colours, and what an Administrator manages: accounts, roles, data classes and Fathom's settings.
- **Approving:** approving drafts, whether one or several at once, applies them all to the live records as one change set, or none of them.
- **Drafts that use drafts:** a draft uses another only when the other adds a record, with two exceptions.
  - **When the other adds a record:**
    - a choice added to a list drafted to be added
    - an order placing a choice drafted to be added
    - a column drawing on a list drafted to be added
    - a person or planned hire given a value in a column, or a choice, drafted to be added
    - a feature or an activity given a value in a column on Features or Activities, or a choice, drafted to be added
    - a record of the plan, such as a project, linking to one drafted to be added
  - **The exceptions:** a schedule's cycles, as [ADR 0010](../adr/0010-cycles-from-patterns.md) sets out, and a project's removal, which uses the removals of its milestones.
  - Approving a draft approves the drafts it uses with it, so the approver's role must approve the areas of both. A column, and a list made with it through New list, is approved in its table's area, so a feature or an activity given a value in a new column needs Approve Features alone, unless the column draws on a new list made on Lists, or the feature is given a new choice made on Lists in a live list, which also need Approve Configuration.
  - A draft that others use is rejected only together with them, or once they no longer use it.
  - It cannot be discarded, nor its adding undone, while others use it, except that discarding a list drafted to be added discards its choices' drafts, and discarding a schedule drafted to be added discards its cycles' and releases' drafts, whoever made them, and removing a project discards its new milestones' drafts. Only the draft asked for is checked, as the second exception under [Discarding a draft](../product/roles.md#approving) sets out.
  - A column on Features or Activities drafted to be added with a new list takes the list and its choices with it: adding them is one change, undone together, and discarding the draft of the last such column drawing on the list, whether the one it was made with or another since, discards the list's, unless anything changed the list since it was made, or someone else is changing it.
- **Feature teams:** a team's name, lead and member changes make one draft, approved or rejected together.
- **Lists:** a list cannot be drafted to be removed while its choices or their order have drafts, and the choices of a list drafted to be removed cannot be changed. A restored choice keeps its place in the order.
- **Undo:** takes back an edit to a draft. Approving and rejecting are not undone: an approved change is changed by a new draft, and a rejected draft by changing it.
- **Change history:** records every edit to a draft, and every approval and rejection. It cannot stop a change, so it does not replace approval.

## Not Yet Modelled

What the model leaves out, and where each stands:

- **Initiatives and themes:** not built in. An organization that uses them adds them as columns.
- **Increments of the same work:** links between such features are not built in either; such a column groups them.
- **Projects and products:** how they relate, if at all, is not yet decided.
- **Dependencies between features:** not recorded. If they are added, Fathom warns when a feature is planned before one it depends on, rather than moving dates.
- **Physical resources:** a future possibility in the [Product Brief](../product/brief.md#future-possibilities).
- **Dotted-line reporting and licences:** out of scope for v1, as listed in the [Product Brief](../product/brief.md).
