-- SPDX-License-Identifier: Apache-2.0

-- Indexes each record's changes by field, newest first, so the change history finds the latest name
-- and list the history holds for a record without reading every change.

CREATE INDEX "changes_record_field_index" ON "fathom"."changes" USING btree ("record_id","field","id" DESC NULLS LAST);
