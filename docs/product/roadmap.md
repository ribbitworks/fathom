# Fathom: Roadmap

**Status:** Proposal for the owner's review
**Last updated:** 2026-11-12

A proposed order for delivering Fathom's goals. Goals are defined in the [Product Brief](brief.md), and this document only sequences them, noting where a stage delivers a cut-down version. The principles, stage contents, and order are not yet agreed. The privacy approval gate is agreed. Each stage is to become a GitHub milestone, as [Issues](../issues.md) sets out.

## Guiding Principles

- **Immediate needs first:** The first stage covers the owner's immediate needs.
- **Complete stages:** Each stage is fully functional and fully tested. Stages are cut down in scope, never in quality.
- **Only the sensitive data each stage needs:** Each stage holds only the employee details it uses, so the first privacy review stays small.
- **Owner's requirements first:** Each feature meets the owner's requirements and use cases first, then becomes as configurable as practical. Configuration already decided in the [Decisions Log](decisions.md) ships with its feature.

## Before Development

Development uses fictional data only.

## After Hello Fathom

- **Component evaluation:** UI components, styling, and charts are chosen, and Gantt, timeline, and org chart components are evaluated, before any UI work beyond Hello Fathom. By the owner's choice, Hello Fathom's placeholder page counts as groundwork rather than UI work.
- **Visual design:** A visual and user experience design is agreed before the rest of the first stage's screens are built.

## Before Going Live

- **IT approval:** IT approves the [IT Overview](../operations/it-overview.md), the Security Plan, and the [Deployment](../operations/deployment.md) document before Fathom is deployed to company infrastructure, including for deployment testing.
- **Privacy approval:** Before the first stage goes live, HR approves the data protection document for the data it holds.
- **Roles:** A first set of roles is agreed, from the proposal in [Roles](roles.md).
- **Hosting:** Hosting and backups are set up as described in [ADR 0001](../adr/0001-tech-stack.md) and [Supported Platforms](../operations/supported-platforms.md).
- **Security:** Scanning from the [Security Plan](../security/security-plan.md) is in place, and the threat model has been reviewed for the stage going live.

## Stage: Who Is Working on What

Covers the owner's immediate needs. Each goal starts in its simplest useful form, and the first stage shows the plan in tables, simple charts, the Features Board, and timelines, rather than an interactive Gantt view whose bars are dragged to new dates.

