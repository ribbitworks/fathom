# Fathom: Roadmap

**Status:** Proposal for the owner's review
**Last updated:** 2026-11-12

A proposed order for delivering Fathom's goals. Goals are defined in the [Product Brief](brief.md), and this document only sequences them, noting where a stage delivers a cut-down version. The principles, stage contents, and order are not yet agreed. The privacy approval gate is agreed. Each stage is a [GitHub milestone](https://github.com/jlarue26/fathom/milestones) holding its features, as [Issues](../issues.md) sets out, so this document keeps each stage's goals and why.

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

Before Fathom goes live: IT approves the [IT Overview](../operations/it-overview.md), the [Security Plan](../security/security-plan.md) and the [Deployment](../operations/deployment.md) document, before Fathom is deployed to company infrastructure, deployment testing included; HR approves the data protection document for the data the first stage holds; a first set of roles is agreed; hosting and backups are set up; and scanning is in place, with the threat model reviewed for the stage going live. Each is an issue in the [Before Going Live](https://github.com/jlarue26/fathom/milestone/6) milestone.

## Stage: Who Is Working on What

Covers the owner's immediate needs. Each goal starts in its simplest useful form, and the first stage shows the plan in tables, simple charts, the Features Board, and timelines, rather than an interactive Gantt view whose bars are dragged to new dates. What remains is in the [Who Is Working on What](https://github.com/jlarue26/fathom/milestone/1) milestone, and what is built is in the [Implementation Plan](../design/implementation-plan.md).

## Stage: Snapshots, Exports, and Hiring

The hiring workflow, moving planned hires between states as each role allows; snapshots of the plan; exports; and gender among people's details. Its features are in the [Snapshots, Exports, and Hiring](https://github.com/jlarue26/fathom/milestone/2) milestone.

## Stage: Your Own Fields and Tables

Custom fields and tables, and every type of column users add, on People and other tables. Its features are in the [Your Own Fields and Tables](https://github.com/jlarue26/fathom/milestone/3) milestone.

## Stage: The Organization

Planned reporting changes, columns that change over time, users seeing their own record and their reports', a unified people view, and the remaining team composition measures. Its features are in [The Organization](https://github.com/jlarue26/fathom/milestone/4) milestone.

## Stage: Planning Ahead

What-if scenarios, if confirmed. In the [Planning Ahead](https://github.com/jlarue26/fathom/milestone/5) milestone.

## Not Yet Placed

Goals the owner has added that are not yet placed in a stage are [Feature issues in no milestone](https://github.com/jlarue26/fathom/issues?q=is%3Aissue+is%3Aopen+label%3Aenhancement+no%3Amilestone).

These five stages make up v1. Broader configuration for other domains, and the future possibilities listed in the brief, come after v1.

## Open Questions

1. **First stage scope:** Is the first stage the right size, and are the cut-down versions acceptable?
1. **Stage order:** Is the order after the first stage right? For example, should the org chart come earlier, and should custom fields and tables come right after Snapshots, Exports, and Hiring, as proposed?
1. **Access by scope:** Questions for when v2 is designed, none decided yet, with a recommendation where there is one:
   1. **Departments:** Drawn from reporting lines, a manager heading a department with everyone under them in it, or tagged on each record? Unlike a team, which is one manager's direct reports, a department reaches down every level. Recommended: drawn from reporting lines, since tags drift from the org chart. Once decided, the term is defined in [Domain Concepts](domain.md).
   1. **Myself and my reports:** Direct reports only, or everyone under the reader, and do planned reports count? Recommended: everyone under them, as [Roles](roles.md#access-to-your-own-record-and-your-reports) proposes for a user's own reports. Planned reports would still need Confidential data, while Roles proposes that planned reporting changes grant nothing until they take effect.
   1. **Records across departments:** Do features and projects that span departments take theirs from their feature team, or are they tagged?
   1. **Totals and metrics:** Should they count only the rows in scope, so they reveal nothing outside it, as [Totals in Metrics](https://github.com/jlarue26/fathom/issues/367) and People's [metrics](decisions.md#configuration) count the rows shown?
   1. **The org chart:** What does a scoped reader see of the chain above them?
   1. **Approvers:** Does an Approver need the record in their scope?
   1. **Saying what is left out:** How does a page say what it leaves out, such as "Shows only the Platform department"?
   1. **Enforcement:** How are scopes enforced? Recommended: row-level security in one Postgres schema, which fails closed, over a schema for each department, which copes badly with people moving between departments, readers across several, and migrations run once per schema. Separate schemas suit only several organizations in one Fathom. The answer is recorded in an ADR and the [Security Plan](../security/security-plan.md).
