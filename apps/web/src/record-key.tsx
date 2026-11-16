// SPDX-License-Identifier: Apache-2.0

// A record's key, such as #FEATURE-123, under a details panel's title, the key itself the button
// that opens Copy link and Copy key, and Copy link in a row's or card's menu. A record not yet saved
// has no key, so offers neither. Copying changes nothing in view, so a notification says it was
// done.

import {
  type RecordKeyOf,
  recordLinkPath,
  shownRecordKey,
} from "@fathom/shared";
import { Menu, UnstyledButton } from "@mantine/core";
import { AppMenu } from "./app-menu.tsx";
import { unsavedKeyNumber } from "./drafts.ts";
import { notifyFailure, notifySuccess } from "./notices.tsx";
import classes from "./record-key.module.css";

export const isSaved = ({ keyNumber }: RecordKeyOf): boolean =>
  keyNumber !== unsavedKeyNumber;

// The whole link, with the address Fathom is open at, so it opens from anywhere.
export const recordLink = ({ kind, keyNumber }: RecordKeyOf): string =>
  new URL(recordLinkPath(kind, keyNumber), window.location.origin).href;

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

export const copyKey = ({ kind, keyNumber }: RecordKeyOf): Promise<void> =>
  copy(
    shownRecordKey(kind, keyNumber),
    "Key copied.",
    "The key couldn't be copied.",
  );

// Copy link, for a row's or card's menu; nothing for a record not yet saved.
export function CopyLinkItem({ record }: { record: RecordKeyOf }) {
  if (!isSaved(record)) return null;
  return <Menu.Item onClick={() => void copyLink(record)}>Copy link</Menu.Item>;
}

export function RecordKey({ record }: { record: RecordKeyOf }) {
  if (!isSaved(record)) return null;
  const shown = shownRecordKey(record.kind, record.keyNumber);
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
