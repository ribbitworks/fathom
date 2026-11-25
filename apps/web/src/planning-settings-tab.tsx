// SPDX-License-Identifier: Apache-2.0

// The Capacity page's Settings tab, for those who see configuration: the working time effort is
// converted with, the defaults forecasts start from, and how new starters ramp up, month by month.
// Those who change configuration change each setting in place, as a details panel's values are
// changed, each change a draft of the settings, undone with Cmd+Z or Ctrl+Z and live once approved
// with Approve Configuration; anyone else sees them read only. The Draft menu chooses how the draft
// shows, and each changed row's menu offers what may be done with the draft as a whole.

import {
  type Asking,
  type DraftKind,
  type PlanningSettings,
  type PlanningSettingsChange,
  type PlanningSettingsShown,
  type RecordDraft,
  planningSettingLimits,
  planningSettingNames,
  planningSettingsId,
  planningSettingsSchema,
  type Show,
  typedNumber,
  changedSettings,
  fullOutputPercent,
} from "@fathom/shared";
import { ActionIcon, Button, Group, Stack, Text } from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import { type ReactNode } from "react";
import { useDecisionDialog } from "./decision-dialog.tsx";
import { configDraftFields, draftLines } from "./draft-details.tsx";
import { noDrafts } from "./drafts.ts";
import { decisionFor } from "./draft-decisions.ts";
import { focusSoon } from "./focus.ts";
import { Icon } from "./icons.tsx";
import { LoadProblem } from "./load-problem.tsx";
import { noOthers } from "./new-plan-record-panel.tsx";
import { percentage } from "./numbers.ts";
import {
  changePlanningSettings,
  planningSettingsNode,
  planningSettingsQuery,
  planningSettingsRef as ref,
  planningSettingsSubject as subject,
  settingsDraftWords,
} from "./planning-settings.ts";
import { RecordSection, Row } from "./record-details.tsx";
import { RecordMenu, type RecordMenuActions } from "./record-menu.tsx";
import {
  changeId,
  type RecordEditingContext,
  useRecordEditing,
} from "./record-editing.tsx";
import { fieldColumn } from "./grid-columns.tsx";
import { withLiveFields } from "./live-records.ts";
import type { Column } from "./record-table.ts";
import classes from "./planning-settings-tab.module.css";
import { discardRecordDraft, resubmitRecordDraft } from "./releases.ts";
import { draftSaving, useSaving } from "./saving.ts";
import { settingsPageWidth } from "./settings-page.tsx";
import { DraftedItem, DraftView } from "./status-mark.tsx";
import { DraftMenu } from "./table-controls.tsx";
import type { CellValue } from "./table-view.ts";

type Settings = PlanningSettingsShown & { id: string };
type SettingColumn = Column<Settings, PlanningSettingsChange>;
type SingleSetting = Exclude<keyof PlanningSettings, "rampUpPercents">;

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
  const { rampUpPercents, ...rest } = planningSettingsSchema.parse(settings);
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

// The settings as they are live, with their draft taken back.
function liveSettings(settings: Settings): Settings {
  const { draft, ...rest } = settings;
  return draft === undefined
    ? settings
    : withLiveFields<Settings>(settings, draft, rest);
}

// The settings as the Draft view shows them: as drafted, or as they are live, Live only and, once
// rejected, Drafts applied, which takes a rejected draft back.
function shownSettings(settings: Settings, show: Show): Settings {
  const takenBack =
    show === "live" ||
    (show === "drafts" && settings.draft?.state === "rejected");
  return takenBack ? liveSettings(settings) : settings;
}

