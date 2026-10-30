# UI Components

- **ADR:** 0004
- **Status:** Accepted
- **Date:** 2026-10-30

## Context

[ADR 0002](0002-libraries.md) left UI components, styling, charts, and the Gantt, timeline, and org chart components to the component evaluation in the roadmap's [After Hello Fathom](../product/roadmap.md#after-hello-fathom) section. The first stage needs forms, tables, date pickers, and simple charts. The Gantt, timeline, and org chart views come in the third stage, The Organization.

Every choice must:

- **Be completely open source,** under a permissive licence, so Fathom stays under Apache 2.0, as [ADR 0001](0001-tech-stack.md) requires. Open-core libraries, whose free edition leads to a paid one with more features, are ruled out.
- **Work offline and under Fathom's security policy,** as set out in the [Security Plan](../security/security-plan.md): everything bundled, and no code built from strings.
- **Support React 19,** and be actively maintained.

Each candidate below was built into a test page. None loads anything from other sites or builds code from strings, and all the React components among them support React 19. Activity is from GitHub and npm in October 2026.

## Decision

| Area | Choice | Alternatives | Why |
| --- | --- | --- | --- |
| UI components | [Mantine](https://mantine.dev), with its date and notification packages | [shadcn/ui](https://ui.shadcn.com) with Tailwind, [React Aria Components](https://react-aria.adobe.com) | The most complete set, including date pickers and notifications, with its own styles, so the least to build. Active, with few open issues |
| Styling | Mantine's theme, and [CSS Modules](https://github.com/css-modules/css-modules) for Fathom's own styles | [Tailwind](https://tailwindcss.com) | Mantine is styled with CSS files and variables, which CSS Modules extend without a second styling system |
| Forms | Mantine's inputs, with [React Hook Form](https://react-hook-form.com) as decided in ADR 0002 | [Mantine's form library](https://mantine.dev/form/use-form/) | Mantine supplies the inputs, such as text, select, and date fields. React Hook Form was already chosen and is more widely used |
| Tables | [TanStack Table](https://tanstack.com/table) as decided in ADR 0002, with Mantine's table | | Unchanged |
| Charts | [Recharts](https://recharts.github.io), through [Mantine's chart package](https://mantine.dev/charts/getting-started/) | [ECharts](https://echarts.apache.org), [Chart.js](https://www.chartjs.org), [Nivo](https://nivo.rocks) | SVG charts that screen readers and keyboard users can reach, styled to match Mantine. ECharts is larger and styled separately from Mantine, Chart.js draws only on a canvas, and Nivo's releases have slowed |
| Org chart | [React Flow](https://reactflow.dev) with [dagre](https://github.com/dagrejs/dagre), as the `@dagrejs/dagre` package, for layout | [d3-org-chart](https://github.com/bumbeishvili/org-chart) | Both widely used, active, and completely open source; React Flow's [paid subscription](https://reactflow.dev/pro) sells examples and support, not library features. d3-org-chart has one maintainer and no recent release. [elkjs](https://github.com/kieler/elkjs), a common layout engine, is licensed GPL or EPL, so it is ruled out |
| Gantt and timeline | [vis-timeline](https://github.com/visjs/vis-timeline), to be confirmed when the third stage starts | A custom React and SVG view, [Frappe Gantt](https://github.com/frappe/gantt) | Active and completely open source, with rows of bars that can be dragged to new dates or rows, and zooming. [SVAR React Gantt](https://svar.dev/react/gantt/) and [DHTMLX Gantt](https://dhtmlx.com/docs/products/dhtmlxGantt/) are open-core, so they are ruled out, and Frappe Gantt's releases have slowed |

## Consequences

- **One maintainer writes most of Mantine,** 87% of its commits in the past year. It is MIT-licensed and widely used, so Fathom could keep a copy if it stopped being maintained, but that would be work.
- **vis-timeline shows item labels as HTML,** bypassing React's protection against injected markup, so Fathom passes labels as text or page elements, never as HTML strings.
- **vis-timeline needs moment,** a date library that is no longer actively developed. This is weighed again when the choice is confirmed.
- **vis-timeline is not a React component and draws no dependency lines.** Fathom wraps it in a small React component. Fathom plans at the project and feature level, so dependency lines may not be needed; if they are, a custom view built on React and SVG is the fallback. It is not needed until the third stage, so it is checked again then.
- **Fathom's own styles** use CSS Modules and Mantine's theme variables, so the look stays consistent and can be changed in one place.
- **Bundle size** grows by a few hundred kilobytes, which suits an internal tool on the company network.
