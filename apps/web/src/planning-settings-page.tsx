// SPDX-License-Identifier: Apache-2.0

// The Planning settings page, for those who see configuration: the working time effort is converted
// with, the working week and the defaults forecasts start from.

import {
  type Asking,
  type DecidedKind,
  type PlanningSettings,
  type PlanningSettingsChange,
  type PlanningSettingsShown,
  type RecordDraft,
  planningSettingNames,
  planningSettingsId,
  planningSettingsSchema,
  type Show,
  typedNumber,
  changedSettings,
  weekdayNames,
  weekdaySchema,
  workingDaysWords,
} from "@fathom/shared";
import { Group, Loader, Stack, Text } from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { DecisionModal } from "./decision-dialog.tsx";
import { configDraftFields, draftLines } from "./draft-details.tsx";
import { noDrafts } from "./drafts.ts";
import { type Decision, decisionFor } from "./draft-decisions.ts";
import { LoadProblem } from "./load-problem.tsx";
import { noOthers } from "./new-plan-record-panel.tsx";
import { percentage } from "./numbers.ts";
import { PageHeader } from "./page-header.tsx";
import { usePublishDraft } from "./publish-draft.tsx";
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
  type Editing,
  type RecordEditingContext,
  useRecordEditing,
} from "./record-editing.tsx";
import { fieldColumn } from "./grid-columns.tsx";
import { withLiveFields } from "./live-records.ts";
import type { Column } from "./record-table.ts";
import classes from "./planning-settings-page.module.css";
import { discardRecordDraft, resubmitRecordDraft } from "./releases.ts";
import { useSaving } from "./saving.ts";
import { settingsPageWidth } from "./settings-page.tsx";
import { DraftedItem, DraftView } from "./status-mark.tsx";
import { DraftMenu } from "./table-controls.tsx";
import type { CellValue } from "./table-view.ts";
import { useWorkingDaysEditing } from "./working-days-field.tsx";

type Settings = PlanningSettingsShown & { id: string };
type DetailColumn = Parameters<typeof Row>[0]["column"];
type SettingColumn = Column<Settings, PlanningSettingsChange>;
type SingleSetting = Exclude<
  keyof PlanningSettings,
  "workingDays" | "weekStartsOn"
>;

const onlyKind = "";
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
  daysPerMonth: single("daysPerMonth"),
  focusPercent: single("focusPercent"),
  bufferPercent: single("bufferPercent"),
} as const;

const weekStartsOnColumn: SettingColumn = {
  ...fieldColumn<Settings, PlanningSettingsChange>("weekStartsOn", "choice", {
    label: planningSettingNames.weekStartsOn,
    required: true,
    choices: weekdayNames.map((name, day) => ({
      id: String(day),
      label: name,
      description: "",
      retired: false,
    })),
    multiple: false,
  }),
  // The one day chosen, from the days offered.
  change: (value) => ({
    weekStartsOn: weekdaySchema.parse(Number((value as string[]).at(0))),
  }),
};

const workingDaysColumn = {
  key: "workingDays",
  label: planningSettingNames.workingDays,
  kind: "text",
  multiple: false,
  choices: [],
  required: true,
} as const satisfies DetailColumn;

const daysWords = ({ workingDays, weekStartsOn }: PlanningSettings) =>
  workingDaysWords(workingDays, weekStartsOn);

// The settings the rows hold, each typed as a number.
const typedSettingsSchema = planningSettingsSchema.omit({
  workingDays: true,
  weekStartsOn: true,
});