export function PlanningSettingsTab({
  canEdit,
  approves,
  show,
  onShow,
}: {
  canEdit: boolean;
  // The kinds of draft the user may approve and reject.
  approves: readonly DraftKind[];
  show: Show;
  onShow: (show: Show) => void;
}) {
  const settings = useQuery(planningSettingsQuery);
  const decisionDialog = useDecisionDialog();
  const { save, undoable, done } = useSaving<PlanningSettingsShown>({
    queryKey: planningSettingsQuery.queryKey,
    removed: "Fathom could not find the planning settings. Reload the page.",
    blocked: decisionDialog.opened,
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
  const original: Settings = { ...settings.data, id: planningSettingsId };
  const { draft, heldBy } = original;
  const current = shownSettings(original, show);
  const rampUp = current.rampUpPercents;
  const live = liveSettings(original);
  // The draft, where it changes a setting.
  const draftOf = (key: keyof PlanningSettings) =>
    draft?.changed.includes(key) === true ? draft : undefined;
  const editable = canEdit && show !== "live" && heldBy === undefined;

  // Saves a change at once, as a draft, then offers Undo, with focus going back where the change
  // was made.
  const saveChange = (
    change: PlanningSettingsChange,
    onSaved: (
      changeSetId: string | null,
      before: PlanningSettingsShown,
    ) => void,
  ) => {
    save({
      next: (data) => ({ ...data, ...changedSettings(data, change) }),
      save: async () => changePlanningSettings(change),
      failure: "Fathom could not save the planning settings.",
      onSaved,
    });
  };
  const undoableAt =
    (focus: string) =>
    (changeSetId: string | null, before: PlanningSettingsShown) => {
      undoable(changeSetId, before, focus);
    };
  const drafts = draftSaving({ save, undoable, done });
  const node = planningSettingsNode(original);
  const actions: RecordMenuActions = {
    approves,
    nodes: [node],
    decide: (asking: Asking) => {
      decisionDialog.open(
        decisionFor(asking, { ...noDrafts(), records: [ref] }, approves, [], {
          fields: [],
          records: [node],
        }),
      );
    },
    resubmit: () => {
      drafts.resubmit({
        name: subject,
        save: () => resubmitRecordDraft(ref),
      });
    },
    discard: () => {
      drafts.discard({
        name: subject,
        save: () => discardRecordDraft(ref),
      });
    },
  };
  // A changed row's menu, for the draft of the settings as a whole, so it names every change the
  // draft makes, since approving it from any changed row approves them all.
  const draftMenu = (drafted: RecordDraft | undefined) =>
    drafted !== undefined &&
    show !== "live" && (
      <RecordMenu
        title="Planning settings"
        node={node}
        canEditDraft={canEdit}
        actions={actions}
        lines={draftLines(
          drafted,
          configDraftFields(...settingsDraftWords(drafted, original)),
        )}
      />
    );

  const context: RecordEditingContext<Settings, PlanningSettingsChange> = {
    id: planningSettingsId,
    kind: onlyKind,
    values: valuesOf(current),
    others: noOthers,
    recordProblem: (values, _others, changed) =>
      settingsProblem(values, changed),
    save: editable
      ? (change, column) => {
          saveChange(change, undoableAt(changeId(column)));
        }
      : undefined,
  };
  const editing = editingOf(context);
  // A setting's row, marked where the draft changes it, with its live value beside it.
  const row = (
    column: SettingColumn,
    value: number | undefined,
    liveValue: number | undefined,
    {
      asPercent = false,
      drafted,
      action,
      canChange = true,
    }: {
      asPercent?: boolean;
      drafted?: RecordDraft | undefined;
      action?: ReactNode;
      canChange?: boolean;
    } = {},
  ) => {
    const menu = draftMenu(drafted);
    return (
      <Row
        key={column.key}
        column={column}
        value={value === undefined ? "" : String(value)}
        changed={
          drafted
            ? {
                draft: drafted,
                live: liveValue === undefined ? "" : String(liveValue),
              }
            : undefined
        }
        editing={canChange ? editing(column) : undefined}
        action={
          menu || action ? (
            <>
              {menu}
              {action}
            </>
          ) : undefined
        }
      >
        {asPercent && value !== undefined ? (
          <Percentage value={value} />
        ) : undefined}
      </Row>
    );
  };
  const settingRow = (key: SingleSetting, asPercent = false) =>
    // The key is one of the typed settings.
    // eslint-disable-next-line security/detect-object-injection
    row(columns[key], current[key], live[key], {
      asPercent,
      drafted: draftOf(key),
    });
  // Beside live, a month the draft removes still shows, emptied, with its live share under it.
  const monthsShown =
    show === "both"
      ? Math.max(rampUp.length, live.rampUpPercents.length)
      : rampUp.length;
  const months = Array.from({ length: monthsShown }, (_none, index) => ({
    month: index + 1,
    share: rampUp.at(index),
    liveShare: live.rampUpPercents.at(index),
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
    <DraftView show={show}>
      <Stack gap="lg" maw={settingsPageWidth} className={classes.settings}>
        <Group gap="sm">
          <DraftMenu show={show} onShow={onShow} />
          {heldBy !== undefined && (
            <DraftedItem heldBy={heldBy}>
              <Text size="sm" c="dimmed">
                Being changed by {heldBy}
              </Text>
            </DraftedItem>
          )}
        </Group>
        <RecordSection id="planning-working-time" title="Working time">
          {settingRow("hoursPerDay")}
          {settingRow("daysPerWeek")}
          {settingRow("daysPerMonth")}
        </RecordSection>
        <RecordSection id="planning-forecasts" title="Forecasts">
          {settingRow("focusPercent", true)}
          {settingRow("bufferPercent", true)}
        </RecordSection>
        <Stack gap="xs">
          <RecordSection id="planning-ramp-up" title="Ramp-up for new starters">
            {months.map(({ month, share, liveShare }) =>
              row(monthColumn(rampUp, month), share, liveShare, {
                asPercent: true,
                drafted:
                  share === liveShare ? undefined : draftOf("rampUpPercents"),
                canChange: share !== undefined,
                action: editable && share !== undefined && (
                  <ActionIcon
                    id={removeMonthId(month)}
                    variant="subtle"
                    color="gray"
                    size="sm"
                    aria-label={`Remove ${monthName(month).toLowerCase()}`}
                    onClick={() => {
                      removeMonth(month);
                    }}
                  >
                    <Icon name="close" />
                  </ActionIcon>
                ),
              }),
            )}
            <Row column={fullOutputColumn(lastMonth + 1)} value="">
              <Percentage value={fullOutputPercent} />
            </Row>
          </RecordSection>
          {editable && (
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
      {decisionDialog.modal}
    </DraftView>
  );
}
