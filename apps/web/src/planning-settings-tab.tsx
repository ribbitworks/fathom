// SPDX-License-Identifier: Apache-2.0

// The Capacity page's Settings tab, for those who see configuration: the working time effort is
// converted with, the defaults forecasts start from, and how new starters ramp up, month by month.
// Those who change configuration change each setting in place, as a details panel's values are
// changed, saved at once for everyone and undone with Cmd+Z or Ctrl+Z; anyone else sees them read
// only.

import {
  type PlanningSettings,
  type PlanningSettingsChange,
  planningSettingLimits,
  planningSettingNames,
  planningSettingsSchema,
  typedNumber,
  changedSettings,
  fullOutputPercent,
} from "@fathom/shared";
import { ActionIcon, Button, Stack, Text } from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { effortConversionsQuery } from "./effort.ts";
import { focusSoon } from "./focus.ts";
import { Icon } from "./icons.tsx";
import { LoadProblem } from "./load-problem.tsx";
import { noOthers } from "./new-plan-record-panel.tsx";
import { percentage } from "./numbers.ts";
import {
  changePlanningSettings,
  planningSettingsQuery,
} from "./planning-settings.ts";
import { RecordSection, Row } from "./record-details.tsx";
import {
  changeId,
  type RecordEditingContext,
  useRecordEditing,
} from "./record-editing.tsx";
import { type Column, fieldColumn } from "./record-grid.tsx";
import classes from "./planning-settings-tab.module.css";
import { useSaving } from "./saving.ts";
import { settingsPageWidth } from "./settings-page.tsx";
import type { CellValue } from "./table-view.ts";

type Settings = PlanningSettings & { id: string };
type SettingColumn = Column<Settings, PlanningSettingsChange>;
type SingleSetting = Exclude<keyof PlanningSettings, "rampUpPercents">;

const settingsId = "planning-settings";
const onlyKind = "";
const addMonthId = "add-ramp-up-month";
const monthsLimitId = "ramp-up-months-limit";
const { rampUpMonths } = planningSettingLimits;

const monthKey = (month: number) => `month-${String(month)}`;
const monthName = (month: number) => `Month ${String(month)}`;
const removeMonthId = (month: number) =>
  `remove-ramp-up-month-${String(month)}`;

// A setting's row, which saves the number given as the change it makes.
function settingColumn(
  key: string,
  label: string,
  change: (value: number) => PlanningSettingsChange,
): SettingColumn {
  return {
    ...fieldColumn<Settings, PlanningSettingsChange>(key, "number", {
      label,
      required: true,
      choices: [],
      multiple: false,
    }),
    // A value is checked as a number before its change is made.
    change: (value) => change(Number(value)),
  };
}

const single = (key: SingleSetting) =>
  // The key is one of the typed settings, each a key of the names.
  // eslint-disable-next-line security/detect-object-injection
  settingColumn(key, planningSettingNames[key], (value) => ({ [key]: value }));

const columns = {
  hoursPerDay: single("hoursPerDay"),
  daysPerWeek: single("daysPerWeek"),
  daysPerMonth: single("daysPerMonth"),
  focusPercent: single("focusPercent"),
  bufferPercent: single("bufferPercent"),
} as const;

// A month of ramp-up's row, which saves the whole ramp-up with that month changed.
const monthColumn = (rampUp: readonly number[], month: number) =>
  settingColumn(monthKey(month), monthName(month), (value) => ({
    rampUpPercents: rampUp.map((share, index) =>
      index === month - 1 ? value : share,
    ),
  }));

// The month a new starter reaches full output, shown as a row of its own that can't be changed.
const fullOutputColumn = (month: number) =>
  ({
    key: "full-output",
    label: `From month ${String(month)}`,
    kind: "text",
    multiple: false,
    choices: [],
    required: false,
  }) as const satisfies Parameters<typeof Row>[0]["column"];

// The settings as the rows hold them, each as text, and ramp-up by month.
function valuesOf(settings: PlanningSettings): Record<string, CellValue> {
  const { rampUpPercents, ...rest } = settings;
  return Object.fromEntries<CellValue>([
    ...Object.entries(rest).map(
      ([key, value]) => [key, String(value)] as const,
    ),
    ...rampUpPercents.map(
      (share, index) => [monthKey(index + 1), String(share)] as const,
    ),
  ]);
}

// The settings the rows' values make, by the same rules the server checks them with.
function settingsProblem(
  values: Record<string, CellValue>,
  changed: string | undefined,
) {
  const held = new Map(Object.entries(values));
  // Every setting is held as text, as a number cell's value is.
  const number = (key: string) => typedNumber(held.get(key) as string);
  const months = Object.keys(values).filter((key) => key.startsWith("month-"));
  const checked = planningSettingsSchema.safeParse({
    hoursPerDay: number("hoursPerDay"),
    daysPerWeek: number("daysPerWeek"),
    daysPerMonth: number("daysPerMonth"),
    focusPercent: number("focusPercent"),
    bufferPercent: number("bufferPercent"),
    rampUpPercents: months.map((_key, index) => number(monthKey(index + 1))),
  });
  const [issue] = checked.error?.issues ?? [];
  if (issue === undefined) return undefined;
  // A month of ramp-up is named by its own row's label.
  const [field, index] = issue.path;
  const message =
    field === "rampUpPercents" && typeof index === "number"
      ? issue.message.replace(
          planningSettingNames.rampUpPercents,
          monthName(index + 1),
        )
      : issue.message;
  return { message, column: changed };
}