// The settings as the rows hold them, each as text, and the day a week starts on as a choice.
function valuesOf(settings: PlanningSettings): Record<string, CellValue> {
  return Object.fromEntries<CellValue>([
    ["weekStartsOn", [String(settings.weekStartsOn)]],
    ...Object.entries(typedSettingsSchema.parse(settings)).map(
      ([key, value]) => [key, String(value)] as const,
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
  const checked = typedSettingsSchema.safeParse({
    hoursPerDay: number("hoursPerDay"),
    daysPerMonth: number("daysPerMonth"),
    focusPercent: number("focusPercent"),
    bufferPercent: number("bufferPercent"),
  });
  const [issue] = checked.error?.issues ?? [];
  return issue === undefined
    ? undefined
    : { message: issue.message, column: changed };
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

export function PlanningSettingsPage({
  canEdit,
  approves,
  show,
  onShow,
}: {
  canEdit: boolean;
  // The kinds of draft the user may approve and reject.
  approves: readonly DecidedKind[];
  show: Show;
  onShow: (show: Show) => void;
}) {
  const settings = useQuery(planningSettingsQuery);
  const [decision, setDecision] = useState<Decision>();
  const [deciding, setDeciding] = useState(false);
  const { save, undoable } = useSaving<PlanningSettingsShown>({
    queryKey: planningSettingsQuery.queryKey,
    removed: "Fathom could not find the planning settings. Reload the page.",
    blocked: deciding,
  });
  const { editingOf } = useRecordEditing<Settings, PlanningSettingsChange>();
  const workingDaysEditing = useWorkingDaysEditing(workingDaysColumn);
  const publishDraft = usePublishDraft();
  const heading = <PageHeader title="Planning settings" />;
  if (settings.isError) {
    return (
      <Stack gap="md">
        {heading}
        <LoadProblem
          what="the planning settings"
          onRetry={() => {
            void settings.refetch();
          }}
        />
      </Stack>
    );
  }
  if (settings.data === undefined) {
    return (
      <Stack gap="md">
        {heading}
        <Loader role="status" aria-label="Loading" />
      </Stack>
    );
  }
  const original: Settings = { ...settings.data, id: planningSettingsId };
  const { draft, heldBy } = original;
  const current = shownSettings(original, show);
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
  const run = (work: () => Promise<string | null>, failure: string) => {
    save({
      next: (data) => data,
      save: work,
      failure,
      onSaved: undoable,
    });
  };
  const node = planningSettingsNode(original);
  const actions: RecordMenuActions = {
    approves,
    nodes: [node],
    publish:
      publishDraft &&
      ((asked) => {
        publishDraft({ ...noDrafts(), records: [asked] });
      }),
    decide: (asking: Asking) => {
      setDecision(
        decisionFor(asking, { ...noDrafts(), records: [ref] }, approves, [], {
          fields: [],
          records: [node],
        }),
      );
      setDeciding(true);
    },
    resubmit: () => {
      run(
        () => resubmitRecordDraft(ref),
        `Fathom could not send the draft of ${subject} for approval again.`,
      );
    },
    discard: () => {
      run(
        () => discardRecordDraft(ref),
        `Fathom could not discard the draft of ${subject}.`,
      );
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
    value: number,
    liveValue: number,
    {
      asPercent = false,
      drafted,
    }: {
      asPercent?: boolean;
      drafted?: RecordDraft | undefined;
    } = {},
  ) => {
    const menu = draftMenu(drafted);
    return (
      <Row
        key={column.key}
        column={column}
        value={String(value)}
        changed={
          drafted
            ? {
                draft: drafted,
                live: String(liveValue),
              }
            : undefined
        }
        editing={editing(column)}
        action={menu || undefined}
      >
        {asPercent ? <Percentage value={value} /> : undefined}
      </Row>
    );
  };
  // A row of the working week, its value in words or a choice.
  const weekRow = (
    column: DetailColumn,
    value: CellValue,
    liveValue: CellValue,
    drafted: RecordDraft | undefined,
    rowEditing: Editing | undefined,
  ) => (
    <Row
      column={column}
      value={value}
      changed={drafted && { draft: drafted, live: liveValue }}
      editing={rowEditing}
      action={draftMenu(drafted)}
    />
  );
  const settingRow = (key: SingleSetting, asPercent = false) =>
    // The key is one of the typed settings.
    // eslint-disable-next-line security/detect-object-injection
    row(columns[key], current[key], live[key], {
      asPercent,
      drafted: draftOf(key),
    });
  return (
    <DraftView show={show}>
      {heading}
      <Stack
        gap="lg"
        mt="md"
        maw={settingsPageWidth}
        className={classes.settings}
      >
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
          {weekRow(
            workingDaysColumn,
            daysWords(current),
            daysWords(live),
            draftOf("workingDays"),
            workingDaysEditing.editingOf({
              days: current.workingDays,
              startsOn: current.weekStartsOn,
              save:
                context.save &&
                ((days) => {
                  saveChange(
                    { workingDays: days },
                    undoableAt(changeId(workingDaysColumn)),
                  );
                }),
            }),
          )}
          {weekRow(
            weekStartsOnColumn,
            [String(current.weekStartsOn)],
            [String(live.weekStartsOn)],
            draftOf("weekStartsOn"),
            editing(weekStartsOnColumn),
          )}
          {settingRow("daysPerMonth")}
        </RecordSection>
        <RecordSection id="planning-forecasts" title="Forecasts">
          {settingRow("focusPercent", true)}
          {settingRow("bufferPercent", true)}
        </RecordSection>
      </Stack>
      <DecisionModal
        decision={decision}
        opened={deciding}
        onClose={() => {
          setDeciding(false);
        }}
        onDone={() => {
          setDeciding(false);
        }}
      />
    </DraftView>
  );
}
