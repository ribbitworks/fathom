// SPDX-License-Identifier: Apache-2.0

// What each tab of the Releases page draws around its table: the table on the shared table, with a
// timeline above it of the schedules its rows show, in the rows' order, or words in its place while
// there is nothing to list yet.

import type { ReleaseStream } from "@fathom/shared";
import { Text } from "@mantine/core";
import classes from "./pages.module.css";
import { RecordGrid } from "./record-grid.tsx";
import type { GridRecord } from "./record-table.ts";
import type { LayerRecord, ReleaseLayerForm } from "./release-layer.tsx";
import { TableTips } from "./table-tips.tsx";
import { TimelineView } from "./timeline-view.tsx";

// Where every tab keeps the timeline's zoom in the browser, so each opens at the zoom last chosen.
export const releasesTimelineZoomKey = "fathom-releases-timeline-zoom";

type GridProps<Rec extends GridRecord> = Parameters<
  typeof RecordGrid<Rec, never, undefined>
>[0];

export function ReleasesTabTable<Rec extends GridRecord>({
  none,
  day,
  layerForm,
  timelineOf,
  onOpenMark,
  ...grid
}: Omit<GridProps<Rec>, "above"> & {
  // What the tab says in place of the table while there is nothing to list yet.
  none: string | undefined;
  day: string;
  layerForm: ReleaseLayerForm;
  // The schedules the timeline draws, from the rows the table shows.
  timelineOf: (shown: readonly Rec[]) => readonly ReleaseStream[];
  // Opens the record a mark on the timeline stands for.
  onOpenMark: (record: LayerRecord) => void;
}) {
  if (none !== undefined) {
    return (
      <Text fz="sm" c="dimmed">
        {none}
      </Text>
    );
  }
  return (
    <TableTips>
      <RecordGrid
        {...grid}
        above={(shown) => (
          <div className={classes.releasesTimeline}>
            <TimelineView
              title="Timeline"
              zoomKey={releasesTimelineZoomKey}
              releaseStreams={timelineOf(shown)}
              layerForm={layerForm}
              onOpen={onOpenMark}
              today={day}
            />
          </div>
        )}
      />
    </TableTips>
  );
}
