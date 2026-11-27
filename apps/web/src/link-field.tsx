// SPDX-License-Identifier: Apache-2.0

// Web links in a table's cells, for any table with a web link column. The cell shows the link's
// text, with its address as the cell's title, and clicking it opens the address in a new tab. An
// address Fathom does not accept, which the server never stores, is shown as plain text instead and
// is never followed. Editing opens a small form beside the cell, with the address, checked once it
// is left, and the text to show, which may be left empty to show the address. Enter saves, Esc
// cancels, and Tab moves between the form's fields, then saves and moves on to the next cell, as
// Shift+Tab does to the one before; clicking away saves what will do.

import {
  keptAddress,
  type Link,
  linkLabel,
  type LinkPlace,
  linkLengths,
  linkProblems,
  webAddress,
} from "@fathom/shared";
import { Button, Group, Menu, Popover, Stack, Text } from "@mantine/core";
import { type KeyboardEvent, type MouseEvent, useState } from "react";
import { type Finish, useTypedBeforeFocus } from "./choice-picker.tsx";
import { composingWord } from "./composing.ts";
import { CountedInput } from "./counted-input.tsx";
import classes from "./pages.module.css";

// Clicking a link in a cell leaves focus on the cell, so the keys that move around the table still
// work.
const focusCell = (event: MouseEvent<HTMLElement>) => {
  event.currentTarget.closest<HTMLElement>('[role="gridcell"]')?.focus();
};

// The address is checked again here, so a link that reached the browser some other way can never
// run anything. Opening without the referrer keeps the page address, which holds the table's search
// and filters, from reaching the linked site. Outside a table, as in a person's details, it is an
// ordinary link, reached with Tab.
export function LinkCell({
  link,
  inTable = true,
}: {
  link: Link;
  inTable?: boolean;
}) {
  const href = webAddress(link.address);
  const label = linkLabel(link);
  if (href === null) return <span title={link.address}>{label}</span>;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      title={href}
      // Tab moves between cells; the row's menu opens the link from the keyboard.
      {...(inTable ? { tabIndex: -1, onClick: focusCell } : {})}
      className={classes.cellLink}
    >
      {label}
    </a>
  );
}

// The item in a row's menu that opens a link in a new tab, or nothing for an address Fathom does
// not accept.
export function LinkMenuItem({ name, link }: { name: string; link: Link }) {
  const href = webAddress(link.address);
  if (href === null) return null;
  return (
    <Menu.Item
      component="a"
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      title={href}
    >
      Open {name}
    </Menu.Item>
  );
}

// A link's form, with the address, checked once it is left, and the text to show, which may be left
// empty to show the address. Enter saves, Esc cancels, and Tab past the last field, or Shift+Tab
// before the first, saves and moves on. What it gives back saves it as clicking away does.
export function useLinkForm({
  id,
  name,
  initial,
  typed,
  place = "column",
  invalid = false,
  describedBy,
  onDone,
  onCancel,
}: {
  id: string;
  name: string;
  // Where the link is kept, which decides the addresses it takes.
  place?: LinkPlace;
  // Whether the link was refused, and what names why, when it is shown.
  invalid?: boolean;
  describedBy?: string | undefined;
  initial: Link | undefined;
  // What was typed to start editing, which starts the address.
  typed: string | undefined;
  onDone: (link: Link | null, finish: Finish) => void;
  onCancel: () => void;
}) {
  const textId = `${id}-text`;
  const [address, setAddress] = useState(typed ?? initial?.address ?? "");
  useTypedBeforeFocus(typed ?? "", address, setAddress);
  const [text, setText] = useState(initial?.text ?? "");
  const [tried, setTried] = useState(false);
  const [leftAddress, setLeftAddress] = useState(false);
  const link = { address: address.trim(), text: text.trim() };
  const cleared = link.address === "" && link.text === "";
  const problems = cleared ? {} : linkProblems(link, place);
  // An address is judged once it has been typed and left, or saving is tried, never while it is
  // being typed.
  const shownAddress = tried || leftAddress ? problems.address : undefined;

  const finish = (how: Finish) => {
    setTried(true);
    if (problems.address !== undefined || problems.text !== undefined) return;
    onDone(
      cleared
        ? null
        : // Accepted, as just checked.
          {
            address: keptAddress(link.address, place) as string,
            text: link.text,
          },
      how,
    );
  };

  // Tab past the last field, or Shift+Tab before the first, saves and moves on, as in other cells.
  const onKeyDown = (event: KeyboardEvent) => {
    if (composingWord(event)) return;
    const field = (event.target as HTMLElement).id;
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      onCancel();
    } else if (event.key === "Tab" && !event.shiftKey && field === textId) {
      event.preventDefault();
      finish("next");
    } else if (event.key === "Tab" && event.shiftKey && field === id) {
      event.preventDefault();
      finish("previous");
    } else if (event.key === "Tab" && !event.shiftKey && field === id) {
      // Straight to the text, past the address's ×, as Tab goes from field to field.
      event.preventDefault();
      document.getElementById(textId)?.focus();
    }
  };

  const form = (
    <form
      noValidate
      aria-label={name}
      // The field describes itself; why the table refused the link is named under the row.
      aria-describedby={describedBy}
      onKeyDown={onKeyDown}
      onSubmit={(event) => {
        event.preventDefault();
        finish("enter");
      }}
    >
      <Stack gap="sm">
        <Text fz="sm" fw={600}>
          {name}
        </Text>
        <CountedInput
          id={id}
          label="Address"
          placeholder="example.com or http://wiki/"
          data-autofocus
          autoComplete="off"
          value={address}
          maximum={linkLengths.address}
          // A link the table refused marks its address, and is named under the row.
          error={shownAddress ?? invalid}
          onValue={setAddress}
          onBlur={() => {
            setLeftAddress(address.trim() !== "");
          }}
        />
        <CountedInput
          id={textId}
          label="Text to show"
          description="Leave empty to show the address."
          autoComplete="off"
          value={text}
          maximum={linkLengths.text}
          error={problems.text}
          onValue={setText}
        />
        <Group gap="xs" justify="flex-end">
          <Button variant="default" size="compact-sm" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" size="compact-sm">
            Save
          </Button>
        </Group>
      </Stack>
    </form>
  );
  return { form, finish };
}

// Edits a cell's link, finishing with the link, or with null when both fields are emptied.
export function LinkEditor(props: Parameters<typeof useLinkForm>[0]) {
  const { form, finish } = useLinkForm(props);
  const { initial } = props;
  return (
    <Popover
      opened
      onDismiss={() => {
        finish("leave");
      }}
      closeOnEscape={false}
      trapFocus
      position="bottom-start"
      width={360}
      withinPortal
      hideDetached={false}
    >
      <Popover.Target>
        <span className={classes.linkLabel}>
          {initial ? linkLabel(initial) : ""}
        </span>
      </Popover.Target>
      <Popover.Dropdown>{form}</Popover.Dropdown>
    </Popover>
  );
}
