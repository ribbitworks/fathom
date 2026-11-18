// SPDX-License-Identifier: Apache-2.0

// Fathom's visual design as a Mantine theme: IBM Plex Sans, bundled with the front end; quiet
// neutrals with one sea-blue accent for actions and the current place; colour otherwise only for
// meaning, or as chosen for a release; light and dark modes that follow the computer's setting
// unless the person chooses one; tables that look alike, each header row staying in view; and
// drop-down lists whose keyboard place is light grey, as pointing is, and whose search finds options
// as every search in Fathom does; and switches whose chosen side is filled with the accent.

import { matchesWords, searchWords } from "@fathom/shared";
import {
  Combobox,
  type ComboboxItem,
  type ComboboxParsedItem,
  type CSSVariablesResolver,
  createTheme,
  isOptionsGroup,
  type MantineColorsTuple,
  Modal,
  type OptionsFilter,
  SegmentedControl,
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

// A drop-down list's search finds the options holding every word typed, in any order, whatever
// their accents, as every search in Fathom does, rather than by Mantine's own, which minds accents
// and order. Like Mantine's, it shows no more than a list's limit.
export const byWords: OptionsFilter = ({ options, search, limit }) => {
  const words = searchWords(search);
  let left = limit;
  const found = (items: readonly ComboboxItem[]) => {
    const shown = items
      .filter((item) => matchesWords(item.label, words))
      .slice(0, left);
    left -= shown.length;
    return shown;
  };
  return options.flatMap<ComboboxParsedItem>((option) =>
    isOptionsGroup(option)
      ? [{ ...option, items: found(option.items) }]
      : found([option]),
  );
};

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
      defaultProps: { filter: byWords },
    }),
    // Every dialog's × is named for assistive technology, which otherwise hears only "button".
    Modal: Modal.extend({
      defaultProps: { closeButtonProps: { "aria-label": "Close dialog" } },
    }),
    // The chosen side of every switch is filled with the accent, as a choice made is, rather than
    // white on grey, which reads as turned off.
    SegmentedControl: SegmentedControl.extend({
      defaultProps: { color: "sea" },
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
    "--fathom-selected-bar-width": "3px",
    // A draft's dot, the gap after a mark, and the room a rejected dot's ring takes around it.
    "--fathom-dot-size": "7px",
    "--fathom-mark-gap": "6px",
    "--fathom-ring-room": "3px",
    // Today, only ever as a thin line: a timeline's line, a strip's underline, a board's heading.
    "--fathom-today": "var(--mantine-color-red-6)",
    // The underline of the period holding today, such as a strip's quarter or a grid's month.
    "--fathom-today-underline": "inset 0 -2px 0 var(--fathom-today)",
    // A page's heading, as tall as a button beside it, so every page's heading is one height.
    "--fathom-heading-height": "calc(2.25rem * var(--mantine-scale))",
    // The last lines of a long note folded in a panel fade out over this height.
    "--fathom-note-fade": "3rem",
    // A side panel's name, at its top, and the line it and its marks stand on.
    "--fathom-panel-name-size": "18px",
    "--fathom-panel-name-line": "28px",
    // A table's slim scroll bars, and the fade at an edge with more columns beyond it.
    "--fathom-scrollbar-size": "10px",
    "--fathom-scroll-fade-width": "24px",
  },
  light: {
    "--mantine-color-body": "#ffffff",
    "--fathom-canvas": "#f4f6f8",
    // Behind the sign-in card, tinted so the white card stands out.
    "--fathom-sign-in": "var(--mantine-color-sea-1)",
    "--mantine-color-dimmed": mantine.colors.gray[7],
    // A row, column or card with a draft, faintly in its dot's colour: yellow, or red once rejected.
    // A cell the draft changes is tinted as its row is, since its dot and semibold value mark it.
    "--fathom-draft-tint": "var(--mantine-color-yellow-0)",
    "--fathom-draft-cell-tint": "var(--fathom-draft-tint)",
    "--fathom-rejected-tint": "var(--mantine-color-red-0)",
    "--fathom-rejected-cell-tint": "var(--fathom-rejected-tint)",
    // A size's blocks, light to dark blue-grey by position.
    "--fathom-size-1": "#b4c3d0",
    "--fathom-size-2": "#8399ad",
    "--fathom-size-3": "#566f86",
    "--fathom-size-4": "#2f4659",
    "--fathom-scrollbar-thumb": "var(--mantine-color-gray-4)",
    // A timeline's cycles, every other one in the second shade, in blue-greys beside the size marks',
    // each with a hairline edge, the lightest size mark here and a shade of its own in dark, so a
    // lane reads clearly against the panel.
    "--fathom-cycle": "#cfdae3",
    "--fathom-cycle-alternate": "#e2e9ef",
    "--fathom-cycle-edge": "var(--fathom-size-1)",
  },
  dark: {
    "--mantine-color-body": "#17212a",
    "--fathom-canvas": "#0f161c",
    "--fathom-sign-in": "var(--fathom-sidebar)",
    // The same colours as faint washes over the dark background, so light text stays readable.
    "--fathom-draft-tint":
      "color-mix(in srgb, var(--mantine-color-yellow-5) 5%, transparent)",
    "--fathom-draft-cell-tint": "transparent",
    "--fathom-rejected-tint":
      "color-mix(in srgb, var(--mantine-color-red-5) 6%, transparent)",
    "--fathom-rejected-cell-tint": "transparent",
    // Dark to light, so the last block still stands out most against the dark panel.
    "--fathom-size-1": "#3e5266",
    "--fathom-size-2": "#5d7792",
    "--fathom-size-3": "#86a0ba",
    "--fathom-size-4": "#b9cde0",
    "--fathom-scrollbar-thumb": "var(--mantine-color-dark-3)",
    "--fathom-cycle": "#34485a",
    "--fathom-cycle-alternate": "#2a3a48",
    "--fathom-cycle-edge": "#4a6178",
  },
});
