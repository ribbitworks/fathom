// SPDX-License-Identifier: Apache-2.0

// Fathom's visual design as a Mantine theme: IBM Plex Sans, bundled with the front end; quiet
// neutrals with one sea-blue accent for actions and the current place; colour otherwise only for
// meaning, or as chosen for a release; light and dark modes that follow the computer's setting
// unless the person chooses one; tables that look alike, each header row staying in view; and
// drop-down lists whose keyboard place is light grey, as pointing is.

import {
  Combobox,
  type CSSVariablesResolver,
  createTheme,
  type MantineColorsTuple,
  Select,
  Table,
} from "@mantine/core";
import comboboxClasses from "./combobox.module.css";
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
    // Select styles its options under its own name, so it takes the same class.
    Combobox: Combobox.extend({
      classNames: { option: comboboxClasses.option },
    }),
    Select: Select.extend({
      classNames: { option: comboboxClasses.option },
    }),
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
    // How far a cell's editor reaches past its cell's text on each side, to meet the cell's edges.
    "--fathom-cell-editor-bleed": "8px",
    "--fathom-cell-editor-height": "28px",
    // Mantine sets the size of its small icon buttons on each button only, out of a cell's reach.
    "--fathom-small-button-size": "calc(1.375rem * var(--mantine-scale))",
    // Room for a focus ring, which Mantine draws 2px out with a 2px outline, inside an edge that clips.
    "--fathom-focus-room": "4px",
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
