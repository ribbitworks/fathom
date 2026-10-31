# Fathom — Visual Design

**Status:** Agreed with the owner
**Last updated:** 2026-10-30

How Fathom's screens look and behave, so every page is built the same way. It applies the components and typeface chosen in [ADR 0004](../adr/0004-ui-components.md). The theme in `apps/web/src/theme.ts` holds the values; this document holds the rules.

## Principles

- **Quiet and dense:** Fathom is a work tool used every day, so pages favour clear structure and plenty of information over decoration. As few borders, lines, labels, and columns as the task allows; metadata, such as who changed something, stays out of the way.
- **One main action per screen:** Every other action is secondary or in a menu.
- **Controls when needed:** Controls that are not always needed, such as grip handles for dragging, appear on hover or keyboard focus.
- **No wasted space:** Layout serves the content; nothing takes width or height it does not earn.
- **Colour means something:** Neutrals carry the page. Sea blue marks actions and the current place. Other colours appear only for meaning, such as green for active, yellow for changes worth checking, and red for problems.
- **Never colour alone:** Anything shown by colour is also shown in words, visible or read aloud by screen readers.
- **Both modes:** Light and dark modes follow each person's system setting.

## Layout

- **Frame:** A deep-water sidebar on the left, the same in both modes, groups pages into sections. Pages still to come are shown, marked "Later", so people can see what Fathom will offer. A top bar names where the user is and holds their account menu.
- **Narrow screens:** The sidebar opens from a menu button, and closes when the user moves to another page.
- **Pages:** Each page starts with a heading and the page's main action on the right. Content sits in bordered panels on a canvas a shade darker than them.
- **Sign-in and problem pages:** Only Fathom's name and mark above the form or message, with no other words.

## Type and Colour

- **Typeface:** IBM Plex Sans, at weights 400 for text, 500 for emphasis, and 600 for headings and names. Weight 700 is bundled for Mantine's own bold text, such as table headings.
- **Figures:** Dates, times, and numbers that line up in columns use figures of equal width.
- **Colours:** Defined once in the theme as CSS variables and used by name, never written into a page.

## Components

- **Tables:** Lists of records are tables in a panel, with search and filters above them and each row's actions in a menu at its end.
- **Monthly resource grid:** The grid in the [Decisions Log](../product/decisions.md#planning) keeps people's names fixed on the left while months scroll sideways. Cycle and release ends are thin vertical lines labelled with their names, and each cell lists that month's work.
- **Dialogs:** Creating and changing records happens in dialogs, which say what will change and where it is recorded.
- **Messages:** Problems are shown in plain words saying what to do next, never as raw errors.
- **Styles:** Mantine's components, theme, and style props, such as a one-off size or margin, come first. Anything more goes in a CSS Module, never in a `style` attribute.
