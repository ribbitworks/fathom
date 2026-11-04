# Roadmap and Timeline Views

- **ADR:** 0009
- **Status:** Proposed
- **Date:** 2026-11-03

## Context

The [Product Brief](../product/brief.md#goals-for-v1) asks for a roadmap view, where Product Managers shape the roadmap of features by cycle and release and leadership reads it, and a timeline or Gantt view, which changes dates and assignments by drag and drop. The [Roadmap](../product/roadmap.md#stage-the-organization) places both in The Organization stage, after the first stage's table of features grouped by cycle. [ADR 0004](0004-ui-components.md) chose vis-timeline for them, to be confirmed when that stage starts.

What the views move is coarse, as the [Decisions Log](../product/decisions.md#planning) sets out:

- **Features target cycles:** A feature's start and end are months that follow from its allocations, and only milestones have dates to the day. Moving a feature means changing its target cycle, or its feature team, not dragging free dates.
- **Work can take longer than a cycle:** Work may need allocations over several cycles. As the Decisions Log's feature scope sets out, it is then split into one feature for each increment, each targeting its own cycle, or kept as one feature behind a feature flag, whose allocations span the cycles before the one it targets.
- **No dependency lines:** Dependencies between features are not recorded, and Fathom plans features, never tasks.
- **Every change is a draft:** Moves are drafts, private until published, as [ADR 0007](0007-draft-rows.md) and [ADR 0008](0008-unpublished-drafts.md) set out, shown with the marks every other table uses.

Every choice must meet ADR 0004's rules: completely open source with no paid edition, bundled and working offline, no code built from strings, React 19, and actively maintained. The candidates below were compared from GitHub and npm on 2026-11-03, without test pages; sizes are minified and compressed, from bundlephobia.

| Candidate | Licence | Maintenance | Moving and resizing | Rows | Keyboard and screen readers | Size |
| --- | --- | --- | --- | --- | --- | --- |
| [vis-timeline](https://github.com/visjs/vis-timeline) | Apache-2.0 or MIT | Active: 8.5.6 in October 2026, 301 open issues | Free time axis, between groups | Groups, nested | No keyboard moving or ARIA; labels are HTML; not a React component | About 120 kB, with moment, about 77 kB, and eight other peers |
| [react-calendar-timeline](https://github.com/namespace-ee/react-calendar-timeline) | MIT | Slow: the npm release marked latest is a beta, supporting React 19 only through a release candidate's version range | Both | Groups | Mouse only | Not measured: bundlephobia leaves out its peers, interactjs, dayjs, and lodash |
| [Frappe Gantt](https://github.com/frappe/gantt) | MIT | Active: 1.2.2 on npm in February 2026 | Both, snapping | One task a row, no groups | No keyboard support; popups are HTML strings | About 14 kB |
| [dnd-timeline](https://github.com/samuelarbibe/dnd-timeline) | MIT | Active, mostly one maintainer: 3.1.1 | Both, through hooks without styles | Grouped, nested, sortable | Built on @dnd-kit/core, whose keyboard sensor and announcements Fathom would wire up | About 21 kB, with @dnd-kit/core |
| Fathom's own, on Mantine and @hello-pangea/dnd | Apache-2.0 and MIT, already used | Fathom maintains it | Between cycles and rows; no resizing | As Fathom needs | Fathom's own Alt and arrow keys and menus, as for ordering in ADR 0004 | Nothing added |

[SVAR React Gantt](https://svar.dev/react/gantt/), [DHTMLX Gantt](https://dhtmlx.com/docs/products/dhtmlxGantt/), and [Bryntum](https://bryntum.com) are open-core or paid, and [gantt-task-react](https://github.com/MaTeMaTuK/gantt-task-react) is archived, so they are ruled out.

## Decision

- **Fathom's own view:** The roadmap and the timeline are one board built on Mantine: a column for each cycle, and on the timeline a row for each feature team, laid out as [Visual Design](../design/visual-design.md#components) sets out. Cards are moved with the mouse by @hello-pangea/dnd, as ADR 0004 chose for ordering, with each cycle of each row its own list, since the library moves items between lists but does not lay out a grid. Keyboard users move cards with Fathom's own keys and menus, as for ordering.
- **Moves are drafts:** Dropping a card on another cycle or row changes the feature's target cycle or feature team through the same draft functions every table uses.
- **No timeline library:** vis-timeline, chosen in ADR 0004 to be confirmed, is not used; this replaces that choice once accepted.
- **Fallback:** If dragging months freely or resizing bars turns out to be needed, dnd-timeline is the first library to try, styled with Mantine.

## Consequences

- **Fathom maintains the board,** as it does the spreadsheet tables, in return for drafts shown as everywhere else and no new dependency, and none of moment, HTML labels, or a wrapper around a component that is not React.
- **Bars cross cycles:** A feature's bar spans its allocated months across cycle columns, so each feature has its own lane in its feature team's row, with its bar drawn in a layer behind the cycles' lists and its card at the bar's end, in its target cycle. A board of Fathom's own does this without a time axis library, but lanes make rows taller, which the design weighs. How bars line up with cycles measured in weeks is settled with the design.
- **The brief's dates and assignments are narrowed:** The first version moves target cycles and feature teams only. Dragging a bar to shift a feature's allocations by months would make many allocation drafts at once, so it is left out until the owner decides it is needed, as the brief's open questions ask.
- **More reliance on @hello-pangea/dnd,** whose last release was in February 2025. Moving it out would touch both ordering and the board, with `@dnd-kit/react` the replacement ADR 0004 names.
- **To be iterated:** The design is a first sketch, revised with the owner before The Organization stage starts. How a cycle's demand is counted waits on the open question of feature effort over time in the [Decisions Log](../product/decisions.md#planning).
