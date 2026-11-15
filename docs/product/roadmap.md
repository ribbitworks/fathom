# Fathom: Roadmap

**Last updated:** 2026-11-14

The order for delivering Fathom's goals. Goals are defined in the [Product Brief](brief.md), and this document only sequences them, noting where a stage delivers a cut-down version. Each stage is a [GitHub milestone](https://github.com/jlarue26/fathom/milestones) holding its features, as [Issues](../issues.md) sets out, so this document keeps each stage's goals and why.

## Guiding Principles

- **Immediate needs first:** The first stage covers the maintainer's immediate needs.
- **Complete stages:** Each stage is fully functional and fully tested. Stages are cut down in scope, never in quality.
- **Only the data each stage needs:** Each stage holds only the details about people it uses.
- **Maintainer's requirements first:** Each feature meets the maintainer's requirements and use cases first, then becomes as configurable as practical. Configuration already decided in the [Decisions Log](decisions.md) ships with its feature.

## Before Development

Development uses fictional data only.

## After Hello Fathom

- **Component evaluation:** UI components, styling, and charts are chosen, and Gantt, timeline, and org chart components are evaluated, before any UI work beyond Hello Fathom. By the maintainer's choice, Hello Fathom's placeholder page counts as groundwork rather than UI work.
- **Visual design:** A visual and user experience design is agreed before the rest of the first stage's screens are built.

## Before Going Live

Before Fathom's first release: a first set of roles is agreed, and the [Security Plan](../security/security-plan.md) is reviewed for the stage being released. Each is an issue in the [Before Going Live](https://github.com/jlarue26/fathom/milestone/6) milestone.

## Coming Next

The maintainer approved these designs on 2026-11-14. They are built in this order, with the first two alongside the other three. How each is built is in the [Implementation Plan](../design/implementation-plan.md#slices).

1. **Views on every page:** personal and shared saved views on every page with a table, and on the Org chart, Feature assignments, Capacity's People mode and Drafts. Views also hide columns ([#517](https://github.com/jlarue26/fathom/issues/517)), group People ([#553](https://github.com/jlarue26/fathom/issues/553)), and bring the Lists page onto the shared table ([#317](https://github.com/jlarue26/fathom/issues/317)) and the Org chart's choices into its views ([#351](https://github.com/jlarue26/fathom/issues/351)).
1. **Group by several values:** a record shown under each of its values, such as a feature under each project that needs it, on Features, the Features Board and People's feature teams ([#594](https://github.com/jlarue26/fathom/issues/594)). Built partway through views on every page.
1. **Allocating from the grid:** allocating people and planned hires to features from Capacity's monthly grid, as drafts, with a Warnings filter ([#493](https://github.com/jlarue26/fathom/issues/493)).
1. **Demand and Capacity's Work mode:** Capacity's Demand mode, comparing features' estimates with capacity in a table and a bar chart ([#496](https://github.com/jlarue26/fathom/issues/496)), and its Work mode, the Plan of staffed work on the shared timeline ([#491](https://github.com/jlarue26/fathom/issues/491)).
1. **Added columns and Metrics:** Text and Date columns ([#504](https://github.com/jlarue26/fathom/issues/504)), brought forward from [Your Own Fields and Tables](#stage-your-own-fields-and-tables), and Record columns that pick a record of another table, on People and Features; who adds Features' columns ([#240](https://github.com/jlarue26/fathom/issues/240)); values in a column only drafted to be added ([#296](https://github.com/jlarue26/fathom/issues/296)); and totals in Metrics for numbers and effort ([#367](https://github.com/jlarue26/fathom/issues/367), [#295](https://github.com/jlarue26/fathom/issues/295)) and for dates ([#291](https://github.com/jlarue26/fathom/issues/291)).

## Stage: Who Is Working on What

Covers the maintainer's immediate needs. Each goal starts in its simplest useful form, and the first stage shows the plan in tables, simple charts, the Features Board, and timelines, rather than an interactive Gantt view whose bars are dragged to new dates. What remains is in the [Who Is Working on What](https://github.com/jlarue26/fathom/milestone/1) milestone, and what is built is in the [Implementation Plan](../design/implementation-plan.md).

## Stage: Snapshots, Exports, and Hiring

The hiring workflow, moving planned hires between states as each role allows; snapshots of the plan; and exports. Its features are in the [Snapshots, Exports, and Hiring](https://github.com/jlarue26/fathom/milestone/2) milestone.

## Stage: Your Own Fields and Tables

Custom fields and tables, and every type of column users add, on People and other tables, apart from Text and Date columns, which come sooner, as [Coming Next](#coming-next) sets out. Its features are in the [Your Own Fields and Tables](https://github.com/jlarue26/fathom/milestone/3) milestone.

## Stage: The Organization

Planned reporting changes, columns that change over time, users seeing their own record and their reports', a unified people view, and the remaining team composition measures. Its features are in [The Organization](https://github.com/jlarue26/fathom/milestone/4) milestone.

## Stage: Planning Ahead

What-if scenarios, if confirmed. In the [Planning Ahead](https://github.com/jlarue26/fathom/milestone/5) milestone.

## Not Yet Placed

Goals the maintainer has added that are not yet placed in a stage are [Feature issues in no milestone](https://github.com/jlarue26/fathom/issues?q=is%3Aissue+is%3Aopen+label%3Aenhancement+no%3Amilestone).

These five stages make up v1. Broader configuration for other domains, and the future possibilities listed in the brief, come after v1.