- **People and teams:** Includes feature teams and feature leads. Employee details are limited to the General tier plus start and end dates.
- **Org structure:** People managers and their current direct reports, and the org chart of reporting lines, today or, for those who see Personal details, on a chosen date, without planned changes. The owner brought the org chart forward from The Organization stage, as the [Decisions Log](decisions.md#workforce) records.
- **Change history:** Who changed what, and when, for the data each user may see.
- **Plan approval:** Drafts and their approval, built on people first, so every later table follows the same pattern. Includes feature team approval, in which Engineering Managers' proposals are approved by an Approver.
- **Projects, proposals, and feature teams:** Projects with their milestones, proposals, and feature teams, built before the roadmap's features, as the [Decisions Log](decisions.md#planning) sets out. Their links to features come with the roadmap view. Feature teams include planned membership changes and leads, a monthly grid of who is on which team, and the org chart on a chosen date, brought forward from The Organization stage by the owner on 2026-11-08, as the [Decisions Log](decisions.md#workforce) records.
- **Roadmap view:** First built as the Product Manager's working roadmap, an input to the rest of the plan: features in a table grouped by cycle.
- **The Roadmap and the Plan:** Brought forward from The Organization stage by the owner on 2026-11-11, as [The Roadmap and the Plan](decisions.md#planning) sets out: the Features Board, the visual roadmap; the Plan, staffed work in the Capacity page's Work mode; a timeline of projects; and the shared timeline all three use with Releases, which replaces the timeline or Gantt view.
- **Release planning:** Cycles, releases, and release streams.
- **Lists drawn from a table:** Added by the owner. A list whose choices are the values of a chosen column in a chosen table, such as product names, so a column elsewhere can pick from them without the values being kept twice.
- **Web link columns:** Added by the owner. A column on People holding one web link for each person, ahead of the other column types.
- **Note columns:** Added by the owner. A column on People holding one rich-text note for each person, and notes on releases, built on one shared note format.
- **Number columns:** Added by the owner. A column on People and planned hires holding one number for each record, ahead of the other column types.
- **Resource assignment** and **Capacity visibility**
- **Project activities:** Added by the owner on 2026-11-10, built once allocations can be entered in the monthly resource grid, as the [Decisions Log](decisions.md#planning) sets out.
- **Team composition:** Reports per manager compared with a target, without filters.
- **Hiring plan:** Planned hires and ramp-up, without the role-controlled hiring workflow.
- **Planned managers:** Added by the owner on 2026-11-07. A planned hire can be marked as a manager in People's Manager? column, as a person is, so other planned hires can report to it, and the org chart shows it heading its planned team. People keep reporting to people until planned reporting changes come in The Organization stage. Filling a planned manager moves the hires that report to it to the person who fills it. It follows the Left state.
- **People on a date:** Added by the owner on 2026-11-11. People read as of a chosen date, as the org chart is, with the planned hires not yet filled beside today's people, as [People over time](decisions.md#workforce) sets out. Built after the current changes that reach across many pages.
- **Demand forecasting:** One estimate per feature.
- **Overview:** Added by the owner on 2026-11-11. A page of links to what needs attention, as [The Overview page](decisions.md#planning) sets out, built after The Roadmap and the Plan, since it shows which features are Late, Not staffed or Critical, and how much capacity is used.
- **Roles:** A fixed set of roles, with access tiers and access history for start and end dates, and the hiring plan. Project Managers see feature teams on the org chart, approve them, and may give other input, still to be confirmed in the [Product Brief](brief.md)'s open questions.

## Stage: Snapshots, Exports, and Hiring

- **Hiring workflow:** Moving planned hires between states, controlled by role.
- **Snapshots**
- **Exports:** CSV and TSV first, begun by the owner on 2026-11-11, as the [Implementation Plan](../design/implementation-plan.md#exports) sets out; PNG and PDF of timelines, Feature boards and Org charts later.
- **People and teams:** Gender.

## Stage: Your Own Fields and Tables

- **Custom fields and tables**, as set out in the [Decisions Log](decisions.md#configuration)
- **More column types:** Columns that users add, on People and other tables, of every type [ADR 0005](../adr/0005-flexible-data-model.md) sets out, such as text, date, and yes or no, shown as a checkbox, alongside choices from a list, web links, notes, and numbers, which come earlier. The owner also asked for currency, which ADR 0005 does not cover yet.

## Stage: The Organization

- **Org structure:** Planned reporting changes.
- **Dated columns:** Added by the owner on 2026-11-11, beside planned reporting changes, as [People over time](decisions.md#workforce) sets out: first, drafts that hold several dated changes for each person; then dated values, with Position first and each person's history in their details; then the "Changes over time" setting on added columns, with reporting lines moved onto the same store.
- **Own record and reports:** Users see their own record and their reports' records through a link to their person record, as proposed in [Roles](roles.md).
- **Unified people view**
- **Team composition:** The remaining measures, such as test-to-development ratios.

## Stage: Planning Ahead

- **What-if scenarios**, if confirmed

## Not Yet Placed

Goals the owner has added that are not yet placed in a stage:

- **Pinned views:** A saved view pinned to the sidebar as a page of its own, under its name in a My pages group, opening its table with the view applied, until it is unpinned, through **Pin to sidebar** and **Unpin** in the Views menu, proposed by the owner on 2026-11-07. Pinning is kept for each person, with no new kind of page or permission. To settle when built: whether a pinned shared view shows in everyone's sidebar, or is offered to each person to pin. Until then, pinning a view means applying it, as the [Decisions Log](decisions.md) records.
- **Hiding columns:** Any column, built-in ones included, can be hidden from a table's view, and shown again, with hidden columns kept in saved views. Deleting an added column is offered in its column menu too, not only in its dialog. Wanted after the product features, by the owner on 2026-11-09.
- **Row timestamps:** Every database row records when it was created and last updated.
- **Totals:** Sums and other totals of amounts over the rows shown, which follow the filters as they are added and removed, once the number and currency column types under Your Own Fields and Tables exist. Counts and shares of a column's values are already given by People's [metrics](decisions.md#configuration).
- **Help:** More help, such as for Fathom's pages and terms, beyond Help's Roles and Drafts pages.
- **Renaming terms:** An organization renames Fathom's terms to its own, such as Feature to Epic, or Cycle to Program Increment.
- **Colours for choices:** Choices can be shown in their own colours, so values stand out in tables. Still open: whether colours belong to a list's choices, set when they are added, to a table view, like conditional highlighting in a spreadsheet, or to both.
- **Importing people:** Added by the owner. Adding and updating people from a CSV or TSV file. Moved out of the first stage and v1 by the owner on 2026-11-07, for v1.1, so the remaining v1 work goes to its core: filling planned hires, feature teams, and team composition.
- **Publishing chosen drafts:** On the Drafts page, a user ticks some of their own unpublished drafts and publishes them for approval, or discards them, leaving the rest unpublished. Today Publish and Discard all act on every unpublished draft at once. A draft that uses another unpublished draft goes with it: ticking one ticks those it needs, and says so. Asked for by the owner on 2026-11-05.
- **Building up an estimate:** A spreadsheet-like worksheet for a feature, where its estimate is built up from rows of work, each with its own effort, whose total becomes the feature's estimate. A v2 feature, added by the owner on 2026-11-09.
- **Private tables:** A user creates pages of their own that are tables, private to them for now. Their columns link to records anywhere in Fathom, or are read-only lookups showing a linked record's values, only those the user may see. Values save at once, with Undo and no drafts. A v2 feature, added by the owner on 2026-11-11.
- **Access by scope:** [Data classes](decisions.md#people-and-privacy) decide which fields a role sees; a scope decides whose records it sees. A role's scope is one of four. Myself is the reader's own People data. Myself and my reports adds the people who report to the reader. My department covers the records marked with a named department, and a user may belong to one or more departments. Everyone is as today. It meets a need the owner decided on 2026-11-04 must be met: permissions apply to everyone's data, so Engineering Managers see Personal details for everyone, and a Project Manager cannot be limited to editing their own projects. It waits until roles are editable, and may build on a user's link to their own person record, proposed in [Roles](roles.md#access-to-your-own-record-and-your-reports) and placed under [The Organization](#stage-the-organization). A v2 feature, added by the owner on 2026-11-11, with its questions under [Open Questions](#open-questions). Beyond these four, a scope may also follow feature teams and reporting teams, such as a role limited to its own feature team's features, or to colouring its own teams, asked about by the owner on 2026-11-07, once accounts are linked to people.
- **Automated UI tests:** The manual tests' journeys run in a real browser with Playwright, as [ADR 0002](../adr/0002-libraries.md) chose, against a database of their own, starting with the happy path of Releases, so the manual tests keep only what a person must judge, such as how a screen looks and whether it is clear. A low priority, added by the owner on 2026-11-04.

These five stages make up v1. Broader configuration for other domains, and the future possibilities listed in the brief, come after v1.

## Open Questions

1. **First stage scope:** Is the first stage the right size, and are the cut-down versions acceptable?
1. **Stage order:** Is the order after the first stage right? For example, should the org chart come earlier, and should custom fields and tables come right after Snapshots, Exports, and Hiring, as proposed?
1. **Access by scope:** Questions for when v2 is designed, none decided yet, with a recommendation where there is one:
   1. **Departments:** Drawn from reporting lines, a manager heading a department with everyone under them in it, or tagged on each record? Unlike a team, which is one manager's direct reports, a department reaches down every level. Recommended: drawn from reporting lines, since tags drift from the org chart. Once decided, the term is defined in [Domain Concepts](domain.md).
   1. **Myself and my reports:** Direct reports only, or everyone under the reader, and do planned reports count? Recommended: everyone under them, as [Roles](roles.md#access-to-your-own-record-and-your-reports) proposes for a user's own reports. Planned reports would still need Confidential data, while Roles proposes that planned reporting changes grant nothing until they take effect.
   1. **Records across departments:** Do features and projects that span departments take theirs from their feature team, or are they tagged?
   1. **Totals and metrics:** Should they count only the rows in scope, so they reveal nothing outside it, as [Totals](#not-yet-placed) and People's [metrics](decisions.md#configuration) count the rows shown?
   1. **The org chart:** What does a scoped reader see of the chain above them?
   1. **Approvers:** Does an Approver need the record in their scope?
   1. **Saying what is left out:** How does a page say what it leaves out, such as "Shows only the Platform department"?
   1. **Enforcement:** How are scopes enforced? Recommended: row-level security in one Postgres schema, which fails closed, over a schema for each department, which copes badly with people moving between departments, readers across several, and migrations run once per schema. Separate schemas suit only several organizations in one Fathom. The answer is recorded in an ADR and the [Security Plan](../security/security-plan.md).
