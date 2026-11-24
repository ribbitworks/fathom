# UI Components

- **ADR:** 0004
- **Status:** Accepted
- **Date:** 2026-10-30
- **Revised:**
  - 2026-10-30, to add the typeface chosen with the visual design, and to name the roadmap stage for the timeline views rather than number it
  - 2026-10-31, to add drag and drop for ordering
  - 2026-11-03, to point to ADR 0009's proposal for the Gantt and timeline views
  - 2026-11-05, to lay out the org chart with Fathom's own code rather than dagre
  - 2026-11-06, to add the rich-text editor for notes
  - 2026-11-11, since the timeline views moved to the first stage, with Fathom's own timeline, as ADR 0009 sets out
  - 2026-11-12, since ADR 0009 is superseded, keeping its choice of libraries
  - 2026-11-19, to mark Mantine's date and chart packages, Recharts and TanStack Table as not adopted yet

## Context

[ADR 0002](0002-libraries.md) left UI components, styling, charts, and the Gantt, timeline, and org chart components to a component evaluation. The first stage needs forms, tables, date pickers, simple charts, the org chart, and the timeline views.

Every choice must:

- **Be completely open source,** under a permissive licence, so Fathom stays under Apache 2.0, as [ADR 0001](0001-tech-stack.md) requires. Open-core libraries, whose free edition leads to a paid one with more features, are ruled out.
- **Work offline and under Fathom's security policy,** as set out in the [Security Plan](../security/security-plan.md): everything bundled, and no code built from strings.
- **Support React 19,** and be actively maintained.

Each candidate below was built into a test page. None loads anything from other sites or builds code from strings, and all the React components among them support React 19. Activity is from GitHub and npm in October 2026.

## Decision

| Area | Choice | Alternatives | Why |
| --- | --- | --- | --- |
| UI components | [Mantine](https://mantine.dev), with its date and notification packages. Its date package is not adopted yet | [shadcn/ui](https://ui.shadcn.com) with Tailwind, [React Aria Components](https://react-aria.adobe.com) | The most complete set, including date pickers and notifications, with its own styles, so the least to build. Active, with few open issues |
| Styling | Mantine's theme, and [CSS Modules](https://github.com/css-modules/css-modules) for Fathom's own styles | [Tailwind](https://tailwindcss.com) | Mantine is styled with CSS files and variables, which CSS Modules extend without a second styling system |
| Typeface | [IBM Plex Sans](https://github.com/IBM/plex), bundled through its [Fontsource](https://fontsource.org) package | The system's own fonts | A clear, professional face under the SIL Open Font License, which allows bundling, so nothing loads from the internet |
| Forms | Mantine's inputs, with [React Hook Form](https://react-hook-form.com) as decided in ADR 0002 | [Mantine's form library](https://mantine.dev/form/use-form/) | Mantine supplies the inputs, such as text, select, and date fields. React Hook Form was already chosen and is more widely used |
| Tables | [TanStack Table](https://tanstack.com/table) as decided in ADR 0002, with Mantine's table. TanStack Table is not adopted yet. Tables edited like a spreadsheet, such as People, are Fathom's own, built on Mantine's table and its Combobox for picking choices | A spreadsheet grid library, such as react-datasheet-grid, Glide Data Grid, or RevoGrid | Unchanged for plain tables. No chosen library offers spreadsheet editing, and [AG Grid](https://www.ag-grid.com)'s free edition leaves out pasting. Building on Mantine keeps the visual design and accessibility, at the cost of maintaining the editing code |
| Charts | [Recharts](https://recharts.github.io), through [Mantine's chart package](https://mantine.dev/charts/getting-started/). Not adopted yet: Fathom has no charts | [ECharts](https://echarts.apache.org), [Chart.js](https://www.chartjs.org), [Nivo](https://nivo.rocks) | SVG charts that screen readers and keyboard users can reach, styled to match Mantine. ECharts is larger and styled separately from Mantine, Chart.js draws only on a canvas, and Nivo's releases have slowed |
| Drag and drop | [@hello-pangea/dnd](https://github.com/hello-pangea/dnd), for ordering rows | [dnd-kit](https://github.com/clauderic/dnd-kit)'s `@dnd-kit/react`, [Pragmatic drag and drop](https://github.com/atlassian/pragmatic-drag-and-drop) | Apache-2.0, supports React 19, and the drag-and-drop library Mantine's own documentation uses. `@dnd-kit/react` is active but not yet at version 1.0, and Pragmatic drag and drop has no keyboard dragging |
| Org chart | [React Flow](https://reactflow.dev), with the tree laid out by Fathom's own code | [d3-org-chart](https://github.com/bumbeishvili/org-chart), [dagre](https://github.com/dagrejs/dagre) for layout | React Flow is widely used, active, and completely open source; its [paid subscription](https://reactflow.dev/pro) sells examples and support, not library features. d3-org-chart has one maintainer and no recent release. The tree's layout is set out below the table |
| Rich-text editor | [Tiptap](https://tiptap.dev), through [Mantine's editor package](https://mantine.dev/x/tiptap/), loading only the formats notes allow | [Lexical](https://lexical.dev), [Milkdown](https://milkdown.dev), a Markdown text box alone | Mantine's own package, so the toolbar matches the rest of Fathom. Tiptap, built on ProseMirror, is MIT-licensed, widely used, and builds a document only from the extensions loaded, so typing or pasting cannot make a format notes do not allow. The alternatives are set out below the table |
| Gantt and timeline | [vis-timeline](https://github.com/visjs/vis-timeline), not used: Fathom's own view instead, as [ADR 0009](0009-roadmap-and-timeline-views.md) chose | A custom React and SVG view, [Frappe Gantt](https://github.com/frappe/gantt) | Active and completely open source, with rows of bars that can be dragged to new dates or rows, and zooming. [SVAR React Gantt](https://svar.dev/react/gantt/) and [DHTMLX Gantt](https://dhtmlx.com/docs/products/dhtmlxGantt/) are open-core, so they are ruled out, and Frappe Gantt's releases have slowed |

Two choices need more reasons than their rows hold:

- **Org chart layout:**
  - **dagre,** chosen first, lays out general graphs with every card in a row at one height, so it cannot stack the reports who manage nobody in a column under their manager. Stacking them keeps a large organization narrow enough to read.
  - **Fathom's own layout:** an org chart is a tree, which a short layout of Fathom's own handles.
  - **[elkjs](https://github.com/kieler/elkjs),** a common layout engine, is licensed GPL or EPL, so it is ruled out.
- **Rich-text editor:** Lexical has no Mantine package and Milkdown is less used. A Markdown text box alone would ask everyone to write Markdown, so it is offered beside the editor instead.

## Consequences

- **One maintainer writes most of Mantine,** 87% of its commits in the past year. It is MIT-licensed and widely used, so Fathom could keep a copy if it stopped being maintained, but that would be work.
- **vis-timeline is not used:** Fathom draws its own timeline, as [ADR 0009](0009-roadmap-and-timeline-views.md) chose, so it has none of vis-timeline's HTML labels, its reliance on moment, or a wrapper around a component that isn't React.
- **Fathom's own styles** use CSS Modules and Mantine's theme variables, so the look stays consistent and can be changed in one place.
- **@hello-pangea/dnd's last release was in February 2025.** It is complete for ordering rows, and keyboard users reorder with Alt and the arrow keys or row menus, not its own keyboard dragging. If it stops working with React, `@dnd-kit/react` is the replacement once it reaches version 1.0.
- **Bundle size** grows by a few hundred kilobytes, which suits an internal tool on an organization's own network.
