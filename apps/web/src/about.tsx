// SPDX-License-Identifier: Apache-2.0

// Help's About box: which release and commit of Fathom this is, and the day of that commit, so
// someone reporting a problem can say what they were using. The scripts read them from git and pass
// them to the build, since the container build cannot see .git; a build without them shows them as
// unknown.

import { parseDay } from "@fathom/shared";
import { Modal, Table } from "@mantine/core";
import { Brand } from "./brand.tsx";
import { count } from "./numbers.ts";

export interface Build {
  // Such as 0.3.0, or 0.3.0+4 for 4 commits after it; empty before the first release.
  version: string;
  // Such as abc1234, or abc1234-modified when built from files that differ from it.
  commit: string;
  // The commit's day, such as 2026-11-02.
  date: string;
}

// Set by vite.config.ts.
declare const FATHOM_BUILD: Build;

export const build: Build = FATHOM_BUILD;

const labelWidth = 110;

// What scripts/lib.sh adds to the commit when the files built differ from it.
const modified = "-modified";

export function describeVersion(version: string): string {
  if (version === "") return "Unreleased";
  const plus = version.lastIndexOf("+");
  const commits = version.slice(plus + 1);
  // Anything else after a plus, such as build metadata, is part of the version.
  if (plus === -1 || !/^\d+$/.test(commits)) return version;
  const after = Number(commits);
  return `${version.slice(0, plus)}, plus ${after === 1 ? "1 commit" : `${count(after)} commits`}`;
}

export function describeCommit(commit: string): string {
  if (commit === "") return "Unknown";
  return commit.endsWith(modified)
    ? `${commit.slice(0, -modified.length)}, modified`
    : commit;
}

// The day is shown as it was written, without moving it into the reader's time zone.
const day = new Intl.DateTimeFormat(undefined, {
  dateStyle: "long",
  timeZone: "UTC",
});

export function describeDate(date: string): string {
  const committed = parseDay(date);
  return Number.isNaN(committed.getTime()) ? "Unknown" : day.format(committed);
}

export function AboutBox({
  opened,
  onClose,
  build,
}: {
  opened: boolean;
  onClose: () => void;
  build: Build;
}) {
  // Without a commit, the build had nothing from git, so an empty release is unknown, not unreleased.
  const rows: [string, string][] = [
    [
      "Version",
      build.commit === "" ? "Unknown" : describeVersion(build.version),
    ],
    ["Commit", describeCommit(build.commit)],
    ["Committed", describeDate(build.date)],
  ];
  return (
    <Modal opened={opened} onClose={onClose} title="About Fathom" centered>
      <Brand />
      <Table variant="vertical" layout="fixed" mt="md">
        <Table.Tbody>
          {rows.map(([label, value]) => (
            <Table.Tr key={label}>
              <Table.Th w={labelWidth}>{label}</Table.Th>
              <Table.Td>{value}</Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Modal>
  );
}
