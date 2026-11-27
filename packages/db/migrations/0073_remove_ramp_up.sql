-- SPDX-License-Identifier: Apache-2.0

-- Removes the planning settings' ramp-up for new starters.

ALTER TABLE "fathom"."planning_settings" DROP CONSTRAINT "planning_settings_ramp_up_percents";--> statement-breakpoint
ALTER TABLE "fathom"."planning_settings" DROP COLUMN "ramp_up_percents";