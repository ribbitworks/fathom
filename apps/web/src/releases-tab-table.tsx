// SPDX-License-Identifier: Apache-2.0

// What each tab of the Releases page draws around its table: the shared table, with the timeline of
// the schedules its rows show above it.

import type { ReleaseStream } from "@fathom/shared";
import type { ReactNode } from "react";
import classes from "./pages.module.css";
import { RecordGrid } from "./record-grid.tsx";
import type { GridRecord } from "./record-table.ts";
import type { LayerRecord, ReleaseLayerForm } from "./release-layer.tsx";
import { TableTips } from "./table-tips.tsx";
import { releaseLayerRange } from "./timeline.ts";
import { TimelineView } from "./timeline-view.tsx";

// Where every tab keeps the timeline's zoom in the browser, so each opens at the zoom last chosen.
export const releasesTimelineZoomKey = "fathom-releases-timeline-zoom";

type GridProps<Rec extends GridRecord> = Parameters<
  typeof RecordGrid<Rec, never, undefined>
>[0];

export function ReleasesTabTable<Rec extends GridRecord>({
  empty,
  reason,
  day,
  layerForm,
  timelineOf,
  everyStream,
  onOpenMark,
  ...grid
}: Omit<GridProps<Rec>, "above"> & {
  // Whether the tab has no records at all, when an empty timeline would show nothing.
  empty: boolean;
  // Why the page's New button is turned off, above the table.
  reason?: ReactNode;
  day: string;
  layerForm: ReleaseLayerForm;
  // The schedules the timeline draws, from the rows the table shows.
  timelineOf: (shown: readonly Rec[]) => readonly ReleaseStream[];
  // Every schedule, whose days the timeline spans while the view shows none.
  everyStream: readonly ReleaseStream[];
  // Opens the record a mark on the timeline stands for.
  onOpenMark: (record: LayerRecord) => void;
}) {
  return (
    <TableTips>
      <RecordGrid
        {...grid}
        above={(shown) => (
          <>
            {reason}
            {!empty && (
              <div className={classes.releasesTimeline}>
                <TimelineView
                  title="Timeline"
                  zoomKey={releasesTimelineZoomKey}
                  releaseStreams={timelineOf(shown)}
                  layerForm={layerForm}
                  onOpen={onOpenMark}
                  today={day}
                  spanWhileEmpty={releaseLayerRange(everyStream)}
                />
              </div>
            )}
          </>
        )}
      />
    </TableTips>
  );
}
