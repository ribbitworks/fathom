# Fathom: Roadmap

**Last updated:** 2026-11-18

The order for delivering Fathom's goals. Goals are defined in the [Product Brief](brief.md), and this document only sequences them, noting where a stage delivers a cut-down version. Each stage is a [GitHub milestone](https://github.com/ribbitworks/fathom/milestones) holding its features, as [Issues](../standards/issues.md) sets out, so this document keeps each stage's goals and why.

## Guiding Principles

- **Most pressing first:** The first stage covers the most pressing need: who is working on what.
- **Complete stages:** Each stage is fully functional and fully tested. Stages are cut down in scope, never in quality.
- **Only the data each stage needs:** Each stage holds only the details about people it uses.
- **Use cases first:** Each feature meets its [use cases](use-cases.md) first, then becomes as configurable as practical. Configuration already designed for a feature ships with it.

## Before Going Live

Before Fathom's first release: a first set of roles is agreed, and the [Security Plan](../security/security-plan.md) is reviewed for the stage being released. Each is an issue in the [Before Going Live](https://github.com/ribbitworks/fathom/milestone/6) milestone.

## Coming Next

These are built in this order, with views on every page alongside the rest.

1. **Views on every page:** personal and shared saved views on every page with a table, and on the Org chart, Feature assignments, Capacity's People mode and Drafts. Views also hide columns, group People, and bring the Lists page onto the shared table ([#75](https://github.com/ribbitworks/fathom/issues/75)) and the Org chart's choices into its views.
1. **Allocating from the grid:** allocating people and planned hires to features from Capacity's monthly grid, as drafts, with a Warnings filter ([#206](https://github.com/ribbitworks/fathom/issues/206)).
1. **Demand and Capacity's Work mode:** Capacity's Demand mode, comparing features' estimates with capacity in a table and a bar chart ([#209](https://github.com/ribbitworks/fathom/issues/209)), and its Work mode, the Plan of staffed work on the shared timeline ([#204](https://github.com/ribbitworks/fathom/issues/204)).
1. **Added columns and Metrics:** Text and Date columns ([#216](https://github.com/ribbitworks/fathom/issues/216)), brought forward from [Your Own Fields and Tables](#stage-your-own-fields-and-tables), and Record columns that pick a record of another table, on People and Features; who adds Features' columns ([#13](https://github.com/ribbitworks/fathom/issues/13)); values in a column only drafted to be added ([#61](https://github.com/ribbitworks/fathom/issues/61)); and totals in Metrics for numbers and effort ([#117](https://github.com/ribbitworks/fathom/issues/117), [#60](https://github.com/ribbitworks/fathom/issues/60)) and for dates ([#57](https://github.com/ribbitworks/fathom/issues/57)).

## Stage: Who Is Working on What

Each goal starts in its simplest useful form, and this stage shows the plan in tables, simple charts, the Features Board, and timelines, rather than an interactive Gantt view whose bars are dragged to new dates. What remains is in the [Who Is Working on What](https://github.com/ribbitworks/fathom/milestone/1) milestone.

## Stage: Snapshots, Exports, and Hiring

The hiring workflow, moving planned hires between states as each role allows; snapshots of the plan; and exports. Its features are in the [Snapshots, Exports, and Hiring](https://github.com/ribbitworks/fathom/milestone/2) milestone.

## Stage: Your Own Fields and Tables

Custom fields and tables, and every type of column users add, on People and other tables, apart from Text and Date columns, which come sooner, as [Coming Next](#coming-next) sets out. Its features are in the [Your Own Fields and Tables](https://github.com/ribbitworks/fathom/milestone/3) milestone. Lookup columns, which follow a link, and Duration columns come in v1.1.

## Stage: The Organization

Planned reporting changes, columns that change over time, users seeing their own record and their reports', a unified people view, and the remaining team composition measures. Its features are in [The Organization](https://github.com/ribbitworks/fathom/milestone/4) milestone.

## Stage: Planning Ahead

What-if scenarios, if confirmed. In the [Planning Ahead](https://github.com/ribbitworks/fathom/milestone/5) milestone.

## Not Yet Placed

Goals not yet placed in a stage are [Feature issues in no milestone](https://github.com/ribbitworks/fathom/issues?q=is%3Aissue+is%3Aopen+label%3Aenhancement+no%3Amilestone).

These five stages make up v1. Broader configuration for other domains, and the future possibilities listed in the brief, come after v1.
