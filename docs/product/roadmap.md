# Fathom — Roadmap

**Status:** Proposal for the owner's review
**Last updated:** 2026-10-31

A proposed order for delivering Fathom's goals. Goals are defined in the [Product Brief](brief.md), and this document only sequences them, noting where a stage delivers a cut-down version. The principles, stage contents, and order are not yet agreed. The privacy approval gate is agreed.

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

Covers the owner's immediate needs. Each goal starts in its simplest useful form, and the first stage shows the plan in tables and simple charts rather than an interactive Gantt view.

- **People and teams:** Includes feature teams and feature leads. Employee details are limited to the General tier plus start and end dates.
- **Org structure:** People managers and their current direct reports, without planned changes or the org chart.
- **Change history:** Who changed what, and when, for the data each user may see.
- **Plan approval:** Drafts and their approval, built on people first, so every later table follows the same pattern. Includes feature team approval, in which People Managers' proposals are approved by an Approver.
- **Roadmap view:** First built as the Product Manager's working roadmap, an input to the rest of the plan: features in a table grouped by cycle. The visual roadmap comes in a later stage.
- **Release planning:** Cycles, releases, and patches.
- **Lists drawn from a table:** Added by the owner. A list whose choices are the values of a chosen column in a chosen table, such as product names, so a column elsewhere can pick from them without the values being kept twice.
- **Projects, features, and milestones:** Projects and milestones, building on the roadmap's features.
- **Resource assignment** and **Capacity visibility**
- **Team composition:** Reports per manager compared with a target, without filters.
- **Hiring plan:** Planned hires and ramp-up, without the role-controlled hiring workflow.
- **Demand forecasting:** One estimate per feature.
- **Roles:** A fixed set of roles, with access tiers and access history for start and end dates, and the hiring plan. Project Managers see feature teams with the plan, approve them, and may give other input, still to be confirmed in the [Product Brief](brief.md)'s open questions.

## Stage: Snapshots, Exports, and Hiring

- **Hiring workflow:** Moving planned hires between states, controlled by role.
- **Snapshots**
- **Exports**
- **People and teams:** Gender.

## Stage: Your Own Fields and Tables

- **Custom fields and tables**, as set out in the [Decisions Log](decisions.md#configuration)
- **More column types:** Columns that users add, on People and other tables, of every type [ADR 0005](../adr/0005-flexible-data-model.md) sets out, such as text, number, date, and yes or no, shown as a checkbox, alongside choices from a list. The owner also asked for currency, which ADR 0005 does not cover yet.

## Stage: The Organization

- **Org structure:** Planned reporting changes and the org chart.
- **Own record and reports:** Users see their own record and their reports' records through a link to their person record, as proposed in [Roles](roles.md).
- **Unified people view**
- **Team composition:** The remaining measures, such as test-to-development ratios.
- **Timeline / Gantt view**
- **Roadmap view:** The visual roadmap, still to be designed. One idea is a board of cycles, with features as cards, showing each cycle's estimated demand against the capacity available.

## Stage: Planning Ahead

- **What-if scenarios**, if confirmed

## Not Yet Placed

Goals the owner has added that are not yet placed in a stage:

- **Pinned views:** A saved view kept visible as its own table, alongside the table's own view, until it is unpinned. Until then, pinning a view means applying it, as the [Decisions Log](decisions.md) records.
- **Private views:** A saved view is either private, seen only by the user who saved it, or shared, seen by everyone who may see the data it shows. Until then, every saved view is shared, as the [Decisions Log](decisions.md) records.
- **Frozen header row:** A table's header row stays in view while its rows scroll.
- **Totals:** Totals over the rows shown, such as a count of rows or a sum, which follow the filters as they are added and removed. Counts work on any column, but sums and other totals of amounts need the number and currency column types under Your Own Fields and Tables.
- **Help:** More help, such as for Fathom's pages and terms, beyond Help's Roles page.
- **Renaming terms:** An organization renames Fathom's terms to its own, such as Feature to Epic, or Cycle to Program Increment.
- **Colours for choices:** Choices can be shown in their own colours, so values stand out in tables. Still open: whether colours belong to a list's choices, set when they are added, to a table view, like conditional highlighting in a spreadsheet, or to both.

These five stages make up v1. Broader configuration for other domains, and the future possibilities listed in the brief, come after v1.

## Open Questions

1. **First stage scope:** Is the first stage the right size, and are the cut-down versions acceptable?
1. **Stage order:** Is the order after the first stage right? For example, should the org chart come earlier, and should custom fields and tables come right after Snapshots, Exports, and Hiring, as proposed?
