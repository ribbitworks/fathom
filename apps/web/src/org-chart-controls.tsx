// SPDX-License-Identifier: Apache-2.0

// The controls above the org chart: on the left the finder, the Draft menu and, for those who can
// name or colour teams, the Teams panel; on the right the levels to show, zooming, and fitting the
// chart to the screen. The chart decides what each choice does to it.

import {
  ActionIcon,
  Button,
  Combobox,
  Group,
  Menu,
  Select,
  Tooltip,
} from "@mantine/core";
import type { OrgChartPerson } from "@fathom/shared";
import { useReactFlow } from "@xyflow/react";
import { type ReactNode, useMemo, useState } from "react";
import { AppMenu } from "./app-menu.tsx";
import { OptionWords } from "./choice-picker.tsx";
import { Icon } from "./icons.tsx";
import {
  findFieldId,
  fitOptions,
  livePosition,
  nothingFound,
  type OrgTree,
} from "./org-chart.ts";

const byName = new Intl.Collator(undefined, { sensitivity: "base" });

// A team in the finder is its manager's identifier after this, so it is never taken for a person.
const teamPrefix = "team:";

export function ChartControls({
  tree,
  outside,
  draft,
  teams,
  found,
  levels,
  onFind,
  onFindAgain,
  onLevels,
  onMove,
}: {
  tree: OrgTree;
  // Everyone not on the chart while one team is shown alone.
  outside: readonly OrgChartPerson[];
  draft: ReactNode;
  teams: ReactNode;
  found: string | null;
  levels: number;
  // A team chosen finds the manager who leads it, with their reports shown.
  onFind: (id: string | null, team: boolean) => void;
  // Someone was chosen in the finder, even the person already found.
  onFindAgain: () => void;
  onLevels: (levels: number | "all") => void;
  // The chart is zoomed or fitted to the screen.
  onMove: () => void;
}) {
  const flow = useReactFlow();
  const [search, setSearch] = useState("");
  const choices = useMemo(() => {
    // A Live copy of someone drafted to another manager is found as the person themselves.
    const everyone = [...tree.people.values()].filter(
      (person) => person.liveCopyOf === undefined,
    );
    const named = (
      people: typeof everyone,
      name: (one: OrgChartPerson) => string,
    ) =>
      people
        .map((person) => ({ person, label: name(person) }))
        .sort((a, b) => byName.compare(a.label, b.label));
    return [
      {
        group: "People",
        // A feature team's own card, while it has no lead, is found as a team, not a person.
        items: named(
          everyone.filter((person) => person.teamCard !== true),
          (person) => person.preferredName,
        ).map(({ person, label }) => ({ value: person.id, label })),
      },
      {
        group: "Teams",
        items: named(
          everyone.filter((person) => person.teamName !== null),
          (person) => person.teamName as string,
        ).map(({ person, label }) => ({
          value: `${teamPrefix}${person.id}`,
          label,
        })),
      },
    ];
  }, [tree]);
  return (
    <Group justify="space-between" gap="sm">
      <Group gap="xs">
        <Select
          id={findFieldId}
          aria-label="Find a person or team"
          placeholder="Find a person or team"
          leftSection={<Icon name="search" />}
          data={choices}
          value={found}
          searchable
          clearable
          allowDeselect={false}
          searchValue={search}
          onSearchChange={setSearch}
          // The select offers its own clear button only once someone is chosen.
          {...(found === null && search !== ""
            ? {
                rightSection: (
                  <TextClear
                    onClear={() => {
                      setSearch("");
                    }}
                  />
                ),
                rightSectionPointerEvents: "all" as const,
              }
            : {})}
          nothingFoundMessage={nothingFound(outside, search)}
          renderOption={({ option }) => {
            const lead = option.value.startsWith(teamPrefix)
              ? tree.people.get(option.value.slice(teamPrefix.length))
              : undefined;
            const description =
              lead === undefined
                ? (tree.people.get(option.value)?.featureTeam ??
                  livePosition(tree.people.get(option.value)))
                : lead.teamCard === true
                  ? "No feature lead"
                  : `Led by ${lead.preferredName}`;
            return (
              <OptionWords
                option={{
                  label: option.label,
                  description: description ?? undefined,
                }}
              />
            );
          }}
          onChange={(value) => {
            if (value?.startsWith(teamPrefix) === true) {
              onFind(value.slice(teamPrefix.length), true);
            } else onFind(value, false);
          }}
          onOptionSubmit={onFindAgain}
          w={280}
        />
        {draft}
        {teams}
      </Group>
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
              onMove();
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
              onMove();
              void flow.zoomOut({ duration: 200 });
            }}
          >
            <Icon name="minus" />
          </ActionIcon>
        </Tooltip>
        <Button
          variant="default"
          onClick={() => {
            onMove();
            void flow.fitView({ ...fitOptions, duration: 300 });
          }}
        >
          Fit to screen
        </Button>
      </Group>
    </Group>
  );
}

// Laid out as the select lays out its own clear button beside the chevron, so the two look alike.
function TextClear({ onClear }: { onClear: () => void }) {
  return (
    <div
      data-combined-clear-section
      style={{
        display: "flex",
        gap: 2,
        alignItems: "center",
        paddingInlineEnd: 8,
      }}
    >
      <Combobox.ClearButton onClear={onClear} />
      <Combobox.Chevron />
    </div>
  );
}
