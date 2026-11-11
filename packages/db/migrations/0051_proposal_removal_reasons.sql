-- SPDX-License-Identifier: Apache-2.0

-- The reasons given for taking features off a proposal, by feature.

ALTER TABLE "fathom"."proposals" ADD COLUMN "removal_reasons" jsonb DEFAULT '{}'::jsonb NOT NULL;
