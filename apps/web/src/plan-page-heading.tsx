// SPDX-License-Identifier: Apache-2.0

// The heading of the plan's pages: Projects' tabs or Features' switch between its table and board,
// and the buttons that add a column or a record.

import type { PlanMode, Show } from "@fathom/shared";
import { Button, Group } from "@mantine/core";
import { planModes } from "./feature-board.ts";
import { HeadingTabs, ModeSwitch, PageHeader } from "./page-header.tsx";
import { wordsOf } from "./plan-table.tsx";
import { type PlanTab, projectTabs } from "./projects.ts";

export const newButtonId = "projects-new";
export const newColumnId = "features-new-column";
export const tabsId = "projects-tabs";

export function PlanPageHeading({
  title,
  tabbed,
  tab,
  mode,
  onMode,
  editsColumns,
  canEdit,
  show,
  columnsReady,
  newReady,
  onTab,
  onNewColumn,
  onNew,
}: {
  title: string;
  tabbed: boolean;
  tab: PlanTab;
  mode: PlanMode;
  // Switches Features between its table and its board, where the page offers both.
  onMode: ((mode: PlanMode) => void) | undefined;
  editsColumns: boolean;
  canEdit: boolean;
  show: Show;
  columnsReady: boolean;
  newReady: boolean;
  onTab: (next: PlanTab) => void;
  onNewColumn: () => void;
  onNew: () => void;
}) {
  return (
    <PageHeader
      title={title}
      beside={
        tabbed ? (
          <HeadingTabs
            id={tabsId}
            label={`${title} tables`}
            tabs={projectTabs.map((one) => ({
              value: one,
              label: wordsOf(one).label,
            }))}
            tab={tab}
            onTab={onTab}
          />
        ) : (
          tab === "features" &&
          onMode !== undefined && (
            <ModeSwitch modes={planModes} mode={mode} onMode={onMode} />
          )
        )
      }
      action={
        <Group gap="xs">
          {editsColumns && (
            <Button
              id={newColumnId}
              variant={canEdit ? "default" : "filled"}
              disabled={!columnsReady}
              onClick={onNewColumn}
            >
              New column
            </Button>
          )}
          {/* The live records alone are read only. */}
          {canEdit && show !== "live" && (
            <Button
              id={newButtonId}
              variant="filled"
              disabled={!newReady}
              onClick={onNew}
            >
              New {wordsOf(tab).one}
            </Button>
          )}
        </Group>
      }
    />
  );
}
