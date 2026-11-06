// SPDX-License-Identifier: Apache-2.0

// The controls above the org chart: the finder on the left, and on the right the levels to show,
// zooming, and fitting the chart to the screen. The chart decides what each choice does to it.

import {
  ActionIcon,
  Button,
  Group,
  Menu,
  Select,
  Text,
  Tooltip,
} from "@mantine/core";
import { useReactFlow } from "@xyflow/react";
import { useMemo } from "react";
import { AppMenu } from "./app-menu.tsx";
import { Icon } from "./icons.tsx";
import { fitOptions, type OrgTree } from "./org-chart.ts";

const byName = new Intl.Collator(undefined, { sensitivity: "base" });

export function ChartControls({
  tree,
  found,
  levels,
  onFind,
  onFindAgain,
  onLevels,
}: {
  tree: OrgTree;
  found: string | null;
  levels: number;
  onFind: (id: string | null) => void;
  // Someone was chosen in the finder, even the person already found.
  onFindAgain: () => void;
  onLevels: (levels: number | "all") => void;
}) {
  const flow = useReactFlow();
  const choices = useMemo(
    () =>
      // Someone shown by name only cannot be kept in the address, so is not offered.
      [...tree.people.values()]
        .filter((person) => person.employeeId !== null)
        .sort((a, b) => byName.compare(a.preferredName, b.preferredName))
        .map((person) => ({ value: person.id, label: person.preferredName })),
    [tree],
  );
  return (
    <Group justify="space-between" gap="sm">
      <Select
        aria-label="Find a person"
        placeholder="Find a person"
        leftSection={<Icon name="search" />}
        data={choices}
        value={found}
        searchable
        clearable
        allowDeselect={false}
        nothingFoundMessage="Nobody has that name"
        renderOption={({ option }) => (
          <div>
            <Text size="sm">{option.label}</Text>
            <Text size="xs" c="dimmed">
              {tree.people.get(option.value)?.position}
            </Text>
          </div>
        )}
        onChange={onFind}
        onOptionSubmit={onFindAgain}
        w={280}
      />
      <Group gap="xs">
        {levels > 1 && (
          <AppMenu position="bottom-end">
            <AppMenu.Target>
              <Button variant="default">Show levels</Button>
            </AppMenu.Target>
            <AppMenu.Dropdown>
              {Array.from({ length: levels - 1 }, (_, index) => index + 1).map(
                (level) => (
                  <Menu.Item
                    key={level}
                    onClick={() => {
                      onLevels(level);
                    }}
                  >
                    {level === 1 ? "1 level" : `${String(level)} levels`}
                  </Menu.Item>
                ),
              )}
              <Menu.Item
                onClick={() => {
                  onLevels("all");
                }}
              >
                All levels
              </Menu.Item>
            </AppMenu.Dropdown>
          </AppMenu>
        )}
        <Tooltip label="Zoom in">
          <ActionIcon
            variant="default"
            size="lg"
            aria-label="Zoom in"
            onClick={() => {
              void flow.zoomIn({ duration: 200 });
            }}
          >
            <Icon name="plus" />
          </ActionIcon>
        </Tooltip>
        <Tooltip label="Zoom out">
          <ActionIcon
            variant="default"
            size="lg"
            aria-label="Zoom out"
            onClick={() => {
              void flow.zoomOut({ duration: 200 });
            }}
          >
            <Icon name="minus" />
          </ActionIcon>
        </Tooltip>
        <Button
          variant="default"
          onClick={() => {
            void flow.fitView({ ...fitOptions, duration: 300 });
          }}
        >
          Fit to screen
        </Button>
      </Group>
    </Group>
  );
}
