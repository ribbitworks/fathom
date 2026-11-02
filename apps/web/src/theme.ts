// SPDX-License-Identifier: Apache-2.0

// Fathom's visual design as a Mantine theme: IBM Plex Sans, bundled with the front end; quiet
// neutrals with one sea-blue accent for actions and the current place; colour otherwise only for
// meaning; light and dark modes that follow each person's setting; and tables that look alike,
// each header row staying in view.

import {
  type CSSVariablesResolver,
  createTheme,
  type MantineColorsTuple,
  Table,
} from "@mantine/core";
import tableClasses from "./table.module.css";

const sea: MantineColorsTuple = [
  "#e5f3f8",
  "#cbe6ef",
  "#98cde0",
  "#62b2d0",
  "#3a9cc3",
  "#218fbb",
  "#0b6a87",
  "#095b74",
  "#064b60",
  "#033b4c",
];

// Dark mode's neutrals, with a slight lean toward the accent.
const deepWater: MantineColorsTuple = [
  "#e6edf2",
  "#c4d0da",
  "#9aa9b6",
  "#6f8190",
  "#2a3742",
  "#212d37",
  "#17212a",
  "#0f161c",
  "#0b1116",
  "#070c10",
];

export const theme = createTheme({
  fontFamily:
    '"IBM Plex Sans", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  headings: { fontWeight: "600" },
  primaryColor: "sea",
  // Deep enough in both modes for white text on filled buttons to stay readable.
  primaryShade: { light: 6, dark: 6 },
  colors: { sea, dark: deepWater },
  defaultRadius: "md",
  cursorType: "pointer",
  components: {
    Table: Table.extend({
      classNames: { table: tableClasses.table },
      defaultProps: {
        horizontalSpacing: "sm",
        verticalSpacing: "sm",
        stickyHeader: true,
      },
    }),
  },
});

// Panels use Mantine's body colour; the canvas behind them is Fathom's own. The sidebar stays deep
// water in both modes. Dimmed text is darker than Mantine's default in light mode, so it stays
// readable on white.
export const cssVariables: CSSVariablesResolver = (mantine) => ({
  variables: {
    "--fathom-sidebar": "#0f2a38",
    "--fathom-sidebar-text": "#c9dbe4",
    "--fathom-sidebar-muted": "#7f9aab",
    "--fathom-sidebar-active": "#1c4559",
    "--fathom-sidebar-accent": "#4fb3d3",
    "--fathom-sidebar-line": "#2c4757",
    "--fathom-sidebar-strong": "#ffffff",
    "--fathom-mark": "#2b8fb5",
    "--fathom-mark-waves": "#ffffff",
    "--fathom-table-head-height": "2.25rem",
  },
  light: {
    "--mantine-color-body": "#ffffff",
    "--fathom-canvas": "#f4f6f8",
    "--mantine-color-dimmed": mantine.colors.gray[7],
  },
  dark: {
    "--mantine-color-body": "#17212a",
    "--fathom-canvas": "#0f161c",
  },
});
