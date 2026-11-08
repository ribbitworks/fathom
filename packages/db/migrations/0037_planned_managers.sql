-- SPDX-License-Identifier: Apache-2.0

-- Planned managers: a planned hire can be marked as a manager, so other planned hires can report to
-- it. A hire's manager is then a person or a planned hire, never both, and never the hire itself.

ALTER TABLE "fathom"."planned_hires" ADD COLUMN "manager_hire_id" uuid;--> statement-breakpoint
ALTER TABLE "fathom"."planned_hires" ADD COLUMN "is_manager" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "fathom"."planned_hires" ADD CONSTRAINT "planned_hires_manager_hire_id_planned_hires_id_fk" FOREIGN KEY ("manager_hire_id") REFERENCES "fathom"."planned_hires"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "planned_hires_manager_hire_index" ON "fathom"."planned_hires" USING btree ("manager_hire_id");--> statement-breakpoint
ALTER TABLE "fathom"."planned_hires" ADD CONSTRAINT "planned_hires_one_manager" CHECK (num_nonnulls("fathom"."planned_hires"."manager_id", "fathom"."planned_hires"."manager_hire_id") <= 1);--> statement-breakpoint
ALTER TABLE "fathom"."planned_hires" ADD CONSTRAINT "planned_hires_not_own_manager" CHECK ("fathom"."planned_hires"."manager_hire_id" IS NULL OR "fathom"."planned_hires"."manager_hire_id" <> "fathom"."planned_hires"."id");