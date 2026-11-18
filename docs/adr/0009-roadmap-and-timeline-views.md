# Roadmap and Timeline Views

- **ADR:** 0009
- **Status:** Superseded by [The Roadmap and the Plan](../product/decisions.md#planning), agreed by the maintainer on 2026-11-11. Its choice of libraries, below, still stands, as its revision of 2026-11-11 records
- **Date:** 2026-11-03
- **Revised:** 2026-11-03, to point to the Decisions Log's answer on how a cycle's demand is counted, and to the board's test page in the Implementation Plan; 2026-11-10, since large work is no longer split into a feature for each increment; 2026-11-11, since the board and timeline it proposed were revised with the maintainer into the Features Board and the shared timeline, keeping the choice of libraries; 2026-11-12, marked superseded; 2026-11-15, to note that release streams, the streams below, are now called schedules

## Context

The [Product Brief](../product/brief.md#goals-for-v1) asks for a roadmap view, where Product Managers shape the roadmap of features by cycle and release and leadership reads it, and a timeline or Gantt view, which changes dates and assignments by drag and drop. The [Roadmap](../product/roadmap.md#stage-who-is-working-on-what) places both in the first stage, after its table of features grouped by cycle, where the maintainer moved them from The Organization stage on 2026-11-11. [ADR 0004](0004-ui-components.md) chose vis-timeline for them, to be confirmed later; this ADR replaces that choice.

What the views move is coarse, as the [Decisions Log](../product/decisions.md#planning) sets out:

- **Features target cycles:** A feature's start and end are months that follow from its allocations, and only milestones have dates to the day. Moving a feature means changing its target cycle, or the value its row on the board stands for, such as its feature team, not dragging free dates.
- **Work can take longer than a cycle:** Work may need allocations over several cycles. As the Decisions Log's feature scope sets out, it stays one feature, which targets the cycle it is delivered in, and whose allocations span the cycles before it.
- **No dependency lines:** Dependencies between features are not recorded, and Fathom plans features, never tasks.
- **Every change is a draft:** Moves are drafts, private until published, as [ADR 0007](0007-draft-rows.md) and [ADR 0008](0008-unpublished-drafts.md) set out, shown with the marks every other table uses.

On 2026-11-11 the maintainer revised the board and timeline below, keeping the choice of libraries: the board became the Features Board, the Roadmap, whose columns are one stream's cycles and whose rows follow Group by, and the timeline became one shared timeline, taken out of the Releases timeline, for the Plan, the project timeline and Releases, each day the same width, as [Visual Design](../design/visual-design.md#components) and [UI Conventions](../standards/ui-conventions.md#timelines) set out.

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

- **Fathom's own views:** The Features Board is built on Mantine, with a column for each cycle of one stream and a row for each value of the Group by chosen, as [Visual Design](../design/visual-design.md#components) sets out. Cards are moved with the mouse by @hello-pangea/dnd, as ADR 0004 chose for ordering, with each cycle of each row its own list, since the library moves items between lists but does not lay out a grid. Keyboard users move cards with Fathom's own keys, as for ordering. The timelines are drawn by Fathom's own shared timeline, taken out of the Releases timeline.
- **Moves are drafts:** Dropping a card on another cycle or row changes the feature's target cycle or that row's value through the same draft functions every table uses.
- **No timeline library:** vis-timeline, chosen in ADR 0004 to be confirmed, is not used; this replaces that choice once accepted.
- **Fallback:** If dragging months freely or resizing bars turns out to be needed, dnd-timeline is the first library to try, styled with Mantine.

## Consequences

- **Fathom maintains the board and the timeline,** as it does the spreadsheet tables, in return for drafts shown as everywhere else and no new dependency, and none of moment, HTML labels, or a wrapper around a component that is not React.
- **Bars live on the timeline, not the board:** A feature's staffed months are a bar on the shared timeline, in the Plan and the project timeline, each day the same width, so cycles of any length line up. The board's cards name their staffed months in words instead, so the board needs no lanes.
- **The brief's dates and assignments are narrowed:** The first version moves target cycles and the board's row values only. Dragging a bar to shift a feature's allocations by months would make many allocation drafts at once, so it is left out until the maintainer decides it is needed.
- **More reliance on @hello-pangea/dnd,** whose last release was in February 2025. Moving it out would touch both ordering and the board, with `@dnd-kit/react` the replacement ADR 0004 names.
- **Build order:** The Features Board, the Plan and the project timeline are built in the order [issue #491](https://github.com/jlarue26/fathom/issues/491) sets out. The board shows no demand; demand against capacity is the Capacity page's Demand mode, as the [Decisions Log](../product/decisions.md#planning) sets out.
