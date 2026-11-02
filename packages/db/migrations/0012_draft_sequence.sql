-- SPDX-License-Identifier: Apache-2.0

-- Numbers drafts in the order they are made, so records drafted to be added, such as choices pasted
-- at once, keep the order they were drafted in.

ALTER TABLE "fathom"."drafts" ADD COLUMN "sequence" bigint NOT NULL GENERATED ALWAYS AS IDENTITY (sequence name "fathom"."drafts_sequence_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1);
