-- SPDX-License-Identifier: Apache-2.0

-- Features can hold values in columns added to them, each value row owned by one feature.

ALTER TABLE "fathom"."field_values" DROP CONSTRAINT "field_values_one_owner";--> statement-breakpoint
ALTER TABLE "fathom"."field_values" ADD COLUMN "feature_id" uuid;--> statement-breakpoint
ALTER TABLE "fathom"."field_values" ADD CONSTRAINT "field_values_feature_id_features_id_fk" FOREIGN KEY ("feature_id") REFERENCES "fathom"."features"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "field_values_feature_choice_index" ON "fathom"."field_values" USING btree ("field_id","feature_id","choice_id") WHERE "fathom"."field_values"."feature_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "field_values_feature_link_index" ON "fathom"."field_values" USING btree ("field_id","feature_id") WHERE "fathom"."field_values"."feature_id" IS NOT NULL AND "fathom"."field_values"."link_address" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "field_values_feature_note_index" ON "fathom"."field_values" USING btree ("field_id","feature_id") WHERE "fathom"."field_values"."feature_id" IS NOT NULL AND "fathom"."field_values"."note" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "field_values_feature_number_index" ON "fathom"."field_values" USING btree ("field_id","feature_id") WHERE "fathom"."field_values"."feature_id" IS NOT NULL AND "fathom"."field_values"."number" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "field_values_feature_index" ON "fathom"."field_values" USING btree ("feature_id") WHERE "fathom"."field_values"."feature_id" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "fathom"."field_values" ADD CONSTRAINT "field_values_one_owner" CHECK (num_nonnulls("fathom"."field_values"."person_id", "fathom"."field_values"."planned_hire_id", "fathom"."field_values"."feature_id") = 1);