function Percentage({ value }: { value: number }) {
  return <Text>{percentage(value)}</Text>;
}

export function PlanningSettingsTab({ canEdit }: { canEdit: boolean }) {
  const settings = useQuery(planningSettingsQuery);
  const { save, undoable, done } = useSaving<PlanningSettings>({
    queryKey: planningSettingsQuery.queryKey,
    refreshes: [effortConversionsQuery.queryKey],
    removed: "Fathom could not find the planning settings. Reload the page.",
    blocked: false,
  });
  const { editingOf } = useRecordEditing<Settings, PlanningSettingsChange>();
  if (settings.isError) {
    return (
      <LoadProblem
        what="the planning settings"
        onRetry={() => {
          void settings.refetch();
        }}
      />
    );
  }
  if (settings.data === undefined) return null;
  const current = settings.data;
  const rampUp = current.rampUpPercents;

  // Saves a change at once, then offers Undo, with focus going back where the change was made.
  const saveChange = (
    change: PlanningSettingsChange,
    onSaved: (changeSetId: string | null, before: PlanningSettings) => void,
  ) => {
    save({
      next: (data) => changedSettings(data, change),
      save: async () => changePlanningSettings(change),
      failure: "Fathom could not save the planning settings.",
      onSaved,
    });
  };
  const undoableAt =
    (focus: string) =>
    (changeSetId: string | null, before: PlanningSettings) => {
      undoable(changeSetId, before, focus);
    };

  const context: RecordEditingContext<Settings, PlanningSettingsChange> = {
    id: settingsId,
    kind: onlyKind,
    values: valuesOf(current),
    others: noOthers,
    recordProblem: (values, _others, changed) =>
      settingsProblem(values, changed),
    save: canEdit
      ? (change, column) => {
          saveChange(change, undoableAt(changeId(column)));
        }
      : undefined,
  };
  const editing = editingOf(context);
  const row = (
    column: SettingColumn,
    value: number,
    asPercent = false,
    action?: ReactNode,
  ) => (
    <Row
      key={column.key}
      column={column}
      value={String(value)}
      editing={editing(column)}
      action={action}
    >
      {asPercent ? <Percentage value={value} /> : undefined}
    </Row>
  );
  const months = rampUp.map((share, index) => ({
    column: monthColumn(rampUp, index + 1),
    share,
  }));
  const lastMonth = rampUp.length;
  const full = rampUp.length >= rampUpMonths.most;

  // Focus goes to the new month, drawn by the time it is saved, and back to Add month once undone.
  const addMonth = () => {
    saveChange(
      { rampUpPercents: [...rampUp, fullOutputPercent] },
      (changeSetId, before) => {
        focusSoon(changeId({ key: monthKey(lastMonth + 1) }));
        undoable(changeSetId, before, addMonthId);
      },
    );
  };
  // Takes a month out of view, so says so, offering Undo. Focus goes to the × now in its place, or
  // the one before it, or to Add month once none is left.
  const removeMonth = (month: number) => {
    saveChange(
      { rampUpPercents: rampUp.filter((_share, index) => index !== month - 1) },
      (changeSetId, before) => {
        const next = Math.min(month, lastMonth - 1);
        focusSoon(next > 0 ? removeMonthId(next) : addMonthId);
        done(
          `Removed month ${String(month)} of ramp-up.`,
          changeSetId,
          before,
          changeId({ key: monthKey(month) }),
        );
      },
    );
  };
  return (
    <Stack gap="lg" maw={settingsPageWidth} className={classes.settings}>
      <RecordSection id="planning-working-time" title="Working time">
        {row(columns.hoursPerDay, current.hoursPerDay)}
        {row(columns.daysPerWeek, current.daysPerWeek)}
        {row(columns.daysPerMonth, current.daysPerMonth)}
      </RecordSection>
      <RecordSection id="planning-forecasts" title="Forecasts">
        {row(columns.focusPercent, current.focusPercent, true)}
        {row(columns.bufferPercent, current.bufferPercent, true)}
      </RecordSection>
      <Stack gap="xs">
        <RecordSection id="planning-ramp-up" title="Ramp-up for new starters">
          {months.map(({ column, share }, index) =>
            row(
              column,
              share,
              true,
              canEdit && (
                <ActionIcon
                  id={removeMonthId(index + 1)}
                  variant="subtle"
                  color="gray"
                  size="sm"
                  aria-label={`Remove ${monthName(index + 1).toLowerCase()}`}
                  onClick={() => {
                    removeMonth(index + 1);
                  }}
                >
                  <Icon name="close" />
                </ActionIcon>
              ),
            ),
          )}
          <Row column={fullOutputColumn(lastMonth + 1)} value="">
            <Percentage value={fullOutputPercent} />
          </Row>
        </RecordSection>
        {canEdit && (
          <Stack gap={4} align="flex-start">
            <Button
              id={addMonthId}
              variant="default"
              size="compact-sm"
              disabled={full}
              aria-describedby={full ? monthsLimitId : undefined}
              onClick={addMonth}
            >
              Add month
            </Button>
            {full && (
              <Text id={monthsLimitId} size="sm" c="dimmed">
                Ramp-up holds up to {String(rampUpMonths.most)} months.
              </Text>
            )}
          </Stack>
        )}
      </Stack>
    </Stack>
  );
}
