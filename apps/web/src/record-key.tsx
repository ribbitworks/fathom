// SPDX-License-Identifier: Apache-2.0

// A record's key, the button under a details panel's title that copies its link or key, Copy link
// for a row's or card's menu, and a name after its key.

import {
  isCodedKey,
  type RecordKeyOf,
  recordLinkPath,
  shownRecordKey,
} from "@fathom/shared";
import { Menu, UnstyledButton } from "@mantine/core";
import type { ReactNode } from "react";
import { AppMenu } from "./app-menu.tsx";
import { unsavedKeyNumber } from "./drafts.ts";
import { notifyFailure, notifySuccess } from "./notices.tsx";
import classes from "./record-key.module.css";

// A random key is made with its record, so only a numbered one can stand for a record not yet saved.
export const isSaved = (key: RecordKeyOf): boolean =>
  isCodedKey(key) || key.keyNumber !== unsavedKeyNumber;

// The whole link, with the address Fathom is open at, so it opens from anywhere.
export const recordLink = (key: RecordKeyOf): string =>
  new URL(recordLinkPath(key), window.location.origin).href;

async function copy(text: string, done: string, failed: string) {
  try {
    await navigator.clipboard.writeText(text);
    notifySuccess(done);
  } catch {
    notifyFailure(failed);
  }
}

export const copyLink = (key: RecordKeyOf): Promise<void> =>
  copy(recordLink(key), "Link copied.", "The link couldn't be copied.");

export const copyKey = (key: RecordKeyOf): Promise<void> =>
  copy(shownRecordKey(key), "Key copied.", "The key couldn't be copied.");

// Copy link, for a row's or card's menu; nothing for a record not yet saved, or with no key.
export function CopyLinkItem({ record }: { record: RecordKeyOf | undefined }) {
  if (record === undefined || !isSaved(record)) return null;
  return <Menu.Item onClick={() => void copyLink(record)}>Copy link</Menu.Item>;
}

export function RecordKey({ record }: { record: RecordKeyOf }) {
  if (!isSaved(record)) return null;
  const shown = shownRecordKey(record);
  return (
    <AppMenu position="bottom-start" withinPortal>
      <AppMenu.Target>
        <UnstyledButton
          className={classes.key}
          aria-label={`${shown}, copy link or key`}
        >
          {shown}
        </UnstyledButton>
      </AppMenu.Target>
      <AppMenu.Dropdown>
        <Menu.Item onClick={() => void copyLink(record)}>Copy link</Menu.Item>
        <Menu.Item onClick={() => void copyKey(record)}>Copy key</Menu.Item>
      </AppMenu.Dropdown>
    </AppMenu>
  );
}

// A name after its record's key, dimmed, as a panel's list of drafts names each record; a record with
// no key, or not yet saved, shows its name alone.
export function KeyedName({
  record,
  name,
}: {
  record: RecordKeyOf | undefined;
  name: ReactNode;
}) {
  if (record === undefined || !isSaved(record)) return name;
  return (
    <>
      <span className={classes.shown}>{shownRecordKey(record)}</span> {name}
    </>
  );
}
